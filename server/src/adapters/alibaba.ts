import { prisma } from "../db.js";
import type { InquiryIntakeAdapter, NormalizedInquiry } from "./types.js";

/**
 * 阿里国际站接入占位。
 * 后续把 Open API 凭证接到这里，实现真实 sync，无需改路由。
 */
export class AlibabaStubAdapter implements InquiryIntakeAdapter {
  channel = "alibaba" as const;

  async pullOrReceive(): Promise<NormalizedInquiry[]> {
    const inbox = await prisma.integrationInbox.findMany({
      where: { channel: "alibaba", processed: false },
      orderBy: { createdAt: "asc" },
    });

    const items: NormalizedInquiry[] = [];
    for (const row of inbox) {
      const payload = JSON.parse(row.payloadJson) as NormalizedInquiry;
      items.push({ ...payload, channel: "alibaba", externalId: row.externalId ?? row.id });
      await prisma.integrationInbox.update({
        where: { id: row.id },
        data: { processed: true },
      });
    }
    return items;
  }
}

export const alibabaAdapter = new AlibabaStubAdapter();
