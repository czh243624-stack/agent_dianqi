import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SITE_BASE = "https://www.leeec.com";
const SITEMAP_URL = `${SITE_BASE}/sitemap.xml`;
const VERSION = `official-site-crawl-${new Date().toISOString().slice(0, 10)}`;
const MAX_PAGES = Number(process.env.LEEEC_CRAWL_MAX_PAGES || 300);

function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(input: string) {
  return decodeEntities(input)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(html: string) {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|p|div|li|tr|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractTitle(html: string, fallbackUrl: string) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const clean = title ? stripHtml(title).replace(/\s*-\s*辽宁易发式电气设备有限公司\s*$/i, "") : "";
  if (clean) return clean.slice(0, 120);
  return fallbackUrl.replace(SITE_BASE, "") || "LEEEC official website page";
}

function parseSitemap(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g))
    .map((match) => decodeEntities(match[1].trim()))
    .filter((url) => url.startsWith(SITE_BASE))
    .filter((url) => !/\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|zip)$/i.test(url));
}

function classify(url: string, title: string, text: string) {
  if (/products_31|[?&]product[=/]/i.test(url)) {
    return "official_website_product_page";
  }
  if (/cases_28|case/i.test(url)) {
    return "official_website_certification_page";
  }
  if (/news_|article/i.test(url)) {
    return "official_website_news_page";
  }
  if (/pages_39|contact/i.test(url)) {
    return "official_website_contact_page";
  }
  if (/aboutus|pages_26|pages_27|company/i.test(url)) {
    return "official_website_company_page";
  }
  const haystack = `${url} ${title} ${text}`;
  if (/products_31|product|电力变压器|干式变压器|移动变电站|预装式变电站|箱式变压器/i.test(haystack)) {
    return "official_website_product_page";
  }
  if (/cases_28|资质|证书|认证|KEMA|ASTA|CTQC|SGS|Rheinland|莱茵/i.test(haystack)) {
    return "official_website_certification_page";
  }
  if (/news_|新闻|送电|扩建|项目/i.test(haystack)) {
    return "official_website_news_page";
  }
  if (/contact|联系我们/i.test(haystack)) {
    return "official_website_contact_page";
  }
  if (/about|pages_26|企业简介|历史沿革|企业荣誉/i.test(haystack)) {
    return "official_website_company_page";
  }
  return "official_website_page";
}

function makeTags(sourceType: string, title: string, text: string) {
  const tags = new Set<string>(["official website", "LEEEC"]);
  tags.add(sourceType.replace("official_website_", "").replace(/_/g, " "));
  for (const [pattern, tag] of [
    [/电力变压器|power transformer/i, "power transformer"],
    [/干式变压器|dry[-\s]?type|cast resin/i, "dry-type transformer"],
    [/移动变电站|mobile substation/i, "mobile substation"],
    [/预装式变电站|prefabricated substation/i, "prefabricated substation"],
    [/箱式变压器|box[-\s]?type|compact substation/i, "box-type transformer"],
    [/认证|证书|KEMA|ASTA|CTQC|SGS|Rheinland|莱茵/i, "certification"],
    [/Saudi|沙特|GCC|中东/i, "Middle East"],
    [/Nigeria|尼日利亚|Africa|非洲/i, "Africa"],
    [/EPC|总承包/i, "EPC"],
  ] as Array<[RegExp, string]>) {
    if (pattern.test(`${title} ${text}`)) tags.add(tag);
  }
  return Array.from(tags);
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "LEEEC-Agent-Knowledge-Crawler/0.1 (+authorized project import)",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function upsertPage(url: string, html: string) {
  const title = extractTitle(html, url);
  const text = stripHtml(html);
  if (text.length < 120) return "skipped";

  const sourceType = classify(url, title, text);
  const content = `Source URL: ${url}\n\n${text}`;
  const tags = makeTags(sourceType, title, text);
  const existing = await prisma.knowledgeDocument.findFirst({
    where: {
      sourceType,
      title,
    },
  });

  const data = {
    sourceType,
    title,
    content,
    tagsJson: JSON.stringify(tags),
    visibility: "public_reference",
    version: VERSION,
  };

  const existingByUrl = await prisma.knowledgeDocument.findFirst({
    where: {
      content: { startsWith: `Source URL: ${url}` },
    },
  });
  const target = existingByUrl ?? existing;

  if (target) {
    await prisma.knowledgeDocument.update({ where: { id: target.id }, data });
    return "updated";
  }
  await prisma.knowledgeDocument.create({ data });
  return "created";
}

async function main() {
  const sitemap = await fetchText(SITEMAP_URL);
  const urls = parseSitemap(sitemap).slice(0, MAX_PAGES);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const result = await upsertPage(url, html);
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Failed to crawl ${url}: ${(error as Error).message}`);
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: "leeec_website_last_crawled_at" },
    create: { key: "leeec_website_last_crawled_at", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  console.log("LEEEC website crawl completed.");
  console.log(`Sitemap pages scanned: ${urls.length}`);
  console.log(`Knowledge documents created: ${created}`);
  console.log(`Knowledge documents updated: ${updated}`);
  console.log(`Pages skipped: ${skipped}`);
  console.log(`Pages failed: ${failed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
