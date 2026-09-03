import { prisma } from "../db.js";
import type { NormalizedInquiry } from "../adapters/types.js";
import { writeAudit } from "../lib/audit.js";
import { getAgentByCode, getSettingMap } from "./agentConfig.js";
import { updateCustomerProfileFromInquiry } from "./customerProfile.js";
import { retrieveKnowledgeForInquiry, type RetrievalHit } from "./knowledgeRetrieval.js";
import { generateInquiryDraftWithAi } from "./inquiryDraftGenerator.js";
import { analyzeTransformerInquiryWithAi } from "./semanticInquiryAnalyzer.js";
import type { InquiryAnalysis, ParameterItem } from "./transformerAnalyzer.js";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeInquiry(inquiry: {
  id: string;
  channel: string;
  externalId: string | null;
  customerId: string | null;
  buyerCompany: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerCountry: string | null;
  rawText: string;
  extractedJson: string | null;
  painPointsJson: string | null;
  missingQuestionsJson: string | null;
  businessIntent?: string | null;
  intentConfidence?: number | null;
  productType?: string | null;
  productTypeConfidence?: number | null;
  productTypeNeedsConfirmation?: boolean | null;
  applicationScenario?: string | null;
  scenarioConfidence?: number | null;
  semanticSummary?: string | null;
  parameterChecklistJson?: string | null;
  analysisSkillsJson?: string | null;
  leadGrade?: string | null;
  leadScore?: number | null;
  leadReasonsJson?: string | null;
  followUpAdvice?: string | null;
  customerProfileJson?: string | null;
  recommendedModel: string | null;
  quoteHint: string | null;
  draftReply: string | null;
  status: string;
  owner: string | null;
  createdAt: Date;
  updatedAt: Date;
  sourceHits?: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    title: string;
    snippet: string;
    version: string | null;
  }>;
  customer?: {
    id: string;
    company: string;
    country: string | null;
    email: string | null;
    leadGrade?: string | null;
    productInterest?: string | null;
    applicationScenario?: string | null;
    lastIntent?: string | null;
    followUpStatus?: string | null;
  } | null;
}) {
  return {
    id: inquiry.id,
    channel: inquiry.channel,
    externalId: inquiry.externalId,
    customerId: inquiry.customerId,
    buyerCompany: inquiry.buyerCompany,
    buyerName: inquiry.buyerName,
    buyerEmail: inquiry.buyerEmail,
    buyerCountry: inquiry.buyerCountry,
    rawText: inquiry.rawText,
    extracted: normalizeSerializedParameters(parseJson(inquiry.extractedJson, [] as ParameterItem[])),
    painPoints: parseJson(inquiry.painPointsJson, [] as Array<{ label: string; level: string; evidence?: string }>),
    missingQuestions: parseJson(inquiry.missingQuestionsJson, [] as string[]),
    businessIntent: inquiry.businessIntent ?? null,
    intentConfidence: inquiry.intentConfidence ?? null,
    productType: inquiry.productType ?? null,
    productTypeConfidence: inquiry.productTypeConfidence ?? null,
    productTypeNeedsConfirmation: inquiry.productTypeNeedsConfirmation ?? false,
    applicationScenario: inquiry.applicationScenario ?? null,
    scenarioConfidence: inquiry.scenarioConfidence ?? null,
    semanticSummary: inquiry.semanticSummary ?? null,
    parameterChecklist: normalizeSerializedParameters(parseJson(inquiry.parameterChecklistJson, [] as ParameterItem[])),
    analysisSkills: parseJson(inquiry.analysisSkillsJson, [] as NonNullable<InquiryAnalysis["skillResults"]>),
    leadGrade: inquiry.leadGrade ?? null,
    leadScore: inquiry.leadScore ?? null,
    leadReasons: parseJson(inquiry.leadReasonsJson, [] as string[]),
    followUpAdvice: inquiry.followUpAdvice ?? null,
    customerProfile: parseJson(inquiry.customerProfileJson, null as unknown),
    recommendedModel: inquiry.recommendedModel,
    quoteHint: inquiry.quoteHint,
    draftReply: inquiry.draftReply,
    status: inquiry.status,
    owner: inquiry.owner,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    sources: (inquiry.sourceHits ?? []).map((s) => ({
      id: s.sourceId,
      type: s.sourceType,
      title: s.title,
      snippet: s.snippet,
      version: s.version,
    })),
    customer: inquiry.customer ?? null,
  };
}

function normalizeSerializedParameters(parameters: ParameterItem[]): ParameterItem[] {
  return parameters.map((param) => ({
    ...param,
    requiredForQuote: param.requiredForQuote ?? param.requiredForQuotation,
  }));
}

export async function createInquiryFromNormalized(
  item: NormalizedInquiry,
  actor: string,
  owner = "sales_demo",
) {
  let customerId: string | undefined;
  if (item.buyerEmail || item.buyerCompany) {
    const existing = item.buyerEmail
      ? await prisma.customer.findFirst({ where: { email: item.buyerEmail } })
      : await prisma.customer.findFirst({ where: { company: item.buyerCompany! } });

    if (existing) {
      customerId = existing.id;
    } else {
      const created = await prisma.customer.create({
        data: {
          company: item.buyerCompany || item.buyerName || "Unknown Buyer",
          country: item.buyerCountry,
          contactName: item.buyerName,
          email: item.buyerEmail,
          channel: item.channel,
        },
      });
      customerId = created.id;
    }
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      channel: item.channel,
      externalId: item.externalId,
      customerId,
      buyerCompany: item.buyerCompany,
      buyerName: item.buyerName,
      buyerEmail: item.buyerEmail,
      buyerCountry: item.buyerCountry,
      rawText: item.rawText,
      status: "new",
      owner,
    },
    include: { sourceHits: true, customer: true },
  });

  await writeAudit({
    actor,
    action: "inquiry.create",
    objectType: "inquiry",
    objectId: inquiry.id,
    after: { channel: inquiry.channel, status: inquiry.status },
  });

  return inquiry;
}

function parameterValue(analysis: InquiryAnalysis, key: string): string | null {
  const item = analysis.parameters.find((p) => p.key === key && !p.missing);
  return item?.value ?? null;
}

function selectedModelTitle(hits: RetrievalHit[]): string | null {
  const product = hits.find((hit) => hit.sourceType === "product");
  if (!product) return null;
  return product.title.replace(/\s*product data$/i, "");
}

function quoteHint(analysis: InquiryAnalysis, hits: RetrievalHit[]): string {
  const quoteRefs = hits.filter((hit) => hit.sourceType === "quote_history" || hit.sourceType === "quote_rule");
  const base =
    "Internal only: do not send historical price, margin, certification scope, or lead time commitment without sales manager review.";
  if (!quoteRefs.length) return base;
  return `${base} ${quoteRefs.length} internal quotation reference(s) matched for sales review.`;
}

export async function analyzeInquiry(inquiryId: string, actor: string) {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry) throw new Error("INQUIRY_NOT_FOUND");

  const agent = await getAgentByCode("inquiry_reply");
  if (agent && !agent.enabled) throw new Error("AGENT_DISABLED");

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "analyzing" },
  });

  const aiResult = await analyzeTransformerInquiryWithAi(inquiry.rawText, {
    buyerCompany: inquiry.buyerCompany,
    buyerEmail: inquiry.buyerEmail,
    buyerCountry: inquiry.buyerCountry,
  });
  const analysis = aiResult.analysis;
  const hits = await retrieveKnowledgeForInquiry(inquiry.rawText, analysis);
  const settings = await getSettingMap();
  const signature = settings.sales_signature || "Export Sales | Transformer Division";
  const fromEmail = settings.sales_from_email || "";
  const companyName = settings.company_name || "[Company Name]";
  const website = settings.company_english_site || settings.company_website || "";

  await prisma.inquirySourceHit.deleteMany({ where: { inquiryId } });
  if (hits.length) {
    await prisma.inquirySourceHit.createMany({
      data: hits.map((hit) => ({
        inquiryId,
        sourceType: hit.sourceType,
        sourceId: hit.sourceId,
        title: hit.title,
        snippet: hit.snippet,
        version: hit.version,
      })),
    });
  }

  const customerProfile = await updateCustomerProfileFromInquiry({
    inquiryId,
    customerId: inquiry.customerId,
    channel: inquiry.channel,
    buyerCompany: inquiry.buyerCompany,
    buyerCountry: inquiry.buyerCountry,
    analysis,
    actor,
  });

  const recommendedModel = selectedModelTitle(hits);
  const draftResult = await generateInquiryDraftWithAi({
    inquiry,
    analysis,
    hits,
    signature,
    companyName,
    fromEmail,
    website,
  });
  const draftReply = draftResult.draftReply;

  const updated = await prisma.inquiry.update({
    where: { id: inquiryId },
    data: {
      status: "pending_review",
      extractedJson: JSON.stringify(analysis.parameters),
      painPointsJson: JSON.stringify(analysis.painPoints),
      missingQuestionsJson: JSON.stringify(analysis.missingQuestions),
      businessIntent: analysis.businessIntent,
      intentConfidence: analysis.intentConfidence,
      productType: analysis.productType,
      productTypeConfidence: analysis.productTypeConfidence,
      productTypeNeedsConfirmation: analysis.productTypeNeedsConfirmation ?? false,
      applicationScenario: analysis.applicationScenario,
      scenarioConfidence: analysis.scenarioConfidence,
      semanticSummary: analysis.semanticSummary,
      parameterChecklistJson: JSON.stringify(analysis.parameters),
      analysisSkillsJson: JSON.stringify(analysis.skillResults ?? []),
      leadGrade: analysis.lead.grade,
      leadScore: analysis.lead.score,
      leadReasonsJson: JSON.stringify(analysis.lead.reasons),
      followUpAdvice: analysis.lead.advice,
      customerProfileJson: JSON.stringify(customerProfile),
      recommendedModel,
      quoteHint: quoteHint(analysis, hits),
      draftReply,
    },
    include: { sourceHits: true, customer: true },
  });

  await writeAudit({
    actor,
    action: "inquiry.analyze",
    objectType: "inquiry",
    objectId: inquiryId,
    after: {
      status: updated.status,
      businessIntent: analysis.businessIntent,
      productType: analysis.productType,
      applicationScenario: analysis.applicationScenario,
      leadGrade: analysis.lead.grade,
      leadScore: analysis.lead.score,
      recommendedModel,
      agentCode: agent?.code ?? "inquiry_reply",
      modelProvider: aiResult.model.provider,
      modelName: aiResult.model.model,
      draftModelProvider: draftResult.model.provider,
      draftModelName: draftResult.model.model,
    },
  });

  return updated;
}

export async function approveInquiry(inquiryId: string, actor: string, comment?: string) {
  const before = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
  if (!before) throw new Error("INQUIRY_NOT_FOUND");
  if (!before.draftReply) throw new Error("DRAFT_REQUIRED");

  const after = await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "approved" },
    include: { sourceHits: true, customer: true },
  });

  await prisma.approvalRecord.create({
    data: {
      objectType: "inquiry",
      objectId: inquiryId,
      inquiryId,
      action: "approve",
      actor,
      comment,
      beforeJson: JSON.stringify({ status: before.status, draftReply: before.draftReply }),
      afterJson: JSON.stringify({ status: after.status, draftReply: after.draftReply }),
    },
  });

  await writeAudit({
    actor,
    action: "inquiry.approve",
    objectType: "inquiry",
    objectId: inquiryId,
    before: { status: before.status },
    after: { status: after.status },
  });

  return after;
}

export async function rejectInquiry(inquiryId: string, actor: string, comment?: string) {
  const before = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
  if (!before) throw new Error("INQUIRY_NOT_FOUND");

  const after = await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "rejected" },
    include: { sourceHits: true, customer: true },
  });

  await prisma.approvalRecord.create({
    data: {
      objectType: "inquiry",
      objectId: inquiryId,
      inquiryId,
      action: "reject",
      actor,
      comment: comment ?? "Rejected for revision",
      beforeJson: JSON.stringify({ status: before.status }),
      afterJson: JSON.stringify({ status: after.status }),
    },
  });

  await writeAudit({
    actor,
    action: "inquiry.reject",
    objectType: "inquiry",
    objectId: inquiryId,
    before: { status: before.status },
    after: { status: after.status },
  });

  return after;
}
