import { readSession } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type InquiryStatus =
  | "new"
  | "analyzing"
  | "pending_review"
  | "approved"
  | "sent"
  | "rejected";

export type ParameterItem = {
  key: string;
  label: string;
  value: string;
  confidence?: number;
  missing?: boolean;
  requiredForQuote?: boolean;
  requiredForQuotation?: boolean;
  group?: string;
  source?: "buyer_text" | "semantic_inference" | "knowledge_base" | "not_provided";
  evidence?: string;
  interpretation?: "explicit" | "inferred" | "mentioned_not_requirement" | "missing";
  needsConfirmation?: boolean;
};

export type AnalysisSkill = {
  code: string;
  name: string;
  status: string;
  priority?: "high" | "medium" | "low";
  confidence: number;
  evidence: string[];
  result: string;
  nextAction?: string;
  warnings?: string[];
};

export type SourceHit = {
  id: string;
  type: string;
  title: string;
  snippet: string;
  version?: string | null;
};

export type CustomerSummary = {
  id: string;
  company: string;
  country?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  channel?: string | null;
  leadGrade?: string | null;
  productInterest?: string | null;
  applicationScenario?: string | null;
  lastIntent?: string | null;
  followUpStatus?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { inquiries?: number; touchpoints?: number };
};

export type Inquiry = {
  id: string;
  channel: string;
  buyerCompany?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerCountry?: string | null;
  rawText: string;
  extracted: ParameterItem[];
  painPoints: Array<{ label: string; level: string; evidence?: string }>;
  missingQuestions: string[];
  businessIntent?: string | null;
  intentConfidence?: number | null;
  productType?: string | null;
  productTypeConfidence?: number | null;
  productTypeNeedsConfirmation?: boolean | null;
  applicationScenario?: string | null;
  scenarioConfidence?: number | null;
  semanticSummary?: string | null;
  analysisSkills?: AnalysisSkill[];
  parameterChecklist: ParameterItem[];
  leadGrade?: string | null;
  leadScore?: number | null;
  leadReasons: string[];
  followUpAdvice?: string | null;
  customerProfile?: Record<string, unknown> | null;
  recommendedModel?: string | null;
  quoteHint?: string | null;
  draftReply?: string | null;
  status: InquiryStatus;
  owner?: string | null;
  sources: SourceHit[];
  customer?: CustomerSummary | null;
  customerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  model: string;
  type: string;
  capacityKva?: number | null;
  voltagePrim?: string | null;
  voltageSec?: string | null;
  frequency?: string | null;
  cooling?: string | null;
  standard?: string | null;
  summary?: string | null;
};

export type Certification = {
  id: string;
  name: string;
  market?: string | null;
  modelScope?: string | null;
  validUntil?: string | null;
  summary?: string | null;
};

export type KnowledgeDocument = {
  id: string;
  sourceType: string;
  title: string;
  content: string;
  tags: string[];
  visibility: string;
  version?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRecord = {
  id: string;
  objectType: string;
  objectId: string;
  inquiryId?: string | null;
  action: string;
  actor: string;
  comment?: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  objectType: string;
  objectId?: string | null;
  createdAt: string;
  beforeJson?: string | null;
  afterJson?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Actor": readSession()?.username || "sales_demo",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("后端 API 不可达，请先启动 server（端口 3001）");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const payload = err as { error?: string; message?: string };
    throw new Error(payload.message || payload.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function listInquiries(params?: {
  page?: number;
  pageSize?: number;
  channel?: string;
  status?: string;
  leadGrade?: string;
  q?: string;
  sort?: string;
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.channel) search.set("channel", params.channel);
  if (params?.status) search.set("status", params.status);
  if (params?.leadGrade) search.set("leadGrade", params.leadGrade);
  if (params?.q) search.set("q", params.q);
  if (params?.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return request<{
    items: Inquiry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>(`/inquiries${qs ? `?${qs}` : ""}`);
}

export function getInquiry(id: string) {
  return request<Inquiry>(`/inquiries/${id}`);
}

export function createInquiry(body: {
  rawText: string;
  channel?: string;
  buyerCompany?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerCountry?: string;
}) {
  return request<Inquiry>("/inquiries", { method: "POST", body: JSON.stringify(body) });
}

export function analyzeInquiry(id: string) {
  return request<Inquiry>(`/inquiries/${id}/analyze`, { method: "POST", body: "{}" });
}

export function updateInquiry(
  id: string,
  body: { draftReply?: string; missingQuestions?: string[] },
) {
  return request<Inquiry>(`/inquiries/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function approveInquiry(id: string, comment?: string) {
  return request<Inquiry>(`/inquiries/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function rejectInquiry(id: string, comment?: string) {
  return request<Inquiry>(`/inquiries/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function sendInquiry(id: string) {
  return request<{ inquiry: Inquiry }>(`/inquiries/${id}/send`, { method: "POST", body: "{}" });
}

export function syncAlibaba() {
  return request<{ created: Inquiry[]; count: number; note?: string }>("/integrations/alibaba/sync", {
    method: "POST",
    body: "{}",
  });
}

export function listCustomers() {
  return request<{ items: CustomerSummary[] }>("/customers");
}

export function getCustomer(id: string) {
  return request<
    CustomerSummary & {
      inquiries: Inquiry[];
      touchpoints: Array<{
        id: string;
        channel: string;
        direction: string;
        summary: string;
        actor?: string | null;
        nextAction?: string | null;
        createdAt: string;
      }>;
      emails: Array<{
        id: string;
        direction: string;
        subject?: string | null;
        status: string;
        createdAt: string;
      }>;
    }
  >(`/customers/${id}`);
}

export function listProducts() {
  return request<{ items: Product[] }>("/products");
}

export function listCertifications() {
  return request<{ items: Certification[] }>("/certifications");
}

export function createProduct(body: {
  model: string;
  type: string;
  capacityKva?: number;
  voltagePrim?: string;
  voltageSec?: string;
  frequency?: string;
  cooling?: string;
  standard?: string;
  summary?: string;
}) {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(body) });
}

export function createCertification(body: {
  name: string;
  market?: string;
  modelScope?: string;
  validUntil?: string;
  summary?: string;
}) {
  return request<Certification>("/certifications", { method: "POST", body: JSON.stringify(body) });
}

export function listKnowledgeDocuments(params?: { page?: number; pageSize?: number; q?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return request<{
    items: KnowledgeDocument[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>(`/knowledge-documents${qs ? `?${qs}` : ""}`);
}

export function createKnowledgeDocument(body: {
  sourceType?: string;
  title: string;
  content: string;
  tags?: string[];
  visibility?: string;
  version?: string;
}) {
  return request<KnowledgeDocument>("/knowledge-documents", { method: "POST", body: JSON.stringify(body) });
}

export function updateKnowledgeDocument(
  id: string,
  body: {
    sourceType?: string;
    title?: string;
    content?: string;
    tags?: string[];
    visibility?: string;
    version?: string;
  },
) {
  return request<KnowledgeDocument>(`/knowledge-documents/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export type KnowledgeSearchHit = {
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  version?: string | null;
  score: number;
};

export function searchKnowledge(q: string, limit = 12) {
  const search = new URLSearchParams({ q, limit: String(limit) });
  return request<{ query: string; items: KnowledgeSearchHit[]; total: number }>(`/knowledge/search?${search.toString()}`);
}

export function listApprovals() {
  return request<{ items: ApprovalRecord[] }>("/approvals");
}

export function listAuditLogs() {
  return request<{ items: AuditLog[] }>("/audit-logs");
}

export type AgentConfig = {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  enabled: boolean;
  channels: string[];
  sortOrder: number;
};

export function listAgents() {
  return request<{ items: AgentConfig[] }>("/agents");
}

export function getSettings() {
  return request<{ items: Array<{ key: string; value: string }>; map: Record<string, string> }>("/settings");
}

export type AiConfig = {
  provider: "deepseek" | "qwen" | "openai" | "claude" | "custom";
  model: string;
  baseUrl: string;
  mode: "api";
  requireConfigured: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export type AiAssistantSnapshot = {
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
    byStatus: Array<{ name: string; count: number }>;
    byChannel: Array<{ name: string; count: number }>;
    byLeadGrade: Array<{ name: string; count: number }>;
    byProductType: Array<{ name: string; count: number }>;
    byCountry: Array<{ name: string; count: number }>;
  };
  customers: {
    total: number;
    byLeadGrade: Array<{ name: string; count: number }>;
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

export type AiAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getAiConfig() {
  return request<AiConfig>("/ai-config");
}

export function updateAiConfig(body: {
  provider?: AiConfig["provider"];
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  requireConfigured?: boolean;
}) {
  return request<AiConfig>("/ai-config", { method: "PUT", body: JSON.stringify(body) });
}

export function getAiAssistantSnapshot() {
  return request<AiAssistantSnapshot>("/ai-assistant/snapshot");
}

export function askAiAssistant(body: { question: string; history: AiAssistantMessage[]; language?: "zh" | "en" }) {
  return request<{
    answer: string;
    snapshot: AiAssistantSnapshot;
    model: { provider: string; model: string };
  }>("/ai-assistant/chat", { method: "POST", body: JSON.stringify(body) });
}

export type WorkbenchUser = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  avatarText: string;
  avatarUrl?: string | null;
};

export function loginWorkbench(username: string, password: string) {
  return request<{ user: WorkbenchUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getWorkbenchProfile() {
  return request<{ user: WorkbenchUser }>("/auth/me");
}

export function updateWorkbenchProfile(body: {
  displayName?: string;
  title?: string;
  avatarUrl?: string | null;
  clearAvatar?: boolean;
  currentPassword?: string;
  newPassword?: string;
}) {
  return request<{ user: WorkbenchUser }>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type AssistantSessionSummary = {
  id: string;
  title: string;
  language: "zh" | "en";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
  messages?: Array<AiAssistantMessage & { id: string; createdAt: string }>;
};

export function listAssistantSessions() {
  return request<{ items: AssistantSessionSummary[] }>("/ai-assistant/sessions");
}

export function createAssistantSession(language: "zh" | "en" = "zh") {
  return request<AssistantSessionSummary>("/ai-assistant/sessions", {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

export function getAssistantSession(id: string) {
  return request<AssistantSessionSummary>(`/ai-assistant/sessions/${id}`);
}

export function renameAssistantSession(id: string, title: string) {
  return request<AssistantSessionSummary>(`/ai-assistant/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteAssistantSession(id: string) {
  return request<{ ok: boolean }>(`/ai-assistant/sessions/${id}`, { method: "DELETE" });
}

export function chatAssistantSession(id: string, body: { question: string; language?: "zh" | "en" }) {
  return request<{
    answer: string;
    snapshot: AiAssistantSnapshot;
    model: { provider: string; model: string };
    session: AssistantSessionSummary;
  }>(`/ai-assistant/sessions/${id}/chat`, { method: "POST", body: JSON.stringify(body) });
}

/** Fetch inquiries across pages for dashboard aggregation (cap pages to avoid overload). */
export async function listAllInquiriesForDashboard(pageSize = 50, maxPages = 20) {
  const first = await listInquiries({ page: 1, pageSize, sort: "createdAt_desc" });
  const items = [...first.items];
  const totalPages = Math.min(first.totalPages, maxPages);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listInquiries({ page, pageSize, sort: "createdAt_desc" });
    items.push(...next.items);
  }
  return { items, total: first.total, fetched: items.length };
}

export const STATUS_LABEL: Record<string, string> = {
  new: "未分析",
  analyzing: "分析中",
  pending_review: "待审核",
  approved: "已通过",
  sent: "已发送",
  rejected: "已退回",
};

export const CHANNEL_LABEL: Record<string, string> = {
  manual: "手动粘贴",
  website_form: "独立站",
  alibaba: "阿里国际站",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  product: "产品资料",
  certification: "认证资料",
  faq: "FAQ",
  company_profile: "公司资料",
  product_scope: "产品范围",
  product_data_policy: "产品资料规则",
  certification_note: "认证口径",
  sales_reply_policy: "回复口径",
  first_reply_template: "首封回复模板",
  quote_rule: "报价规则",
  commercial_terms_policy: "付款与报价有效期",
  delivery_rule: "交期规则",
  lead_time: "交期规则",
  lead_grading_policy: "客户评级",
  website_intake_policy: "独立站接入",
  alibaba_permission_checklist: "阿里权限清单",
  human_review_policy: "人审规则",
  market_customer_profile: "区域客户画像",
  testing_capability: "试验能力",
  packing_shipping_after_sales: "包装运输售后",
  risk_customer_policy: "风险客户",
  internal_data_policy: "内部资料黑名单",
  official_website_company_profile: "官网公司资料",
  official_website_product_capability: "官网产品能力",
  official_website_export_markets: "官网出口市场",
  official_website_quality_certification: "官网认证线索",
  official_website_power_transformer: "官网电力变压器",
  official_website_dry_transformer: "官网干式变压器",
  official_website_mobile_substation: "官网移动变电站",
  official_website_prefabricated_substation: "官网预装式变电站",
  official_website_box_transformer: "官网箱变",
  official_website_contact: "官网联系方式",
  official_website_capacity_expansion: "官网产能扩建",
  official_website_product_page: "官网产品页",
  official_website_certification_page: "官网资质页",
  official_website_news_page: "官网新闻页",
  official_website_contact_page: "官网联系页",
  official_website_company_page: "官网公司页",
  official_website_page: "官网页面",
  quote_history: "历史报价参考",
  policy: "对外口径",
  knowledge: "参考资料",
  manual_entry: "人工录入",
};

export function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
