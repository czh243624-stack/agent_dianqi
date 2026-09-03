import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_INQUIRY = `Dear Sir/Madam,

We are looking for oil immersed distribution transformers for a substation upgrade project in Lagos, Nigeria.

Requirement:
- Capacity: 500 kVA
- Primary voltage: 33 kV
- Secondary voltage: 0.415 kV
- Frequency: 50 Hz
- Quantity: 3 units
- Standard: IEC 60076 preferred
- Delivery: urgently needed for Q4 installation

Please advise available models, lead time, certification, and rough quotation.
Also confirm if ONAN cooling and off-circuit tap changer are available.

Best regards,
Adebayo Okonkwo
Procurement Engineer
WestPower Engineering Ltd.
Email: a.okonkwo@westpower.ng`;

async function main() {
  await prisma.inquirySourceHit.deleteMany();
  await prisma.customerTouchpoint.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.integrationInbox.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.historicalQuote.deleteMany();
  await prisma.quoteRule.deleteMany();
  await prisma.certificationProduct.deleteMany();
  await prisma.productSpec.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  const westPower = await prisma.customer.create({
    data: {
      company: "WestPower Engineering Ltd.",
      country: "Nigeria",
      contactName: "Adebayo Okonkwo",
      email: "a.okonkwo@westpower.ng",
      channel: "manual",
      notes: "Lagos substation upgrade project",
    },
  });

  await prisma.customer.create({
    data: {
      company: "Gulf Grid Solutions",
      country: "UAE",
      contactName: "Omar Hassan",
      email: "omar.hassan@gulfgrid.ae",
      channel: "alibaba",
    },
  });

  await prisma.customer.create({
    data: {
      company: "Andes Energy SpA",
      country: "Chile",
      contactName: "Maria Lopez",
      email: "m.lopez@andesenergy.cl",
      channel: "website_form",
    },
  });

  const p500 = await prisma.product.create({
    data: {
      model: "S13-M-500/33",
      type: "油浸式配电变压器",
      capacityKva: 500,
      voltagePrim: "33kV",
      voltageSec: "0.415kV",
      frequency: "50Hz",
      cooling: "ONAN",
      phase: "3",
      standard: "IEC 60076",
      summary: "500 kVA · 33/0.415 kV · 50 Hz · ONAN · Dyn11 optional · IEC 60076",
      specs: {
        create: [
          { name: "vector_group", value: "Dyn11", source: "datasheet" },
          { name: "impedance", value: "4.5", unit: "%", source: "datasheet" },
          { name: "tap_changer", value: "Off-circuit ±2×2.5%", source: "datasheet" },
        ],
      },
    },
  });

  const p800 = await prisma.product.create({
    data: {
      model: "S13-M-800/33",
      type: "油浸式配电变压器",
      capacityKva: 800,
      voltagePrim: "33kV",
      voltageSec: "0.415kV",
      frequency: "50Hz",
      cooling: "ONAN/ONAF",
      phase: "3",
      standard: "IEC 60076",
      summary: "800 kVA oil-immersed distribution transformer for industrial projects",
    },
  });

  const p1000 = await prisma.product.create({
    data: {
      model: "S11-M-1000/11",
      type: "油浸式配电变压器",
      capacityKva: 1000,
      voltagePrim: "11kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "ONAN",
      phase: "3",
      standard: "IEC 60076",
      summary: "1000 kVA 11kV distribution transformer",
    },
  });

  const p250 = await prisma.product.create({
    data: {
      model: "S13-M-250/11",
      type: "油浸式配电变压器",
      capacityKva: 250,
      voltagePrim: "11kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "ONAN",
      phase: "3",
      standard: "IEC 60076",
      summary: "250 kVA compact oil-immersed unit",
    },
  });

  const p1600 = await prisma.product.create({
    data: {
      model: "SZ11-1600/35",
      type: "有载调压变压器",
      capacityKva: 1600,
      voltagePrim: "35kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "ONAN/ONAF",
      phase: "3",
      standard: "IEC 60076",
      summary: "1600 kVA OLTC transformer",
    },
  });

  const dry = await prisma.product.create({
    data: {
      model: "SCB10-500/10",
      type: "干式变压器",
      capacityKva: 500,
      voltagePrim: "10kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "AN",
      phase: "3",
      standard: "IEC 60076",
      summary: "500 kVA cast resin dry-type transformer",
    },
  });

  const p315 = await prisma.product.create({
    data: {
      model: "S13-M-315/10",
      type: "油浸式配电变压器",
      capacityKva: 315,
      voltagePrim: "10kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "ONAN",
      phase: "3",
      standard: "IEC 60076",
      summary: "315 kVA compact oil-immersed distribution transformer",
    },
  });

  const p630 = await prisma.product.create({
    data: {
      model: "S13-M-630/33",
      type: "油浸式配电变压器",
      capacityKva: 630,
      voltagePrim: "33kV",
      voltageSec: "0.415kV",
      frequency: "50Hz",
      cooling: "ONAN",
      phase: "3",
      standard: "IEC 60076",
      summary: "630 kVA 33kV oil-immersed unit for commercial projects",
    },
  });

  const p2000 = await prisma.product.create({
    data: {
      model: "S11-M-2000/35",
      type: "油浸式配电变压器",
      capacityKva: 2000,
      voltagePrim: "35kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "ONAN/ONAF",
      phase: "3",
      standard: "IEC 60076",
      summary: "2000 kVA 35kV oil-immersed power distribution transformer",
    },
  });

  const dry800 = await prisma.product.create({
    data: {
      model: "SCB12-800/10",
      type: "干式变压器",
      capacityKva: 800,
      voltagePrim: "10kV",
      voltageSec: "0.4kV",
      frequency: "50Hz",
      cooling: "AN/AF",
      phase: "3",
      standard: "IEC 60076",
      summary: "800 kVA dry-type transformer for indoor substations",
    },
  });

  const iec = await prisma.certification.create({
    data: {
      name: "IEC 60076 Type Test Summary",
      market: "Global",
      modelScope: "oil-immersed up to 2500 kVA",
      validUntil: new Date("2027-12-31"),
      fileUrl: "/files/iec-60076-summary.pdf",
      summary: "适用于出口市场 2500 kVA 及以下油浸式配电变压器。",
    },
  });

  const ce = await prisma.certification.create({
    data: {
      name: "CE Declaration",
      market: "EU",
      modelScope: "distribution transformers",
      validUntil: new Date("2026-12-31"),
      fileUrl: "/files/ce-declaration.pdf",
      summary: "CE 符合性声明，公开前需人工确认适用范围。",
    },
  });

  const ul = await prisma.certification.create({
    data: {
      name: "UL Reference Pack",
      market: "North America",
      modelScope: "selected dry-type models",
      validUntil: new Date("2026-09-30"),
      fileUrl: "/files/ul-reference.pdf",
      summary: "北美市场参考资料包，正式声明前必须人工核验型号范围。",
    },
  });

  await prisma.certificationProduct.createMany({
    data: [
      { certificationId: iec.id, productId: p500.id },
      { certificationId: iec.id, productId: p800.id },
      { certificationId: iec.id, productId: p1000.id },
      { certificationId: iec.id, productId: p630.id },
      { certificationId: iec.id, productId: p2000.id },
      { certificationId: ce.id, productId: p500.id },
      { certificationId: ce.id, productId: dry.id },
      { certificationId: ce.id, productId: dry800.id },
      { certificationId: ul.id, productId: dry.id },
      { certificationId: ul.id, productId: dry800.id },
      { certificationId: iec.id, productId: p315.id },
    ],
  });

  await prisma.quoteRule.createMany({
    data: [
      {
        productType: "oil_immersed",
        region: "Africa",
        currency: "USD",
        minMargin: 0.18,
        validDays: 15,
        approver: "sales_manager",
        note: "非洲市场常规 500 kVA：生产 25–35 天 + 海运视目的港。",
      },
      {
        productType: "oil_immersed",
        region: "Middle East",
        currency: "USD",
        minMargin: 0.2,
        validDays: 10,
        approver: "sales_manager",
        note: "中东项目常要求额外型式试验资料。",
      },
    ],
  });

  await prisma.historicalQuote.createMany({
    data: [
      {
        customerId: westPower.id,
        productId: p500.id,
        customerRegion: "Nigeria",
        price: 11800,
        currency: "USD",
        quantity: 2,
        incoterm: "FOB",
        result: "won",
      },
      {
        productId: p500.id,
        customerRegion: "Nigeria",
        price: 12200,
        currency: "USD",
        quantity: 3,
        incoterm: "CIF",
        result: "pending",
      },
      {
        productId: p800.id,
        customerRegion: "UAE",
        price: 15600,
        currency: "USD",
        quantity: 1,
        incoterm: "FOB",
        result: "lost",
      },
      {
        productId: p250.id,
        customerRegion: "Chile",
        price: 7800,
        currency: "USD",
        quantity: 4,
        incoterm: "CFR",
        result: "won",
      },
    ],
  });

  await prisma.knowledgeDocument.createMany({
    data: [
      {
        sourceType: "faq",
        title: "FAQ - Parameters required before transformer quotation",
        content:
          "Before preparing a transformer quotation, sales should confirm capacity, HV/LV rated voltage, frequency, vector group, tap changer requirement, short-circuit impedance, applicable standard, installation altitude, quantity, destination port and delivery requirement.",
        tagsJson: JSON.stringify(["quotation", "missing parameters", "HV", "LV", "vector group", "impedance", "altitude"]),
        visibility: "internal",
        version: "v1",
      },
      {
        sourceType: "delivery_rule",
        title: "Delivery reference - standard oil-immersed distribution transformer",
        content:
          "For standard oil-immersed distribution transformers, production lead time is usually estimated after technical confirmation and order approval. Sales must not promise final delivery dates before production planning confirmation.",
        tagsJson: JSON.stringify(["delivery", "oil immersed", "lead time"]),
        visibility: "internal",
        version: "v1",
      },
      {
        sourceType: "certification_note",
        title: "Certification note - IEC 60076 wording",
        content:
          "IEC 60076 can be referenced as the transformer design and test standard only when the selected model and test documents match the requested scope. Certification or type-test wording requires manual review before customer release.",
        tagsJson: JSON.stringify(["IEC 60076", "certification", "type test", "routine test"]),
        visibility: "internal",
        version: "v1",
      },
      {
        sourceType: "sales_playbook",
        title: "Sales playbook - A/B/C lead handling",
        content:
          "A-grade transformer inquiries usually include clear product type, voltage, capacity, quantity, project location or deadline. B-grade inquiries have product direction but need more technical confirmation. C-grade inquiries are broad catalog or price-list requests and should be nurtured with standard product information first.",
        tagsJson: JSON.stringify(["lead grade", "customer profile", "follow up"]),
        visibility: "internal",
        version: "v1",
      },
    ],
  });

  await prisma.inquiry.create({
    data: {
      channel: "manual",
      customerId: westPower.id,
      buyerCompany: "WestPower Engineering Ltd.",
      buyerName: "Adebayo Okonkwo",
      buyerEmail: "a.okonkwo@westpower.ng",
      buyerCountry: "Nigeria",
      rawText: SAMPLE_INQUIRY,
      status: "new",
      owner: "sales_demo",
    },
  });

  await prisma.inquiry.create({
    data: {
      channel: "website_form",
      buyerCompany: "Andes Energy SpA",
      buyerName: "Maria Lopez",
      buyerEmail: "m.lopez@andesenergy.cl",
      buyerCountry: "Chile",
      rawText:
        "Company: Andes Energy SpA\nContact: Maria Lopez\nEmail: m.lopez@andesenergy.cl\nCountry: Chile\nProduct interest: 1000 kVA\n\nPlease quote 1000 kVA 11/0.4 kV oil immersed transformer, quantity 2, IEC preferred.",
      status: "new",
      owner: "sales_demo",
    },
  });

  await prisma.integrationInbox.createMany({
    data: [
      {
        channel: "alibaba",
        externalId: "ali-inq-7788",
        payloadJson: JSON.stringify({
          channel: "alibaba",
          buyerCompany: "Lagos Utility Traders",
          buyerName: "Chinedu Okafor",
          buyerEmail: "buyer@lagosutility.ng",
          buyerCountry: "Nigeria",
          rawText:
            "Alibaba inquiry: Looking for 250 kVA 11kV distribution transformer, oil immersed, for commercial building. Need price and certificate.",
        }),
      },
    ],
  });

  await prisma.emailMessage.create({
    data: {
      direction: "inbound",
      provider: "mock",
      providerMessageId: "mail-001",
      fromAddr: "khalid@desertpower.sa",
      toAddr: "sales@example-transformer.com",
      subject: "RFQ 800 kVA transformer",
      body: "Please see attached inquiry details in pull adapter.",
      status: "received",
    },
  });

  console.log("Seed completed.");
  console.log(`Products: ${await prisma.product.count()}`);
  console.log(`Inquiries: ${await prisma.inquiry.count()}`);
  console.log(`Inbox pending: ${await prisma.integrationInbox.count({ where: { processed: false } })}`);

  // Agent / 系统设置：只补默认项，不覆盖用户已改配置
  const { ensureDefaultAgents, ensureDefaultSettings } = await import("../src/services/agentConfig.js");
  await ensureDefaultAgents();
  await ensureDefaultSettings();
  console.log(`Agents: ${await prisma.agentConfig.count()} (preserved if already customized)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
