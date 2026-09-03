import { z } from "zod";
import { prisma } from "../db.js";
import { assertAiConfigured } from "./aiConfig.js";
import { callAiText, parseAiJsonObject } from "./aiClient.js";
import { buildSkillInstruction, INQUIRY_AGENT_SKILLS } from "./inquirySkills.js";
import type { InquiryAnalysis, ParameterKey, ParameterItem } from "./transformerAnalyzer.js";

type BuyerContext = {
  buyerCompany?: string | null;
  buyerEmail?: string | null;
  buyerCountry?: string | null;
};

const PARAMETER_KEYS = [
  "product_type",
  "application_scenario",
  "rated_voltage",
  "hv",
  "lv",
  "capacity",
  "frequency",
  "vector_group",
  "oltc_requirement",
  "impedance",
  "iec_standard",
  "installation_altitude",
  "quantity",
  "destination",
  "delivery_requirement",
  "certification",
] as const satisfies readonly ParameterKey[];

const ParameterSchema = z.object({
  key: z.enum(PARAMETER_KEYS),
  label: z.string().min(1),
  value: z.string().min(1),
  missing: z.boolean(),
  confidence: z.number().min(0).max(1),
  requiredForQuotation: z.boolean(),
  source: z.enum(["buyer_text", "semantic_inference", "knowledge_base", "not_provided"]),
  evidence: z.string().optional().default(""),
  interpretation: z.enum(["explicit", "inferred", "mentioned_not_requirement", "missing"]),
  needsConfirmation: z.boolean().optional().default(false),
});

const SkillResultSchema = z.object({
  code: z.enum([
    "buyer_intent_stage",
    "transformer_solution_reasoning",
    "technical_parameter_audit",
    "missing_parameter_questioning",
    "lead_value_grading",
    "knowledge_retrieval_planning",
    "reply_risk_control",
    "sales_reply_planning",
  ]),
  name: z.string().min(1),
  status: z.literal("completed"),
  priority: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
  result: z.string().min(1),
  nextAction: z.string().min(1),
  warnings: z.array(z.string()).default([]),
});

const AnalysisSchema = z.object({
  semanticSummary: z.string().min(1),
  businessIntent: z.string().min(1),
  intentConfidence: z.number().min(0).max(1),
  productType: z.string().min(1),
  productTypeConfidence: z.number().min(0).max(1),
  productTypeNeedsConfirmation: z.boolean(),
  applicationScenario: z.string().min(1),
  scenarioConfidence: z.number().min(0).max(1),
  parameters: z.array(ParameterSchema).min(1),
  painPoints: z.array(
    z.object({
      label: z.string().min(1),
      level: z.enum(["high", "medium", "low"]),
      evidence: z.string().optional(),
    }),
  ),
  missingQuestions: z.array(z.string().min(1)),
  lead: z.object({
    grade: z.enum(["A", "B", "C"]),
    score: z.number().min(0).max(100),
    reasons: z.array(z.string().min(1)),
    advice: z.string().min(1),
  }),
  skillResults: z.array(SkillResultSchema).min(INQUIRY_AGENT_SKILLS.length),
});

function normalizeParameter(raw: z.infer<typeof ParameterSchema>): ParameterItem {
  const missing = raw.missing || raw.interpretation === "missing";
  return {
    key: raw.key,
    label: raw.label,
    value: missing ? "Not provided" : raw.value,
    missing,
    confidence: raw.confidence,
    requiredForQuotation: raw.requiredForQuotation,
    requiredForQuote: raw.requiredForQuotation,
    source: missing ? "not_provided" : raw.source,
    evidence: raw.evidence,
    interpretation: missing ? "missing" : raw.interpretation,
    needsConfirmation: raw.needsConfirmation || raw.interpretation !== "explicit",
  };
}

function cleanQuestion(question: string) {
  return question.trim().replace(/^\d+[\.)、]\s*/g, "").trim();
}

function normalizeQuestions(questions: string[]) {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const question of questions.map(cleanQuestion).filter(Boolean)) {
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(question);
  }
  return cleaned.slice(0, 8);
}

function normalizeSkillResults(results: z.infer<typeof SkillResultSchema>[]) {
  const order = new Map(INQUIRY_AGENT_SKILLS.map((skill, index) => [skill.code, index]));
  return [...results].sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99));
}

function applySemanticTopLevelParameter(
  parameters: ParameterItem[],
  key: "product_type" | "application_scenario",
  value: string,
  confidence: number,
  needsConfirmation: boolean,
  evidence: string,
) {
  const item = parameters.find((param) => param.key === key);
  const unavailable =
    !value ||
    /not provided|unknown/i.test(value) ||
    value.trim() === "Application scenario to be confirmed" ||
    value.trim() === "Transformer type to be confirmed";

  if (!item || unavailable || (!item.missing && item.interpretation === "explicit")) return;

  item.value = value;
  item.missing = false;
  item.confidence = confidence;
  item.source = "semantic_inference";
  item.interpretation = "inferred";
  item.needsConfirmation = true;
  item.evidence = item.evidence || evidence;
}

async function productTaxonomy() {
  const products = await prisma.product.findMany({
    select: { type: true, model: true, voltagePrim: true, voltageSec: true, capacityKva: true, summary: true },
    take: 80,
    orderBy: { type: "asc" },
  });
  const productTypes = Array.from(new Set(products.map((item) => item.type).filter(Boolean))).slice(0, 30);
  return {
    productTypes,
    examples: products.slice(0, 25),
  };
}

function buildSystemPrompt() {
  return `You are the semantic analysis engine for a transformer export inquiry Agent.

You must run the following reusable business Skills and return their outputs:

${buildSkillInstruction()}

Critical judgment rules:
- Do semantic understanding, not keyword matching.
- If the buyer merely mentions a product type, standard, parameter, or certification as an example, comparison, question, or optional reference, do not treat it as a confirmed requirement.
- If the buyer asks whether something is acceptable or available, mark it as mentioned_not_requirement or inferred, not explicit.
- If the buyer says "need certificate/report if available", capture the mention, set needsConfirmation true, and do not turn it into a guaranteed certification requirement.
- Numeric/technical parameters such as HV, LV, Capacity, Frequency, Vector Group, OLTC, Impedance, IEC Standard, Installation Altitude, Quantity, and Destination must only be marked explicit when they are actually provided by the buyer or context.
- You may infer product direction or application scenario from semantics, but mark source as semantic_inference, needsConfirmation as true, and explain evidence.
- When multiple transformer types are possible, use "Transformer type to be confirmed" or state the most likely direction with confirmation required.
- For indoor commercial or strict fire safety scenarios, dry-type/cast resin can be a likely direction, but it is still an inferred recommendation unless the buyer explicitly asks for it.
- Do not invent models, prices, lead time, certifications, impedance, test reports, warranty, factory cases, or delivery commitments.
- Lead grading guide: A = formal RFQ/project with company/contact + core parameters + quantity/destination or urgent purchase; B = real project or clear application but missing quotation-critical parameters; C = broad price list/catalog request, unclear company/project, or low information.
- Missing questions must be useful for the next sales reply. Ask no more than 8 questions. Do not add numbering; the UI can number them.
- Every Skill result must be sales-usable: result = conclusion, nextAction = what salesperson should do next, warnings = what must not be assumed or promised.
- Return valid JSON only. Do not include markdown.`;
}

function buildUserPrompt(text: string, context: BuyerContext, taxonomy: Awaited<ReturnType<typeof productTaxonomy>>) {
  return JSON.stringify(
    {
      task: "Analyze this transformer export inquiry with semantic judgment and the listed Skills.",
      buyerContext: context,
      companyProductTaxonomy: taxonomy,
      requiredParameters: PARAMETER_KEYS,
      outputRules: {
        format: "Compact JSON object only. No markdown, no code fences, no commentary.",
        required:
          "Return every required parameter key once if possible. If a key is not available, mark missing=true and value='Not provided'.",
      },
      outputSchema: {
        semanticSummary: "Chinese summary for sales user. Explain actual buyer meaning and uncertainty.",
        businessIntent: "English concise intent label, e.g. Price inquiry / quotation request, Technical confirmation, Product information request.",
        intentConfidence: "0-1",
        productType: "English product direction. Use 'Transformer type to be confirmed' when not clear.",
        productTypeConfidence: "0-1",
        productTypeNeedsConfirmation: "true when inferred or unclear",
        applicationScenario: "English application scenario or 'Application scenario to be confirmed'",
        scenarioConfidence: "0-1",
        parameters: PARAMETER_KEYS.map((key) => ({
          key,
          label: "Human label",
          value: "Exact buyer-provided value, inferred non-numeric product/scenario direction, or Not provided",
          missing: "boolean",
          confidence: "0-1",
          requiredForQuotation: "boolean",
          source: "buyer_text | semantic_inference | knowledge_base | not_provided",
          evidence: "Short quote or reason. Empty if missing.",
          interpretation: "explicit | inferred | mentioned_not_requirement | missing",
          needsConfirmation: "boolean",
        })),
        painPoints: [{ label: "English business pain point", level: "high|medium|low", evidence: "buyer text or semantic reason" }],
        missingQuestions: ["English clarification questions, no numbering, max 8, prioritized for quotation readiness"],
        lead: {
          grade: "A|B|C",
          score: "0-100",
          reasons: ["English reasons based on evidence"],
          advice: "Chinese sales follow-up advice with concrete next step",
        },
        skillResults: INQUIRY_AGENT_SKILLS.map((skill) => ({
          code: skill.code,
          name: skill.name,
          status: "completed",
          priority: "high | medium | low",
          confidence: "0-1",
          evidence: ["1-3 facts or reasoning evidence items"],
          result: "Chinese conclusion for sales user",
          nextAction: "Chinese concrete next action for salesperson",
          warnings: ["Chinese warning items. Empty array if no special warning."],
        })),
      },
      inquiryText: text,
    },
    null,
    2,
  );
}

export async function analyzeTransformerInquiryWithAi(text: string, context: BuyerContext = {}) {
  const [config, taxonomy] = await Promise.all([assertAiConfigured(), productTaxonomy()]);
  const system = buildSystemPrompt();
  const user = buildUserPrompt(text, context, taxonomy);
  let parsed: z.infer<typeof AnalysisSchema>;
  try {
    const content = await callAiText(config, {
      system,
      user,
      temperature: 0.1,
      maxTokens: 4200,
    });
    parsed = AnalysisSchema.parse(parseAiJsonObject<unknown>(content));
  } catch {
    const repaired = await callAiText(config, {
      system: `${system}\n\nYour previous output could not be parsed. Return a compact valid JSON object only. Do not include markdown or explanations.`,
      user,
      temperature: 0,
      maxTokens: 4200,
    });
    try {
      parsed = AnalysisSchema.parse(parseAiJsonObject<unknown>(repaired));
    } catch {
      throw new Error("AI_OUTPUT_PARSE_FAILED");
    }
  }
  const parameters = parsed.parameters.map(normalizeParameter);
  applySemanticTopLevelParameter(
    parameters,
    "product_type",
    parsed.productType,
    parsed.productTypeConfidence,
    parsed.productTypeNeedsConfirmation,
    parsed.semanticSummary,
  );
  applySemanticTopLevelParameter(
    parameters,
    "application_scenario",
    parsed.applicationScenario,
    parsed.scenarioConfidence,
    parsed.scenarioConfidence < 0.9,
    parsed.semanticSummary,
  );
  const presentKeys = new Set(parameters.map((item) => item.key));
  for (const key of PARAMETER_KEYS) {
    if (!presentKeys.has(key)) {
      parameters.push({
        key,
        label: key,
        value: "Not provided",
        missing: true,
        confidence: 0,
        requiredForQuotation: !["application_scenario", "delivery_requirement", "certification"].includes(key),
        requiredForQuote: !["application_scenario", "delivery_requirement", "certification"].includes(key),
        source: "not_provided",
        evidence: "",
        interpretation: "missing",
        needsConfirmation: true,
      });
    }
  }

  const analysis: InquiryAnalysis = {
    semanticSummary: parsed.semanticSummary,
    businessIntent: parsed.businessIntent,
    intentConfidence: parsed.intentConfidence,
    productType: parsed.productType,
    productTypeConfidence: parsed.productTypeConfidence,
    productTypeNeedsConfirmation: parsed.productTypeNeedsConfirmation,
    applicationScenario: parsed.applicationScenario,
    scenarioConfidence: parsed.scenarioConfidence,
    parameters,
    painPoints: parsed.painPoints,
    missingQuestions: normalizeQuestions(parsed.missingQuestions),
    lead: parsed.lead,
    skillResults: normalizeSkillResults(parsed.skillResults),
  };

  return {
    analysis,
    model: {
      provider: config.provider,
      model: config.model,
    },
  };
}
