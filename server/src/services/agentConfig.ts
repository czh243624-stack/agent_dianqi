import { prisma } from "../db.js";

export type AgentConfigDTO = {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  enabled: boolean;
  systemPrompt: string | null;
  modelProvider: string;
  modelName: string;
  temperature: number;
  channels: string[];
  extra: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeAgent(row: {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  enabled: boolean;
  systemPrompt: string | null;
  modelProvider: string;
  modelName: string;
  temperature: number;
  channelsJson: string;
  extraJson: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): AgentConfigDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    description: row.description,
    enabled: row.enabled,
    systemPrompt: row.systemPrompt,
    modelProvider: row.modelProvider,
    modelName: row.modelName,
    temperature: row.temperature,
    channels: parseJson(row.channelsJson, [] as string[]),
    extra: parseJson(row.extraJson, {} as Record<string, unknown>),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const DEFAULT_AGENTS = [
  {
    code: "inquiry_reply",
    name: "变压器询盘回复 Agent",
    type: "inquiry",
    description: "识别变压器询盘意图、产品类型、应用场景和关键参数，检索企业知识库后生成英文回复草稿，并沉淀客户档案。",
    enabled: true,
    systemPrompt:
      "You are the inquiry reply Agent for Liaoning EFACEC Electrical Equipment Co., Ltd. Understand the buyer intent, transformer type, application scenario, and quotation readiness. Extract rated voltage, HV, LV, capacity, frequency, vector group, OLTC requirement, impedance, IEC standard, installation altitude, quantity, destination, delivery requirement, and certification requirement. Use only retrieved company knowledge. Source priority: official catalogue, then official datasheet, then human-approved historical materials, then human confirmation. If a fact is not in the current database, say: Information not available in the current database. We will need to confirm this with our sales/engineering team before providing a final commitment. For first replies, thank the buyer, summarize identified demand, list known parameters, ask missing parameters in priority order, and request the technical specification if available. Payment terms are negotiable and will be confirmed by sales. Quotation validity will be stated in the formal quotation. Mark urgent delivery requests as Urgent and route to sales/production; do not invent a shorter lead time. A-grade leads should be flagged for human sales follow-up within 24 hours. Never invent models, certifications, impedance, prices, delivery dates, factory cases, project photos, payment ratios, warranty years, or technical commitments. Never disclose cost, margin, floor price, commissions, unreleased schedules, unauthorized drawings/test reports, customer databases, or account credentials. All final price, delivery, certification scope, payment, warranty, and contractual commitments require human approval.",
    modelProvider: "api",
    modelName: "configured-ai-model",
    temperature: 0.2,
    channelsJson: JSON.stringify(["manual", "website_form", "alibaba"]),
    sortOrder: 1,
  },
  {
    code: "seo_content",
    name: "内容推广",
    type: "seo",
    description: "按产品型号和关键词，生成英文介绍、常见问题与社交文案，审核后发布。",
    enabled: false,
    systemPrompt:
      "You are an industrial SEO content writer for transformer exporters. Use only verified product facts from the knowledge base. Produce English blog structure, meta, FAQ and social captions. Never invent certification numbers or performance values.",
    modelProvider: "rules",
    modelName: "local-rules",
    temperature: 0.4,
    channelsJson: JSON.stringify(["manual"]),
    sortOrder: 2,
  },
  {
    code: "video_publish",
    name: "短视频制作",
    type: "video",
    description: "根据产品卖点生成短视频脚本与成片，审核后发布到海外平台。",
    enabled: false,
    systemPrompt:
      "You are a product video producer for transformer export marketing. Create short English scripts with accurate technical terms. Prefer real factory assets over invented visuals.",
    modelProvider: "rules",
    modelName: "local-rules",
    temperature: 0.5,
    channelsJson: JSON.stringify(["manual"]),
    sortOrder: 3,
  },
];

export async function ensureDefaultAgents() {
  for (const agent of DEFAULT_AGENTS) {
    await prisma.agentConfig.upsert({
      where: { code: agent.code },
      create: agent,
      update: {},
    });
  }

  // Drop retired email intake channel from existing inquiry agent config.
  const inquiry = await prisma.agentConfig.findUnique({ where: { code: "inquiry_reply" } });
  if (inquiry) {
    try {
      const channels = JSON.parse(inquiry.channelsJson || "[]") as string[];
      const next = channels.filter((c) => c !== "email");
      if (next.length !== channels.length) {
        await prisma.agentConfig.update({
          where: { id: inquiry.id },
          data: { channelsJson: JSON.stringify(next) },
        });
      }
    } catch {
      /* ignore bad json */
    }
  }
}

export async function getAgentByCode(code: string) {
  const row = await prisma.agentConfig.findUnique({ where: { code } });
  return row ? serializeAgent(row) : null;
}

export async function getSettingMap() {
  const rows = await prisma.systemSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function ensureDefaultSettings() {
  const defaults: Record<string, string> = {
    company_name: "Liaoning EFACEC Electrical Equipment Co., Ltd.",
    company_name_cn: "辽宁易发式电气设备有限公司",
    company_website: "http://www.leeec.com",
    company_english_site: "new.leeec.com",
    sales_from_email: "",
    sales_signature: "Export Sales | Liaoning EFACEC Electrical Equipment Co., Ltd.",
    require_human_approval: "true",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}
