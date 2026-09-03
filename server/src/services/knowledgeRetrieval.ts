import { prisma } from "../db.js";
import type { InquiryAnalysis } from "./transformerAnalyzer.js";

export type RetrievalHit = {
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  version?: string | null;
  score: number;
};

const CJK_STOP = new Set([
  "客户",
  "小时",
  "公司",
  "我们",
  "产品",
  "关于",
  "首页",
  "新闻",
  "动态",
  "联系",
  "下载",
  "人才",
  "中文",
  "电气",
  "设备",
  "有限",
  "辽宁",
  "工作",
  "员工",
  "家属",
  "进行",
  "发展",
  "技术",
  "企业",
  "电话",
  "传真",
  "地址",
  "邮箱",
  "简体",
  "语言",
  "英文",
  "页面",
  "版权",
  "中心",
  "集团",
  "责任",
  "股份",
]);

const NEWS_SOURCE_TYPES = new Set(["official_website_news_page"]);

function isNewsQuery(query: string) {
  return /新闻|动态|春节|慰问|倡议|剪彩|喜讯|送电仪式|上梁/.test(query);
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function primaryTokens(input: string): string[] {
  const lower = input.toLowerCase();
  const out: string[] = [];

  for (const token of lower.match(/[a-z][a-z0-9.%/-]{1,}/g) ?? []) {
    if (token.length >= 3 || /^(ce|ul|hv|lv|ip|gb|bs|an|af)$/.test(token)) out.push(token);
  }

  for (const token of lower.match(/\d+\s*(?:小时|hours?|h|kv|kva|mva)/g) ?? []) {
    out.push(token.replace(/\s+/g, ""));
  }

  for (const run of lower.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    if (!CJK_STOP.has(run)) out.push(run);
  }

  for (const grade of lower.match(/[abc]\s*级/g) ?? []) {
    out.push(grade.replace(/\s+/g, ""));
  }

  return unique(out);
}

function expandTokens(query: string, base: string[]): string[] {
  const extra: string[] = [];
  if (/a\s*级|a\s*类|a-?\s*grade|\bagrade\b/i.test(query)) extra.push("a-grade", "a级", "grade a");
  if (/b\s*级|b\s*类|b-?\s*grade/i.test(query)) extra.push("b-grade", "b级");
  if (/c\s*级|c\s*类|c-?\s*grade/i.test(query)) extra.push("c-grade", "c级");
  if (/24\s*小时|24\s*hours?|24h/i.test(query)) extra.push("24 hours", "24小时", "within 24");
  if (/紧急|交期|urgent|rush/i.test(query)) extra.push("urgent", "delivery", "lead time", "交期");
  if (/付款|payment/i.test(query)) extra.push("payment terms", "negotiable", "付款");
  if (/认证|证书|ce\b|iec|iso/i.test(query)) extra.push("certification", "certificate", "ce");
  return unique([...base, ...extra]);
}

function containsToken(haystack: string, token: string): boolean {
  if (/^[abc]级$/.test(token) || /^[abc]-grade$/.test(token)) {
    const escaped = token.replace("-", "\\-");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9])`).test(haystack);
  }
  if (token.length <= 2 && /^[a-z0-9]+$/.test(token)) {
    return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(token);
}

function fieldScore(title: string, body: string, tokensToMatch: string[]): { score: number; matched: number } {
  const titleLower = title.toLowerCase();
  const bodyLower = body.toLowerCase();
  let score = 0;
  let matched = 0;
  for (const token of tokensToMatch) {
    if (containsToken(titleLower, token)) {
      score += token.length <= 2 ? 4 : 8;
      matched += 1;
    } else if (containsToken(bodyLower, token)) {
      score += token.length <= 2 ? 1 : 3;
      matched += 1;
    }
  }
  return { score, matched };
}

function boostKnowledgeSource(sourceType: string, queryText: string): number {
  const query = queryText.toLowerCase();
  let boost = 0;
  if (sourceType === "testing_capability" && /routine|type test|special test|test report|certificate|试验|报告/.test(query)) {
    boost += 12;
  }
  if (sourceType === "packing_shipping_after_sales" && /shipping|packing|delivery|transport|after[-\s]?sales|warranty|commission|spare|售后|运输|包装|质保/.test(query)) {
    boost += 12;
  }
  if (sourceType === "market_customer_profile" && /north america|middle east|gcc|africa|south america|europe|ansi|ieee|60hz|北美|中东|非洲|南美|欧洲/.test(query)) {
    boost += 10;
  }
  if (sourceType === "risk_customer_policy" && /risk|fraud|scam|payment|sensitive|blacklist|风险|诈骗|付款/.test(query)) {
    boost += 10;
  }
  if (sourceType === "lead_grading_policy" && /rfq|lead|grade|a-grade|b-grade|c-grade|a级|b级|c级|24小时|跟进|评级/.test(query)) {
    boost += 16;
  }
  if (sourceType === "certification_note" && /certification|certificate|iec|iso|pccc|kema|asta|ul|csa|saso|ce\b|认证|证书/.test(query)) {
    boost += 8;
  }
  if (sourceType === "sales_reply_policy" && /reply|response|email|wording|follow[-\s]?up|thank you|template|回复|话术|追问/.test(query)) {
    boost += 8;
  }
  if (sourceType === "first_reply_template" && /thank you|inquiry|first reply|email|template|follow[-\s]?up|回复|首封|话术/.test(query)) {
    boost += 12;
  }
  if (sourceType === "commercial_terms_policy" && /payment|validity|quotation|incoterm|commercial|付款|有效期|报价/.test(query)) {
    boost += 12;
  }
  if (sourceType === "delivery_rule" && /urgent|rush|delivery|lead time?|交期|紧急/.test(query)) {
    boost += 12;
  }
  if (sourceType === "internal_data_policy" && /cost|margin|floor|commission|drawing|credential|internal|blacklist|成本|毛利|图纸/.test(query)) {
    boost += 12;
  }
  if (sourceType === "manual_entry" && /manual|录入|资料|faq|政策/.test(query)) {
    boost += 4;
  }
  if (NEWS_SOURCE_TYPES.has(sourceType) && !isNewsQuery(queryText)) {
    boost -= 20;
  }
  return boost;
}

function capacityNumber(analysis?: InquiryAnalysis): number | null {
  if (!analysis) return null;
  const raw = analysis.parameters.find((p) => p.key === "capacity" && !p.missing)?.value;
  if (!raw) return null;
  const value = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(value)) return null;
  return /mva/i.test(raw) ? value * 1000 : value;
}

const SOURCE_PRIORITY: Record<string, number> = {
  product: 5,
  lead_grading_policy: 5,
  official_website_product_capability: 5,
  official_website_power_transformer: 5,
  official_website_dry_transformer: 5,
  official_website_mobile_substation: 5,
  official_website_prefabricated_substation: 5,
  official_website_box_transformer: 5,
  faq: 4,
  first_reply_template: 4,
  product_scope: 4,
  product_data_policy: 4,
  manual_entry: 4,
  official_website_company_profile: 3,
  official_website_export_markets: 3,
  delivery_rule: 3,
  commercial_terms_policy: 3,
  certification_note: 3,
  official_website_quality_certification: 3,
  testing_capability: 3,
  packing_shipping_after_sales: 3,
  market_customer_profile: 3,
  certification: 2,
  human_review_policy: 2,
  risk_customer_policy: 2,
  sales_reply_policy: 2,
  quote_rule: 1,
  quote_history: 1,
  internal_data_policy: 1,
  official_website_news_page: 0,
};

export async function searchKnowledgeBase(
  queryText: string,
  options?: { analysis?: InquiryAnalysis; limit?: number },
): Promise<RetrievalHit[]> {
  const query = queryText.trim();
  if (!query) return [];

  const baseTokens = primaryTokens(query);
  const queryTokens = expandTokens(query, baseTokens);
  if (!queryTokens.length) return [];

  const analysis = options?.analysis;
  const limit = Math.min(30, Math.max(1, options?.limit ?? 12));
  const cap = capacityNumber(analysis);
  const hv = analysis?.parameters.find((p) => p.key === "hv" && !p.missing)?.value.replace(/\s+/g, "");
  const productType = (analysis?.productType ?? "").toLowerCase();
  const allowNews = isNewsQuery(query);

  const [products, certs, quoteRules, quotes, docs] = await Promise.all([
    prisma.product.findMany({ include: { specs: true, certLinks: { include: { certification: true } } } }),
    prisma.certification.findMany({ take: 80, orderBy: { updatedAt: "desc" } }),
    prisma.quoteRule.findMany({ take: 20, orderBy: { updatedAt: "desc" } }),
    prisma.historicalQuote.findMany({ include: { product: true, customer: true }, take: 20, orderBy: { quotedAt: "desc" } }),
    prisma.knowledgeDocument.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  const hits: RetrievalHit[] = [];
  const minScore = 4;

  for (const product of products) {
    const title = `${product.model} ${product.type}`;
    const body = [
      product.capacityKva,
      product.voltagePrim,
      product.voltageSec,
      product.frequency,
      product.cooling,
      product.standard,
      product.summary,
      ...product.specs.map((s) => `${s.name} ${s.value} ${s.unit ?? ""}`),
    ].join(" ");
    let { score } = fieldScore(title, body, queryTokens);
    if (cap && product.capacityKva === cap) score += 40;
    if (cap && product.capacityKva && product.capacityKva !== cap) score -= Math.min(12, Math.abs(product.capacityKva - cap) / 100);
    if (hv && product.voltagePrim?.replace(/\s+/g, "").toLowerCase().includes(hv.toLowerCase().replace("kv", ""))) score += 4;
    if (/dry/.test(productType) && /dry|SCB/i.test(`${product.type} ${product.model}`)) score += 5;
    if (/oil/.test(productType) && /oil|S1|S13|immersed/i.test(`${product.type} ${product.summary}`)) score += 5;
    if (score >= minScore) {
      hits.push({
        sourceType: "product",
        sourceId: product.id,
        title: `${product.model} product data`,
        snippet: product.summary ?? `${product.type} ${product.capacityKva ?? ""} kVA ${product.voltagePrim ?? ""}/${product.voltageSec ?? ""}`,
        version: "catalog",
        score,
      });
      for (const link of product.certLinks) {
        hits.push({
          sourceType: "certification",
          sourceId: link.certification.id,
          title: link.certification.name,
          snippet: link.certification.summary ?? link.certification.modelScope ?? "",
          version: link.certification.validUntil?.toISOString().slice(0, 10) ?? null,
          score: score - 5,
        });
      }
    }
  }

  for (const cert of certs) {
    const { score } = fieldScore(cert.name, `${cert.market ?? ""} ${cert.modelScope ?? ""} ${cert.summary ?? ""}`, queryTokens);
    if (score >= minScore) {
      hits.push({
        sourceType: "certification",
        sourceId: cert.id,
        title: cert.name,
        snippet: cert.summary ?? cert.modelScope ?? "",
        version: cert.validUntil?.toISOString().slice(0, 10) ?? null,
        score,
      });
    }
  }

  for (const rule of quoteRules) {
    const { score } = fieldScore(`Quotation rule ${rule.productType}`, `${rule.region ?? ""} ${rule.note ?? ""}`, queryTokens);
    if (score >= minScore || (productType && /oil/.test(productType) && score > 0)) {
      hits.push({
        sourceType: "quote_rule",
        sourceId: rule.id,
        title: `Quotation rule - ${rule.productType}${rule.region ? ` / ${rule.region}` : ""}`,
        snippet: rule.note ?? `Currency ${rule.currency}, valid ${rule.validDays} days, approver ${rule.approver ?? "sales manager"}`,
        version: "internal",
        score: score + 1,
      });
    }
  }

  for (const quote of quotes) {
    const { score } = fieldScore(
      `${quote.product?.model ?? ""} historical quote`,
      `${quote.customerRegion ?? ""} ${quote.product?.type ?? ""} ${quote.product?.summary ?? ""}`,
      queryTokens,
    );
    if (score >= minScore || (cap && quote.product?.capacityKva === cap)) {
      hits.push({
        sourceType: "quote_history",
        sourceId: quote.id,
        title: `Historical quote reference - ${quote.customerRegion ?? "export"}`,
        snippet: `${quote.product?.model ?? "product"} | ${quote.currency} ${quote.price} | ${quote.incoterm ?? "Incoterm N/A"} | ${quote.result ?? "result N/A"}`,
        version: "restricted",
        score: score + (cap && quote.product?.capacityKva === cap ? 5 : 0),
      });
    }
  }

  for (const doc of docs) {
    if (NEWS_SOURCE_TYPES.has(doc.sourceType) && !allowNews) continue;
    const { score: textScore, matched } = fieldScore(doc.title, `${doc.content} ${doc.tagsJson}`, queryTokens);
    if (!matched) continue;
    const score = textScore + boostKnowledgeSource(doc.sourceType, query);
    if (score >= minScore) {
      hits.push({
        sourceType: doc.sourceType,
        sourceId: doc.id,
        title: doc.title,
        snippet: doc.content.slice(0, 260),
        version: doc.version,
        score,
      });
    }
  }

  const seen = new Set<string>();
  return hits
    .sort((a, b) => b.score - a.score || (SOURCE_PRIORITY[b.sourceType] ?? 0) - (SOURCE_PRIORITY[a.sourceType] ?? 0))
    .filter((hit) => {
      if (hit.score < minScore) return false;
      const key = `${hit.sourceType}:${hit.sourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function retrieveKnowledgeForInquiry(rawText: string, analysis: InquiryAnalysis): Promise<RetrievalHit[]> {
  const queryText = [
    rawText,
    analysis.productType,
    analysis.applicationScenario,
    ...analysis.parameters.filter((p) => !p.missing).map((p) => p.value),
  ].join(" ");
  return searchKnowledgeBase(queryText, { analysis, limit: 8 });
}
