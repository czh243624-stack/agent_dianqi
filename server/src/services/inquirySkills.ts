export type InquirySkillCode =
  | "buyer_intent_stage"
  | "transformer_solution_reasoning"
  | "technical_parameter_audit"
  | "missing_parameter_questioning"
  | "lead_value_grading"
  | "knowledge_retrieval_planning"
  | "reply_risk_control"
  | "sales_reply_planning";

export type InquirySkillDefinition = {
  code: InquirySkillCode;
  name: string;
  objective: string;
  outputFocus: string;
  salesValue: string;
};

export type InquirySkillResult = {
  code: InquirySkillCode;
  name: string;
  status: "completed";
  priority: "high" | "medium" | "low";
  confidence: number;
  evidence: string[];
  result: string;
  nextAction: string;
  warnings: string[];
};

export const INQUIRY_AGENT_SKILLS: InquirySkillDefinition[] = [
  {
    code: "buyer_intent_stage",
    name: "买家意图与阶段 Skill",
    objective: "判断买家到底是在正式询价、技术选型、找供应商、要资料，还是低质量泛询盘。",
    outputFocus: "买家角色、采购阶段、是否正式 RFQ、当前成交推进位置。",
    salesValue: "让业务员知道这条询盘该不该马上跟、该按报价推进还是先培育。",
  },
  {
    code: "transformer_solution_reasoning",
    name: "变压器方案判断 Skill",
    objective: "结合买家原文、项目场景和行业常识判断产品方向，并明确哪些只是推断。",
    outputFocus: "Oil-immersed、Dry-type、Power、Distribution、Reactor、Substation、是否需要确认。",
    salesValue: "避免看到某个词就误判产品，让销售能安全地给出初步方向。",
  },
  {
    code: "technical_parameter_audit",
    name: "报价参数体检 Skill",
    objective: "抽取参数并判断报价准备度，区分明确提供、语义推断、仅被提及和缺失。",
    outputFocus: "Rated voltage、HV、LV、Capacity、Frequency、Vector Group、OLTC、Impedance、IEC、Installation Altitude、Quantity、Destination。",
    salesValue: "让销售一眼知道能不能报价、缺什么、哪些参数不能当真。",
  },
  {
    code: "missing_parameter_questioning",
    name: "缺失参数追问 Skill",
    objective: "识别影响报价/选型的缺失项，并按优先级生成英文追问。",
    outputFocus: "只追问当前业务下一步真正需要的信息。",
    salesValue: "直接给业务员可复制的追问，不问一堆没必要的问题。",
  },
  {
    code: "lead_value_grading",
    name: "客户价值评级 Skill",
    objective: "判断客户跟进优先级，给销售 A/B/C 分级和理由。",
    outputFocus: "采购意图、参数完整度、项目清晰度、数量、国家/目的地、公司和联系方式。",
    salesValue: "告诉销售先跟谁、为什么、跟进强度多高。",
  },
  {
    code: "knowledge_retrieval_planning",
    name: "知识库检索计划 Skill",
    objective: "把询盘转成 RAG 检索方向，决定应该查哪些企业资料。",
    outputFocus: "产品资料、认证资料、FAQ、交期说明、历史回复、客户评级规则。",
    salesValue: "让系统检索更准，也让业务员知道 AI 草稿依据来自哪里。",
  },
  {
    code: "reply_risk_control",
    name: "回复风险控制 Skill",
    objective: "识别回复中不能自动承诺的内容，特别是价格、交期、认证、测试报告和付款条款。",
    outputFocus: "对外可说、必须人工确认、不能说三类边界。",
    salesValue: "降低误报价、误承诺认证或交期的风险。",
  },
  {
    code: "sales_reply_planning",
    name: "回复策略 Skill",
    objective: "为英文回复草稿准备结构和安全边界。",
    outputFocus: "确认已知需求、追问缺失参数、推荐方向、资料附件建议、下一步跟进。",
    salesValue: "把 AI 分析转成一封业务员能直接改的英文回复。",
  },
];

export function buildSkillInstruction() {
  return INQUIRY_AGENT_SKILLS.map(
    (skill, index) =>
      `${index + 1}. ${skill.name} (${skill.code})\nObjective: ${skill.objective}\nOutput focus: ${skill.outputFocus}\nSales value: ${skill.salesValue}`,
  ).join("\n\n");
}
