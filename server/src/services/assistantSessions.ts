import { prisma } from "../db.js";
import { askAiAssistant } from "./aiAssistant.js";

const INTRO = {
  zh: "我是外贸业务 AI 助手。你可以问询盘数量、待回复客户、A/B/C 客户、变压器需求类型、重点国家和跟进建议。",
  en: "I am the export business AI Assistant. You can ask about inquiry volume, pending buyers, A/B/C leads, transformer demand, key markets, and follow-up suggestions.",
} as const;

function defaultTitle(language: "zh" | "en") {
  return language === "en" ? "New chat" : "新会话";
}

function titleFromQuestion(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}…` : compact;
}

export function serializeMessage(row: { id: string; role: string; content: string; createdAt: Date }) {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSession(
  row: {
    id: string;
    title: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
    messages?: Array<{ id: string; role: string; content: string; createdAt: Date }>;
    _count?: { messages: number };
  },
  options?: { includeMessages?: boolean },
) {
  const messages = row.messages ?? [];
  const firstUser = messages.find((item) => item.role === "user");
  return {
    id: row.id,
    title: row.title,
    language: row.language === "en" ? "en" : "zh",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row._count?.messages ?? messages.length,
    preview: firstUser?.content || messages[0]?.content || "",
    ...(options?.includeMessages ? { messages: messages.map(serializeMessage) } : {}),
  };
}

export async function listAssistantSessions() {
  const items = await prisma.assistantSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 3 },
    },
  });
  return items.map((item) => serializeSession(item));
}

export async function getAssistantSession(id: string) {
  const row = await prisma.assistantSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new Error("SESSION_NOT_FOUND");
  return serializeSession(row, { includeMessages: true });
}

export async function createAssistantSession(language: "zh" | "en" = "zh", userId?: string) {
  const row = await prisma.assistantSession.create({
    data: {
      title: defaultTitle(language),
      language,
      userId: userId || null,
      messages: {
        create: {
          role: "assistant",
          content: INTRO[language],
        },
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return serializeSession(row, { includeMessages: true });
}

export async function renameAssistantSession(id: string, title: string) {
  const next = title.trim();
  if (!next) throw new Error("TITLE_REQUIRED");
  const exists = await prisma.assistantSession.findUnique({ where: { id } });
  if (!exists) throw new Error("SESSION_NOT_FOUND");
  const row = await prisma.assistantSession.update({
    where: { id },
    data: { title: next.slice(0, 40) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return serializeSession(row, { includeMessages: true });
}

export async function deleteAssistantSession(id: string) {
  const exists = await prisma.assistantSession.findUnique({ where: { id } });
  if (!exists) throw new Error("SESSION_NOT_FOUND");
  await prisma.assistantSession.delete({ where: { id } });
  return { ok: true };
}

export async function chatInSession(id: string, question: string, language: "zh" | "en" = "zh") {
  const session = await prisma.assistantSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new Error("SESSION_NOT_FOUND");

  const history = session.messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));

  const result = await askAiAssistant(question, history, language);
  const shouldRename = session.title === defaultTitle("zh") || session.title === defaultTitle("en");

  await prisma.$transaction([
    prisma.assistantChatMessage.create({
      data: { sessionId: id, role: "user", content: question.trim() },
    }),
    prisma.assistantChatMessage.create({
      data: { sessionId: id, role: "assistant", content: result.answer },
    }),
    prisma.assistantSession.update({
      where: { id },
      data: {
        language,
        title: shouldRename ? titleFromQuestion(question) : undefined,
      },
    }),
  ]);

  const updated = await getAssistantSession(id);
  return {
    ...result,
    session: updated,
  };
}
