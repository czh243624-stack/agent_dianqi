export type InquiryChannel = "website_form" | "alibaba" | "manual";

export type NormalizedInquiry = {
  channel: InquiryChannel;
  externalId?: string;
  buyerCompany?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerCountry?: string;
  rawText: string;
  receivedAt?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  from?: string;
  inquiryId?: string;
  customerId?: string;
};

export type SendEmailResult = {
  provider: string;
  providerMessageId: string;
  status: "mock_sent" | "sent" | "failed";
};

export interface InquiryIntakeAdapter {
  channel: InquiryChannel;
  pullOrReceive(payload?: unknown): Promise<NormalizedInquiry[]>;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
