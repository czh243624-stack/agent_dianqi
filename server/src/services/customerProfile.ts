import { prisma } from "../db.js";
import type { InquiryAnalysis } from "./transformerAnalyzer.js";

export type CustomerProfileSnapshot = {
  company: string | null;
  country: string | null;
  channel: string;
  leadGrade: string;
  productInterest: string;
  applicationScenario: string;
  lastIntent: string;
  followUpStatus: string;
  nextAction: string;
};

export async function updateCustomerProfileFromInquiry(input: {
  inquiryId: string;
  customerId: string | null;
  channel: string;
  buyerCompany: string | null;
  buyerCountry: string | null;
  analysis: InquiryAnalysis;
  actor: string;
}): Promise<CustomerProfileSnapshot> {
  const nextAction = input.analysis.lead.advice;
  const company = input.buyerCompany || "Unknown Buyer";
  let customerId = input.customerId ?? undefined;

  if (!customerId) {
    const created = await prisma.customer.create({
      data: {
        company,
        country: input.buyerCountry,
        channel: input.channel,
        leadGrade: input.analysis.lead.grade,
        productInterest: input.analysis.productType,
        applicationScenario: input.analysis.applicationScenario,
        lastIntent: input.analysis.businessIntent,
        followUpStatus: "open",
        notes: input.analysis.lead.reasons.join("; "),
      },
    });
    customerId = created.id;
    await prisma.inquiry.update({ where: { id: input.inquiryId }, data: { customerId } });
  } else {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        country: input.buyerCountry ?? undefined,
        channel: input.channel,
        leadGrade: input.analysis.lead.grade,
        productInterest: input.analysis.productType,
        applicationScenario: input.analysis.applicationScenario,
        lastIntent: input.analysis.businessIntent,
        followUpStatus: "open",
        notes: input.analysis.lead.reasons.join("; "),
      },
    });
  }

  await prisma.customerTouchpoint.create({
    data: {
      customerId,
      inquiryId: input.inquiryId,
      channel: input.channel,
      direction: "inbound",
      actor: input.actor,
      summary: `${input.analysis.businessIntent}; ${input.analysis.productType}; ${input.analysis.applicationScenario}; lead ${input.analysis.lead.grade}`,
      nextAction,
    },
  });

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  return {
    company: customer?.company ?? company,
    country: customer?.country ?? input.buyerCountry,
    channel: customer?.channel ?? input.channel,
    leadGrade: input.analysis.lead.grade,
    productInterest: input.analysis.productType,
    applicationScenario: input.analysis.applicationScenario,
    lastIntent: input.analysis.businessIntent,
    followUpStatus: customer?.followUpStatus ?? "open",
    nextAction,
  };
}
