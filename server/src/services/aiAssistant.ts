import { prisma } from "../db.js";
import { assertAiConfigured, type AiRuntimeConfig } from "./aiConfig.js";
import { toPlainReply } from "./plainReply.js";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnswerLanguage = "zh" | "en";

type CountItem = {
  name: string;
  count: number;
};

type AssistantSnapshot = {
  generatedAt: string;
  period: {
    last30DaysStart: string;
    monthStart: string;
  };
  inquiries: {
    total: number;
    last30Days: number;
    currentMonth: number;
    pending: number;
    sent: number;
    byStatus: CountItem[];
    byChannel: CountItem[];
    byLeadGrade: CountItem[];
    byProductType: CountItem[];
    byCountry: CountItem[];
  };
  customers: {
    total: number;
    byLeadGrade: CountItem[];
    openFollowUps: number;
  };
  knowledge: {
    products: number;
    certifications: number;
    documents: number;
    officialWebsiteDocuments: number;
  };
  salesNote: string;
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): CountItem[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item)?.trim() || "未填写";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getAssistantSnapshot(): Promise<AssistantSnapshot> {
  const now = new Date();
  const last30DaysStart = new Date(now);
  last30DaysStart.setDate(last30DaysStart.getDate() - 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [inquiries, customers, products, certifications, documents, officialWebsiteDocuments] = await Promise.all([
    prisma.inquiry.findMany({
      select: {
        status: true,
        channel: true,
        leadGrade: true,
        productType: true,
        buyerCountry: true,
        createdAt: true,
      },
    }),
    prisma.customer.findMany({
      select: {
        leadGrade: true,
        followUpStatus: true,
      },
    }),
    prisma.product.count(),
    prisma.certification.count(),
    prisma.knowledgeDocument.count(),
    prisma.knowledgeDocument.count({
      where: { sourceType: { startsWith: "official_website" } },
    }),
  ]);

  const pendingStatuses = new Set(["new", "analyzing", "pending_review", "approved", "rejected"]);
  const last30 = inquiries.filter((item) => item.createdAt >= last30DaysStart);
  const currentMonth = inquiries.filter((item) => item.createdAt >= monthStart);

  return {
    generatedAt: now.toISOString(),
    period: {
      last30DaysStart: isoDate(last30DaysStart),
      monthStart: isoDate(monthStart),
    },
    inquiries: {
      total: inquiries.length,
      last30Days: last30.length,
      currentMonth: currentMonth.length,
      pending: inquiries.filter((item) => pendingStatuses.has(item.status)).length,
      sent: inquiries.filter((item) => item.status === "sent").length,
      byStatus: countBy(inquiries, (item) => item.status),
      byChannel: countBy(inquiries, (item) => item.channel),
      byLeadGrade: countBy(inquiries, (item) => item.leadGrade),
      byProductType: countBy(inquiries, (item) => item.productType),
      byCountry: countBy(inquiries, (item) => item.buyerCountry),
    },
    customers: {
      total: customers.length,
      byLeadGrade: countBy(customers, (item) => item.leadGrade),
      openFollowUps: customers.filter((item) => item.followUpStatus !== "closed").length,
    },
    knowledge: {
      products,
      certifications,
      documents,
      officialWebsiteDocuments,
    },
    salesNote:
      "当前系统记录询盘、客户、AI 分析、审核和发送状态；尚未接入订单、回款、成交金额字段。因此业绩问答只能基于询盘处理、客户评级、产品需求和跟进状态分析，不应编造销售额。",
  };
}

function buildPrompt(question: string, snapshot: AssistantSnapshot, history: ChatMessage[], language: AnswerLanguage) {
  const recentHistory = history.slice(-8);
  const languageInstruction =
    language === "en"
      ? "Answer in English. Keep product names, model names, certification names, lead grades, channel/status codes, and technical terms exactly as provided in the data. Use plain text only: no Markdown, no **bold**, no headings, no backticks. Use short paragraphs and numbered lists."
      : "回答要用中文，简洁、直接，给业务员可执行建议。但产品型号、产品类型、认证名称、Lead Grade A/B/C、RAG、HV/LV、Capacity、Frequency、Vector Group、OLTC、Impedance、IEC 等硬性业务数据和技术术语保留英文，不要强行翻译。";
  return {
    system:
      `你是辽宁易发式电气外贸业务后台的 AI 数据助手。你只能根据系统提供的真实业务数据回答，不得编造询盘、客户、销售额、订单或回款。用户问“最近一个月”时，按最近 30 天理解，并同时说明当前系统日期和统计区间。当前系统还没有订单/成交金额表，所以业绩只能按询盘量、待处理量、客户等级、产品需求和跟进状态分析。${languageInstruction} 回复必须是纯文本：不要使用 Markdown，不要出现 **、__、##、\`\`\`、\` 或项目符号 *。用短段落和换行组织，需要列举时用 1. 2. 3.。`,
    user: JSON.stringify(
      {
        question,
        answerLanguage: language,
        currentData: snapshot,
        recentConversation: recentHistory,
      },
      null,
      2,
    ),
  };
}

function normalizeBaseUrl(baseUrl: string, provider: AiRuntimeConfig["provider"]) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  if (!trimmed) throw new Error("AI_BASE_URL_REQUIRED");
  if (provider === "deepseek") return `${trimmed}/chat/completions`;
  if (provider === "openai" || provider === "qwen" || provider === "custom") return `${trimmed}/chat/completions`;
  return trimmed;
}

async function callChatCompletions(config: AiRuntimeConfig, system: string, user: string) {
  const endpoint = normalizeBaseUrl(config.baseUrl, config.provider);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI_SERVICE_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI_OUTPUT_PARSE_FAILED");
  return content;
}

async function callClaude(config: AiRuntimeConfig, system: string, user: string) {
  const endpoint = `${config.baseUrl.replace(/\/+$/g, "")}/v1/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 1200,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI_SERVICE_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = data.content?.find((item) => item.type === "text" || item.text)?.text?.trim();
  if (!content) throw new Error("AI_OUTPUT_PARSE_FAILED");
  return content;
}

export async function askAiAssistant(question: string, history: ChatMessage[] = [], language: AnswerLanguage = "zh") {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("QUESTION_REQUIRED");

  const [config, snapshot] = await Promise.all([assertAiConfigured(), getAssistantSnapshot()]);
  const prompt = buildPrompt(trimmed, snapshot, history, language);
  const answer =
    config.provider === "claude"
      ? await callClaude(config, prompt.system, prompt.user)
      : await callChatCompletions(config, prompt.system, prompt.user);

  return {
    answer: toPlainReply(answer),
    snapshot,
    model: {
      provider: config.provider,
      model: config.model,
    },
  };
}
