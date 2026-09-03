export type InquiryStatus = "draft" | "approved" | "queued";

export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  missing?: boolean;
  source: "buyer_text" | "inferred" | "knowledge_base" | "missing";
};

export type SourceDoc = {
  id: string;
  title: string;
  type: string;
  version: string;
  snippet: string;
  updatedAt: string;
  tags: string[];
};

export type PainPoint = {
  label: string;
  level: "high" | "medium" | "low";
  reason: string;
};

export type AnalysisResult = {
  buyer: string;
  country: string;
  channel: string;
  fields: ExtractedField[];
  painPoints: PainPoint[];
  missingQuestions: string[];
  sources: SourceDoc[];
  recommendedModel: string;
  quoteHint: string;
  draftReply: string;
  riskFlags: string[];
  nextActions: string[];
};

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  draft: "待审核",
  approved: "已通过",
  queued: "待发送",
};

export const SAMPLE_INQUIRIES = [
  {
    name: "尼日利亚 500 kVA 配电项目",
    text: `Dear Sir/Madam,

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
Email: a.okonkwo@westpower.ng`,
  },
  {
    name: "智利 2 MVA 太阳能项目",
    text: `Hello,

We need a 2 MVA step-up transformer for a solar farm project in Chile. The LV side is 0.8 kV and the MV side should be 13.8 kV. Frequency is 60 Hz.

Please quote 2 units, outdoor type, copper winding if available. We need IEC compliance and a short delivery time because the EPC schedule is tight.

Can you provide datasheet, test report, estimated production time and CIF San Antonio price?

Regards,
Carlos Medina
Andes Solar EPC`,
  },
  {
    name: "菲律宾 1000 kVA 工厂扩建",
    text: `Dear Sales Team,

We are expanding a food processing plant in the Philippines and need one dry type transformer, 1000 kVA, 13.2 kV to 480 V, 60 Hz.

Please confirm if you can supply with CE certificate, enclosure, and temperature controller. The client needs delivery before November.

Please send technical offer and commercial offer.

Thanks,
Maria Santos`,
  },
];

export const KNOWLEDGE_BASE: SourceDoc[] = [
  {
    id: "DOC-TR-500-33",
    title: "S13-M-500/33 Oil-Immersed Transformer Datasheet",
    type: "产品资料",
    version: "v2.3",
    snippet: "500 kVA, 33/0.415 kV, 50 Hz, ONAN, off-circuit tap changer, IEC 60076 configuration available.",
    updatedAt: "2026-05-12",
    tags: ["oil", "500", "33", "0.415", "IEC 60076", "ONAN"],
  },
  {
    id: "DOC-SOLAR-2000-13",
    title: "2 MVA Solar Step-Up Transformer Reference",
    type: "应用资料",
    version: "v1.7",
    snippet: "Solar step-up transformer reference design, 0.8/13.8 kV, 60 Hz, outdoor oil-immersed configuration.",
    updatedAt: "2026-04-08",
    tags: ["solar", "2 MVA", "2000", "13.8", "0.8", "60"],
  },
  {
    id: "DOC-DRY-1000-13",
    title: "SCB13-1000 Dry-Type Transformer Datasheet",
    type: "产品资料",
    version: "v3.1",
    snippet: "1000 kVA dry-type transformer, 13.2 kV to 480 V, enclosure and temperature controller options available.",
    updatedAt: "2026-01-19",
    tags: ["dry", "1000", "13.2", "480", "CE"],
  },
  {
    id: "CERT-IEC-60076",
    title: "IEC 60076 Export Compliance Pack",
    type: "认证资料",
    version: "2026-02",
    snippet: "IEC 60076 documentation pack for export transformer projects. Exact scope must be checked by model and configuration.",
    updatedAt: "2026-02-26",
    tags: ["IEC 60076", "certificate", "test"],
  },
  {
    id: "CERT-CE-DRY",
    title: "CE Certificate Scope for Dry-Type Transformers",
    type: "认证资料",
    version: "2025-12",
    snippet: "CE documentation for selected dry-type transformer models. Scope confirmation is required before customer commitment.",
    updatedAt: "2025-12-15",
    tags: ["CE", "dry", "certificate"],
  },
  {
    id: "RULE-LEADTIME",
    title: "Export Transformer Lead-Time Rules",
    type: "交期规则",
    version: "v1.9",
    snippet: "Standard oil-immersed units usually require 25-45 production days after technical confirmation. Dry-type units vary by enclosure and winding material.",
    updatedAt: "2026-06-03",
    tags: ["lead time", "delivery", "urgent", "production"],
  },
  {
    id: "QUOTE-GUARDRAIL",
    title: "Quotation Approval Guardrail",
    type: "报价规则",
    version: "restricted",
    snippet: "AI may provide internal quotation reminders only. Official price, Incoterm, validity and margin must be confirmed by sales manager.",
    updatedAt: "2026-03-11",
    tags: ["quote", "price", "FOB", "CIF", "approval"],
  },
];

export const PROCESSING_STEPS = [
  "读取买家原文",
  "抽取容量、电压、频率、数量和认证",
  "识别痛点和缺失参数",
  "检索产品资料、认证资料、交期规则和报价规则",
  "生成澄清问题",
  "生成英文回复草稿",
];
