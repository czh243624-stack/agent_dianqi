export type ParameterKey =
  | "product_type"
  | "application_scenario"
  | "rated_voltage"
  | "hv"
  | "lv"
  | "capacity"
  | "frequency"
  | "vector_group"
  | "oltc_requirement"
  | "impedance"
  | "iec_standard"
  | "installation_altitude"
  | "quantity"
  | "destination"
  | "delivery_requirement"
  | "certification";

export type ParameterItem = {
  key: ParameterKey;
  label: string;
  value: string;
  missing: boolean;
  confidence: number;
  requiredForQuotation: boolean;
  requiredForQuote?: boolean;
  source?: "buyer_text" | "semantic_inference" | "knowledge_base" | "not_provided";
  evidence?: string;
  interpretation?: "explicit" | "inferred" | "mentioned_not_requirement" | "missing";
  needsConfirmation?: boolean;
};

export type PainPoint = {
  label: string;
  level: "high" | "medium" | "low";
  evidence?: string;
};

export type LeadGrade = "A" | "B" | "C";

export type LeadAssessment = {
  grade: LeadGrade;
  score: number;
  reasons: string[];
  advice: string;
};

export type InquiryAnalysis = {
  businessIntent: string;
  intentConfidence?: number;
  productType: string;
  productTypeConfidence?: number;
  productTypeNeedsConfirmation?: boolean;
  applicationScenario: string;
  scenarioConfidence?: number;
  semanticSummary?: string;
  parameters: ParameterItem[];
  painPoints: PainPoint[];
  missingQuestions: string[];
  lead: LeadAssessment;
  skillResults?: Array<{
    code: string;
    name: string;
    status: string;
    priority?: "high" | "medium" | "low";
    confidence: number;
    evidence: string[];
    result: string;
    nextAction?: string;
    warnings?: string[];
  }>;
};

type BuyerContext = {
  buyerCompany?: string | null;
  buyerEmail?: string | null;
  buyerCountry?: string | null;
};

function pick(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[.;,\s]+$/g, "");
  }
  return null;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function normalizeVoltage(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "");
  if (/kv/i.test(cleaned)) return cleaned.replace(/kv/i, "kV");
  if (/^\d+(\.\d+)?$/.test(cleaned)) return `${cleaned}kV`;
  return value;
}

function detectVoltagePair(text: string): { hv: string | null; lv: string | null } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:kV)?\s*(?:\/|to|-)\s*(\d+(?:\.\d+)?)\s*kV/i);
  if (!match) return { hv: null, lv: null };
  return {
    hv: normalizeVoltage(match[1]),
    lv: normalizeVoltage(match[2]),
  };
}

function detectProductType(text: string): string {
  if (has(text, /mobile substation|portable substation|vehicle[-\s]?mounted substation/i)) {
    return "Mobile substation";
  }
  if (has(text, /prefabricated substation|pre[-\s]?fabricated substation|prefab substation|modular substation/i)) {
    return "Prefabricated substation";
  }
  if (has(text, /box[-\s]?type|compact substation|package substation|european[-\s]?style|american[-\s]?style/i)) {
    return "Box-type transformer / compact substation";
  }
  if (has(text, /three[-\s]?winding|3[-\s]?winding|tertiary winding/i)) {
    return "Three-winding power transformer";
  }
  if (has(text, /OLTC|on[-\s]?load tap changer/i)) {
    return "OLTC transformer";
  }
  if (has(text, /reactor|shunt reactor|series reactor/i)) {
    return "Reactor";
  }
  if (has(text, /dry[-\s]?type|cast resin|resin cast|indoor transformer/i)) {
    return "Dry-type transformer";
  }
  if (has(text, /oil[-\s]?immersed|oil filled|ONAN|ONAF/i)) {
    return "Oil-immersed distribution transformer";
  }
  if (has(text, /power transformer|substation transformer|grid transformer/i)) {
    return "Power transformer";
  }
  if (has(text, /distribution transformer|11\s*kV|33\s*kV|0\.4|0\.415/i)) {
    return "Distribution transformer";
  }
  if (has(text, /pad[-\s]?mounted/i)) {
    return "Pad-mounted / compact substation transformer";
  }
  return "Transformer, type to be confirmed";
}

function detectScenario(text: string): string {
  const candidates: Array<[RegExp, string]> = [
    [/solar|photovoltaic|PV plant/i, "Solar / PV project"],
    [/wind farm|wind power/i, "Wind power project"],
    [/mine|mining/i, "Mining project"],
    [/data center|datacenter/i, "Data center"],
    [/factory|industrial|plant|manufacturing/i, "Industrial facility"],
    [/substation|grid|utility|distribution network/i, "Substation / utility grid"],
    [/commercial building|building|mall|hotel/i, "Commercial building"],
    [/municipal|water treatment|infrastructure/i, "Municipal infrastructure"],
  ];
  return candidates.find(([pattern]) => pattern.test(text))?.[1] ?? "Application scenario to be confirmed";
}

function detectIntent(text: string): string {
  if (has(text, /urgent|asap|immediately|Q[1-4]|delivery|lead time/i)) {
    return "Urgent RFQ / delivery confirmation";
  }
  if (has(text, /quotation|quote|price|offer|FOB|CIF|CFR/i)) {
    return "Price inquiry / quotation request";
  }
  if (has(text, /datasheet|technical|drawing|specification|confirm/i)) {
    return "Technical specification confirmation";
  }
  if (has(text, /catalog|brochure|company profile/i)) {
    return "Product information request";
  }
  return "General transformer inquiry";
}

function item(
  key: ParameterKey,
  label: string,
  value: string | null,
  requiredForQuotation = true,
  confidence = 0.92,
): ParameterItem {
  return {
    key,
    label,
    value: value ?? "Not provided",
    missing: !value,
    confidence: value ? confidence : 0.15,
    requiredForQuotation,
  };
}

function buildQuestions(parameters: ParameterItem[]): string[] {
  const missing = new Set(parameters.filter((p) => p.missing && p.requiredForQuotation).map((p) => p.key));
  const questions: Array<[ParameterKey, string]> = [
    ["hv", "Could you confirm the HV rated voltage?"],
    ["lv", "Could you confirm the LV rated voltage?"],
    ["capacity", "Could you confirm the required transformer capacity?"],
    ["frequency", "Please confirm the system frequency, 50Hz or 60Hz."],
    ["vector_group", "Could you confirm the preferred vector group, such as Dyn11 or Yyn0?"],
    ["oltc_requirement", "Is OLTC required, or is an off-circuit tap changer acceptable?"],
    ["impedance", "Do you have a required short-circuit impedance value?"],
    ["iec_standard", "Please confirm whether IEC 60076 or another standard is required."],
    ["installation_altitude", "Please advise the installation altitude and ambient temperature if available."],
    ["quantity", "Please confirm the required quantity."],
    ["destination", "Please advise the destination country or port and preferred Incoterm."],
  ];
  return questions.filter(([key]) => missing.has(key)).map(([, question]) => question);
}

function assessPainPoints(text: string, parameters: ParameterItem[]): PainPoint[] {
  const points: PainPoint[] = [];
  if (has(text, /urgent|asap|Q[1-4]|delivery|lead time/i)) {
    points.push({ label: "Delivery time is important", level: "high" });
  }
  if (has(text, /IEC|certif|type test|routine test|CE|UL/i)) {
    points.push({ label: "Certification / standard confirmation is required", level: "high" });
  }
  if (has(text, /quote|quotation|price|offer|FOB|CIF|CFR/i)) {
    points.push({ label: "Customer expects quotation support", level: "medium" });
  }
  if (parameters.some((p) => p.missing && p.requiredForQuotation)) {
    points.push({ label: "Technical parameters are incomplete", level: "medium" });
  }
  return points;
}

function assessLead(
  text: string,
  context: BuyerContext,
  parameters: ParameterItem[],
  businessIntent: string,
  applicationScenario: string,
): LeadAssessment {
  let score = 0;
  const reasons: string[] = [];
  const present = (key: ParameterKey) => !parameters.find((p) => p.key === key)?.missing;

  if (context.buyerCompany) {
    score += 8;
    reasons.push("Buyer company is provided");
  }
  if (context.buyerEmail) {
    score += 8;
    reasons.push("Contact email is available");
  }
  if (context.buyerCountry || present("destination")) {
    score += 8;
    reasons.push("Country or destination is available");
  }
  for (const [key, weight, reason] of [
    ["product_type", 8, "Product direction is identifiable"],
    ["capacity", 12, "Capacity is provided"],
    ["hv", 10, "HV voltage is provided"],
    ["lv", 10, "LV voltage is provided"],
    ["quantity", 8, "Quantity is provided"],
    ["iec_standard", 7, "Required standard is mentioned"],
    ["delivery_requirement", 7, "Delivery requirement is mentioned"],
  ] as Array<[ParameterKey, number, string]>) {
    if (present(key)) {
      score += weight;
      reasons.push(reason);
    }
  }
  if (applicationScenario !== "Application scenario to be confirmed") {
    score += 8;
    reasons.push("Application scenario can be inferred");
  }
  if (/urgent|asap|quick response|quotation|quote|price|offer/i.test(text)) {
    score += 8;
    reasons.push("Inquiry shows active purchasing intent");
  }
  if (/catalog only|just send catalog|price list/i.test(text)) {
    score -= 12;
    reasons.push("Inquiry is broad and may need nurturing first");
  }

  const grade: LeadGrade = score >= 70 ? "A" : score >= 35 ? "B" : "C";
  const advice =
    grade === "A"
      ? "Prioritize follow-up. Confirm missing technical parameters and prepare quotation support after human review."
      : grade === "B"
        ? "Send professional clarification questions and product references. Move to quotation after key parameters are confirmed."
        : "Use a standard nurturing reply first. Ask for project background and required specifications before allocating heavy quoting effort.";

  return {
    grade,
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.length ? reasons : [`Intent detected: ${businessIntent}`],
    advice,
  };
}

export function analyzeTransformerInquiry(text: string, context: BuyerContext = {}): InquiryAnalysis {
  const productType = detectProductType(text);
  const applicationScenario = detectScenario(text);
  const businessIntent = detectIntent(text);

  const voltagePair = detectVoltagePair(text);
  const hv = normalizeVoltage(
    pick(text, [
      /HV\s*(?:rated voltage)?\s*[:：-]\s*([0-9.]+\s*kV?)/i,
      /Primary voltage\s*[:：-]\s*([0-9.]+\s*kV?)/i,
      /high voltage\s*[:：-]\s*([0-9.]+\s*kV?)/i,
    ]) ?? voltagePair.hv,
  );
  const lv = normalizeVoltage(
    pick(text, [
      /LV\s*(?:rated voltage)?\s*[:：-]\s*([0-9.]+\s*kV?)/i,
      /Secondary voltage\s*[:：-]\s*([0-9.]+\s*kV?)/i,
      /low voltage\s*[:：-]\s*([0-9.]+\s*kV?)/i,
    ]) ?? voltagePair.lv,
  );
  const capacity = pick(text, [
    /Capacity\s*[:：-]\s*([0-9.]+\s*(?:kVA|MVA))/i,
    /([0-9.]+\s*(?:kVA|MVA))/i,
  ]);
  const frequency = pick(text, [/Frequency\s*[:：-]\s*(50\s*Hz|60\s*Hz)/i, /(50\s*Hz|60\s*Hz)/i]);
  const vectorGroup = pick(text, [/Vector group\s*[:：-]\s*([A-Za-z0-9]+)/i, /\b(Dyn11|Yyn0|Yd11|YNd11|Dzn0)\b/i]);
  const oltc = pick(text, [
    /OLTC\s*(?:requirement)?\s*[:：-]\s*([^\n,.;]+)/i,
    /(on[-\s]?load tap changer|off[-\s]?circuit tap changer|off[-\s]?circuit)/i,
  ]);
  const impedance = pick(text, [
    /(?:short[-\s]?circuit\s*)?impedance\s*[:：-]?\s*([0-9.]+\s*%)/i,
    /\buk\s*[:：-]?\s*([0-9.]+\s*%)/i,
  ]);
  const standard = pick(text, [
    /(IEC\s*60076|IEC)/i,
    /(IEEE\s*C57(?:\.[0-9]+)?)/i,
    /(ANSI\s*[A-Z0-9.-]*)/i,
  ]);
  const altitude = pick(text, [
    /installation altitude\s*[:：-]\s*([0-9,]+\s*m)/i,
    /altitude\s*[:：-]?\s*([0-9,]+\s*m)/i,
  ]);
  const quantity = pick(text, [
    /Quantity\s*[:：-]?\s*([0-9]+\s*(?:units?|pcs|sets?)?)/i,
    /([0-9]+)\s*(?:units?|pcs|sets?)/i,
  ]);
  const destination = pick(text, [
    /destination(?: port)?\s*[:：-]\s*([A-Za-z\s]+(?:port)?)/i,
    /ship(?:ment)? to\s*([A-Za-z\s]+)/i,
  ]) ?? context.buyerCountry ?? null;
  const delivery = pick(text, [/Delivery\s*[:：-]\s*([^\n]+)/i, /(urgent(?:ly)?|ASAP|Q[1-4]\s*(?:installation|delivery)?)/i]);
  const certification = pick(text, [/(CE|UL|CSA|IEC\s*60076|type test|routine test|certificate|certification)/i]);

  const parameters: ParameterItem[] = [
    item("product_type", "Product type", productType, true, productType.includes("confirmed") ? 0.45 : 0.86),
    item("application_scenario", "Application scenario", applicationScenario, false, applicationScenario.includes("confirmed") ? 0.35 : 0.82),
    item("rated_voltage", "Rated voltage", hv && lv ? `${hv}/${lv}` : null, true),
    item("hv", "HV", hv, true),
    item("lv", "LV", lv, true),
    item("capacity", "Capacity", capacity, true),
    item("frequency", "Frequency", frequency, true),
    item("vector_group", "Vector group", vectorGroup, true),
    item("oltc_requirement", "OLTC requirement", oltc, true),
    item("impedance", "Impedance", impedance, true),
    item("iec_standard", "IEC standard", standard, true),
    item("installation_altitude", "Installation altitude", altitude, true),
    item("quantity", "Quantity", quantity, true),
    item("destination", "Destination", destination, true),
    item("delivery_requirement", "Delivery requirement", delivery, false),
    item("certification", "Certification", certification, false),
  ];

  const painPoints = assessPainPoints(text, parameters);
  const missingQuestions = buildQuestions(parameters);
  const lead = assessLead(text, context, parameters, businessIntent, applicationScenario);

  return {
    businessIntent,
    productType,
    applicationScenario,
    parameters,
    painPoints,
    missingQuestions,
    lead,
  };
}
