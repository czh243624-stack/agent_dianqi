import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fakeBuyerCompanies = [
  "WestPower Engineering Ltd.",
  "Gulf Grid Solutions",
  "Andes Energy SpA",
  "Gulf Grid EPC LLC",
  "East Africa Airport Engineering",
  "Lagos Emergency Power Services",
  "Andes Mining Power SpA",
  "Lagos Utility Traders",
];

const fakeEmails = [
  "a.okonkwo@westpower.ng",
  "omar.hassan@gulfgrid.ae",
  "m.lopez@andesenergy.cl",
  "ahmed.khalid@example-gulf.com",
  "daniel.mwangi@example-airport.com",
  "chinedu.okafor@example-lagos.com",
  "maria.lopez@example-andes.com",
  "buyer@lagosutility.ng",
  "sales@example-transformer.com",
];

const fakeProductModels = [
  "S13-M-500/33",
  "S13-M-800/33",
  "S11-M-1000/11",
  "S13-M-250/11",
  "SZ11-1600/35",
  "SCB10-500/10",
  "S13-M-315/10",
  "S13-M-630/33",
  "S11-M-2000/35",
  "SCB12-800/10",
];

const fakeCertificationNames = [
  "IEC 60076 Type Test Summary",
  "CE Declaration",
  "UL Reference Pack",
];

const fakeKnowledgeTitles = [
  "FAQ - Parameters required before transformer quotation",
  "Delivery reference - standard oil-immersed distribution transformer",
  "Certification note - IEC 60076 wording",
  "Sales playbook - A/B/C lead handling",
];

async function main() {
  const fakeInquiries = await prisma.inquiry.findMany({
    where: {
      OR: [
        { externalId: { startsWith: "leeec-demo-" } },
        { externalId: "ali-inq-7788" },
        { buyerCompany: { in: fakeBuyerCompanies } },
        { buyerEmail: { in: fakeEmails } },
      ],
    },
    select: { id: true },
  });
  const inquiryIds = fakeInquiries.map((item) => item.id);

  const fakeCustomers = await prisma.customer.findMany({
    where: {
      OR: [{ company: { in: fakeBuyerCompanies } }, { email: { in: fakeEmails } }],
    },
    select: { id: true },
  });
  const customerIds = fakeCustomers.map((item) => item.id);

  const fakeProducts = await prisma.product.findMany({
    where: { model: { in: fakeProductModels } },
    select: { id: true },
  });
  const productIds = fakeProducts.map((item) => item.id);

  const fakeCertifications = await prisma.certification.findMany({
    where: { name: { in: fakeCertificationNames } },
    select: { id: true },
  });
  const certificationIds = fakeCertifications.map((item) => item.id);

  const deleted = {
    sourceHits: inquiryIds.length
      ? await prisma.inquirySourceHit.deleteMany({ where: { inquiryId: { in: inquiryIds } } })
      : { count: 0 },
    approvals: inquiryIds.length
      ? await prisma.approvalRecord.deleteMany({ where: { inquiryId: { in: inquiryIds } } })
      : { count: 0 },
    touchpoints:
      inquiryIds.length || customerIds.length
        ? await prisma.customerTouchpoint.deleteMany({
            where: {
              OR: [
                ...(inquiryIds.length ? [{ inquiryId: { in: inquiryIds } }] : []),
                ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
              ],
            },
          })
        : { count: 0 },
    emails: await prisma.emailMessage.deleteMany({
      where: {
        OR: [
          { provider: "mock" },
          { fromAddr: { in: fakeEmails } },
          { toAddr: { in: fakeEmails } },
          ...(inquiryIds.length ? [{ inquiryId: { in: inquiryIds } }] : []),
          ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
        ],
      },
    }),
    inquiries: inquiryIds.length
      ? await prisma.inquiry.deleteMany({ where: { id: { in: inquiryIds } } })
      : { count: 0 },
    integrationInbox: await prisma.integrationInbox.deleteMany({
      where: {
        OR: [
          { externalId: "ali-inq-7788" },
          { payloadJson: { contains: "Lagos Utility Traders" } },
          { payloadJson: { contains: "WestPower Engineering" } },
          { payloadJson: { contains: "example-" } },
        ],
      },
    }),
    historicalQuotes:
      productIds.length || customerIds.length
        ? await prisma.historicalQuote.deleteMany({
            where: {
              OR: [
                ...(productIds.length ? [{ productId: { in: productIds } }] : []),
                ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
                { customerRegion: { in: ["Nigeria", "UAE", "Chile"] } },
              ],
            },
          })
        : await prisma.historicalQuote.deleteMany({}),
    quoteRules: await prisma.quoteRule.deleteMany({
      where: {
        OR: [
          { note: { contains: "非洲市场常规 500 kVA" } },
          { note: { contains: "中东项目常要求额外型式试验资料" } },
        ],
      },
    }),
    certificationLinks:
      productIds.length || certificationIds.length
        ? await prisma.certificationProduct.deleteMany({
            where: {
              OR: [
                ...(productIds.length ? [{ productId: { in: productIds } }] : []),
                ...(certificationIds.length ? [{ certificationId: { in: certificationIds } }] : []),
              ],
            },
          })
        : { count: 0 },
    productSpecs: productIds.length
      ? await prisma.productSpec.deleteMany({ where: { productId: { in: productIds } } })
      : { count: 0 },
    products: productIds.length
      ? await prisma.product.deleteMany({ where: { id: { in: productIds } } })
      : { count: 0 },
    certifications: certificationIds.length
      ? await prisma.certification.deleteMany({ where: { id: { in: certificationIds } } })
      : { count: 0 },
    customers: customerIds.length
      ? await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })
      : { count: 0 },
    fakeKnowledge: await prisma.knowledgeDocument.deleteMany({
      where: {
        OR: [{ title: { in: fakeKnowledgeTitles } }, { version: "v1" }],
      },
    }),
    auditLogs: await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actor: "sales_demo" },
          { actor: "codex_check" },
          { afterJson: { contains: "Example Transformer" } },
          { beforeJson: { contains: "Example Transformer" } },
          { afterJson: { contains: "leeec-demo-" } },
          { beforeJson: { contains: "leeec-demo-" } },
        ],
      },
    }),
  };

  console.log("Demo data cleanup completed.");
  for (const [name, result] of Object.entries(deleted)) {
    console.log(`${name}: ${result.count}`);
  }
  console.log(`Remaining inquiries: ${await prisma.inquiry.count()}`);
  console.log(`Remaining customers: ${await prisma.customer.count()}`);
  console.log(`Remaining products: ${await prisma.product.count()}`);
  console.log(`Remaining certifications: ${await prisma.certification.count()}`);
  console.log(`Remaining knowledge documents: ${await prisma.knowledgeDocument.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
