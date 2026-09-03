import { prisma } from "../db.js";

export async function writeAudit(input: {
  actor: string;
  action: string;
  objectType: string;
  objectId?: string;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      actor: input.actor,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      beforeJson: input.before == null ? null : JSON.stringify(input.before),
      afterJson: input.after == null ? null : JSON.stringify(input.after),
    },
  });
}

export function getActor(headers: Record<string, unknown>): string {
  const raw = headers["x-actor"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "sales_demo";
}
