import { prisma } from "../db.js";
import type { EmailSender, SendEmailInput, SendEmailResult } from "./types.js";

/** Outbound mock sender only — email is not an inquiry intake channel. */
export class MockOutboundAdapter implements EmailSender {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const providerMessageId = `mock-out-${Date.now()}`;
    await prisma.emailMessage.create({
      data: {
        direction: "outbound",
        provider: "mock",
        providerMessageId,
        toAddr: input.to,
        fromAddr: input.from ?? "sales@example-transformer.com",
        subject: input.subject,
        body: input.body,
        status: "mock_sent",
        sentAt: new Date(),
        inquiryId: input.inquiryId,
        customerId: input.customerId,
      },
    });
    return { provider: "mock", providerMessageId, status: "mock_sent" };
  }
}

export const emailAdapter = new MockOutboundAdapter();
