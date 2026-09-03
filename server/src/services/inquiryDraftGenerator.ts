import { z } from "zod";
import { assertAiConfigured } from "./aiConfig.js";
import { callAiText, parseAiJsonObject } from "./aiClient.js";
import type { RetrievalHit } from "./knowledgeRetrieval.js";
import type { InquiryAnalysis } from "./transformerAnalyzer.js";

const DraftSchema = z.object({
  draftReply: z.string().min(80),
});

export async function generateInquiryDraftWithAi(input: {
  inquiry: {
    buyerName: string | null;
    buyerCompany: string | null;
    buyerCountry: string | null;
    rawText: string;
  };
  analysis: InquiryAnalysis;
  hits: RetrievalHit[];
  signature: string;
  companyName: string;
  fromEmail: string;
  website?: string;
}) {
  const config = await assertAiConfigured();
  const sourceSummary = input.hits.slice(0, 8).map((hit) => ({
    type: hit.sourceType,
    title: hit.title,
    snippet: hit.snippet,
    version: hit.version,
  }));
  const system =
    "You are the sales reply drafting Skill for a transformer export inquiry Agent. Write a professional English reply draft for a salesperson to review. Use only the buyer inquiry, AI semantic analysis, and retrieved company references provided. Do not invent price, delivery date, certification scope, warranty, model capability, test report, project case, or contractual commitment. If a product type or scenario is inferred, phrase it as a preliminary understanding and ask the buyer to confirm. Always ask missing quotation-critical parameters in priority order. Return compact valid JSON only, with no markdown.";
  const user = JSON.stringify(
      {
        buyer: input.inquiry,
        analysis: input.analysis,
        retrievedReferences: sourceSummary,
        signature: input.signature,
        companyName: input.companyName,
        fromEmail: input.fromEmail,
        website: input.website,
        requiredOutput: {
          draftReply:
            "Complete English email draft. Include greeting, thanks, preliminary understanding, known parameters, prioritized clarification questions, reference/attachment suggestion, next step, and signature.",
        },
      },
      null,
      2,
    );

  let draftReply: string;
  try {
    const content = await callAiText(config, {
      temperature: 0.15,
      maxTokens: 2500,
      system,
      user,
    });
    draftReply = DraftSchema.parse(parseAiJsonObject<unknown>(content)).draftReply;
  } catch {
    const repaired = await callAiText(config, {
      temperature: 0,
      maxTokens: 2500,
      system: `${system}\n\nYour previous output could not be parsed. Return only: {"draftReply":"..."}.`,
      user,
    });
    try {
      draftReply = DraftSchema.parse(parseAiJsonObject<unknown>(repaired)).draftReply;
    } catch {
      throw new Error("AI_OUTPUT_PARSE_FAILED");
    }
  }

  return {
    draftReply,
    model: {
      provider: config.provider,
      model: config.model,
    },
  };
}
