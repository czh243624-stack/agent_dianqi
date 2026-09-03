import type { InquiryIntakeAdapter, NormalizedInquiry } from "./types.js";

type FormPayload = {
  company?: string;
  name?: string;
  email?: string;
  country?: string;
  message?: string;
  product?: string;
};

export class WebsiteFormAdapter implements InquiryIntakeAdapter {
  channel = "website_form" as const;

  async pullOrReceive(payload?: unknown): Promise<NormalizedInquiry[]> {
    const body = (payload ?? {}) as FormPayload;
    const parts = [
      body.company ? `Company: ${body.company}` : null,
      body.name ? `Contact: ${body.name}` : null,
      body.email ? `Email: ${body.email}` : null,
      body.country ? `Country: ${body.country}` : null,
      body.product ? `Product interest: ${body.product}` : null,
      "",
      body.message ?? "",
    ].filter((x) => x !== null);

    return [
      {
        channel: "website_form",
        buyerCompany: body.company,
        buyerName: body.name,
        buyerEmail: body.email,
        buyerCountry: body.country,
        rawText: parts.join("\n").trim(),
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}

export const websiteFormAdapter = new WebsiteFormAdapter();
