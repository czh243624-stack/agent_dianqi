import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type KnowledgeInput = {
  sourceType: string;
  title: string;
  content: string;
  tags: string[];
  visibility?: string;
  version?: string;
};

type ProductInput = {
  model: string;
  type: string;
  capacityKva?: number;
  voltagePrim?: string;
  voltageSec?: string;
  frequency?: string;
  cooling?: string;
  phase?: string;
  standard?: string;
  summary: string;
};

type CertificationInput = {
  name: string;
  market?: string;
  modelScope?: string;
  summary: string;
};


const settings: Record<string, string> = {
  company_name: "Liaoning EFACEC Electrical Equipment Co., Ltd.",
  company_name_cn: "辽宁易发式电气设备有限公司",
  company_website: "http://www.leeec.com",
  company_english_site: "new.leeec.com",
  target_markets_primary: "North America; Middle East/GCC",
  target_markets_development: "Southern Europe; Eastern Europe; South America; Africa",
  target_markets_non_target: "Russia",
  sales_from_email: "",
  sales_signature: "Export Sales | Liaoning EFACEC Electrical Equipment Co., Ltd.",
  require_human_approval: "true",
};

const knowledgeDocs: KnowledgeInput[] = [
  {
    sourceType: "company_profile",
    title: "LEEEC company profile and export markets",
    content:
      "Liaoning EFACEC Electrical Equipment Co., Ltd. is the English company name provided for the transformer foreign trade AI Agent. Chinese name: 辽宁易发式电气设备有限公司. Official website: http://www.leeec.com. English site: new.leeec.com. Primary export markets: North America and Middle East/GCC. Development markets: Southern Europe, Eastern Europe, South America, and Africa. Russia is marked as a non-target market in the client information form.",
    tags: ["company", "LEEEC", "export markets", "North America", "Middle East", "GCC", "Africa", "Russia non-target"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "product_scope",
    title: "LEEEC transformer product scope",
    content:
      "Product categories for phase 1 inquiry handling include Power Transformers, Oil-Immersed Power Transformers, Dry-Type Transformers, Distribution Transformers, Three-Winding Transformers, OLTC Transformers, Reactors, Mobile Substations, Prefabricated Substations, Box-Type Substations, and Special Transformer Solutions. Known public range: 11-750kV Power Transformers. Representative model references include SCB10 Dry-Type Transformer and SSZ22 Three-Winding Power Transformer. Typical application scenes from the client information form include power plants, substations, power grids, industrial facilities, commercial buildings, and distribution networks. Exact model selection and parameters must follow the latest official catalogue and technical documents.",
    tags: ["product", "transformer", "oil immersed", "dry type", "OLTC", "reactor", "substation", "SCB10", "SSZ22", "power plant", "grid", "industrial", "commercial", "distribution"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "product_data_policy",
    title: "Product data usage policy for AI replies",
    content:
      "AI replies must be based on official catalogues, model parameter sheets, certified documents, and human-approved historical replies. Source priority for product facts: 1) official catalogue; 2) official datasheet / parameter sheet; 3) human-approved historical materials; 4) human confirmation. If a fact is not in the current database, AI must not invent it and should use: Information not available in the current database. We will need to confirm this with our sales/engineering team before providing a final commitment. If the buyer does not provide enough technical parameters, AI must ask follow-up questions and must not infer nonexistent models, impedance values, certifications, lead time, prices, factory cases, or project photos. Product database fields should include model, capacity, HV voltage, LV voltage, frequency, vector group, tap changer, impedance, cooling type, insulation level, protection/IP grade, standard, certification, dimensions, weight, application, delivery time, and optional configuration.",
    tags: ["RAG", "knowledge base", "product database", "no hallucination", "parameter policy", "source priority", "information not available"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "faq",
    title: "FAQ - required transformer parameters before quotation",
    content:
      "Before preparing a transformer quotation, ask the buyer to confirm rated capacity, high-voltage side voltage, low-voltage side voltage, frequency, vector group, tap changer requirement, impedance requirement if applicable, cooling type, applicable standard, quantity, destination or project location, and required delivery time. If available, request the project specification or technical datasheet. Priority: first confirm Capacity, HV/LV Voltage, Frequency, Quantity; then Vector Group, Tap Changer, Cooling Type, Standard; then Destination, Delivery Time, Certification, and Project Background.",
    tags: ["FAQ", "quotation", "missing parameters", "HV", "LV", "capacity", "frequency", "vector group", "OLTC", "impedance"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "certification_note",
    title: "Certification and technical commitment policy",
    content:
      "The company can design, manufacture, and test transformers, reactors, mobile substations, and prefabricated substations up to 750kV according to GB, IEC, ANSI, BS, DIN, and user requirements, subject to official confirmation. Known standard/certification references include IEC, ISO, CE, ISO9001, ISO14001, GB/T28001, GB/T23331 energy management system, GB/T39604 social responsibility management system, ISO/IEC information security management system, ISO28000 security and resilience management system, PCCC, and other third-party certifications, but certificate scope, validity, and applicable products must be checked against original certificates before external release. AI must not treat meeting a standard as having certification, must not treat company system certification as product certification, and must not promise UL, CSA, KEMA, SASO, or market-specific certification without manual scope confirmation.",
    tags: ["certification", "IEC", "ISO", "CE", "PCCC", "GB/T23331", "GB/T39604", "ISO28000", "UL", "CSA", "KEMA", "SASO", "manual review"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "sales_reply_policy",
    title: "Conservative English reply wording",
    content:
      "Use cautious wording for external replies. Approved phrases include: We will need to confirm this with our sales/engineering team before providing a final commitment. The final price depends on the technical specifications, quantity, destination and Incoterms. The delivery time depends on the product configuration, capacity, voltage level and production schedule. Certification availability depends on the specific product and project requirements. The final technical performance will be subject to the approved technical specification and engineering confirmation. Payment terms are negotiable and will be confirmed according to the project, quantity, destination and contract requirements. Our sales team will confirm the applicable payment terms. The quotation validity will be stated in the formal quotation after technical and commercial confirmation. If a requested fact is not in the current knowledge base, use: Information not available in the current database. We will need to confirm this with our sales/engineering team before providing a final commitment. Warranty terms must be confirmed according to contract and project requirements; do not promise a fixed warranty period unless an approved policy exists.",
    tags: ["reply template", "English reply", "risk control", "price", "delivery", "warranty", "payment", "quotation validity"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "quote_rule",
    title: "Quotation and delivery human-review policy",
    content:
      "Quotation depends on model, quantity, voltage level, technical requirements, trade term, destination, certification, and testing requirements. Currency is mainly USD. Common Incoterms include FOB, CIF, CFR, and EXW. Some products or projects may refer to 45-day delivery, but final delivery must be confirmed by production planning and actual project requirements. Payment terms are negotiable; sales must confirm the applicable terms. The quotation validity period must be stated only in the formal quotation after technical and commercial confirmation. Historical prices, costs, margins, target margin, floor prices, commissions, and internal quote rules are internal-only and must not be sent directly to customers. Manager review is required for authorized prices, margin exceptions, major projects, large quantities, high-voltage projects, special certifications, special payment terms, EPC projects, and utility projects.",
    tags: ["quotation", "delivery", "USD", "FOB", "CIF", "CFR", "EXW", "human review", "45 days", "payment", "quotation validity"],
    visibility: "restricted",
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "lead_grading_policy",
    title: "A/B/C lead grading rules for transformer inquiries",
    content:
      "A-grade leads usually include clear product demand, clear project background, quantity, delivery requirement, destination or port, valid contact information, complete company information, and strong purchase intent or formal RFQ. A-grade can be identified when at least three core signals are present: clear product requirement, clear project, purchase timeline, quantity/capacity, budget or RFQ, valid contact information, and complete company information. A-grade leads should enter human sales follow-up within 24 hours. B-grade leads have a product direction but incomplete parameters; sales should ask for Capacity, Voltage, Frequency, Quantity, Destination, Delivery, and Project Background, then upgrade the lead if qualified. C-grade leads only ask for a price list or catalogue, have no clear specification, no project background, or incomplete contact information. High-value customer types include power companies, utilities, EPC/contractors, substation projects, power plant projects, industrial power users, large EPCs, generation groups, substation project developers, and customers with long-term framework purchasing potential. Russia is a non-target market unless manually approved.",
    tags: ["lead grade", "A-grade", "B-grade", "C-grade", "customer profile", "EPC", "utility", "24 hours", "Russia non-target"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "website_intake_policy",
    title: "Independent website inquiry intake requirements",
    content:
      "Recommended independent website flow: website form submission, webhook/API to AI Agent, Lead ID creation, AI analysis and grading, English draft generation, salesperson review, status sync to customer pool and logs. Suggested form fields: Company, Email, Phone/WhatsApp, Country, Product Category, Product Model, Capacity, Voltage, Frequency, Quantity, Destination, Required Delivery Time, Project Type, Expected Purchase Time, Technical Specification Attachment, Source Page, and UTM/campaign source. Customer must confirm website backend URL, technical contact, whether form fields can be changed, whether webhook can be configured, whether an inquiry database exists, and whether status synchronization is required.",
    tags: ["website", "form", "webhook", "lead intake", "independent site"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "alibaba_permission_checklist",
    title: "Alibaba International permission checklist",
    content:
      "Customer must confirm whether the Alibaba International account has master account permission, whether the operator uses master or sub account, and whether inquiry reading, message replying, product management, and customer management permissions are available. Customer must confirm whether Alibaba International Open API is enabled and whether inquiry read API, message/chat API, customer API, and webhook notification are available. If API permission is available, the system can pull inquiries and write back or send messages after human approval. If API permission is not available, phase 1 should use manual import, copy-paste, or file import while AI analysis and customer profile accumulation still work.",
    tags: ["Alibaba", "Open API", "permission", "inquiry", "message", "webhook", "manual import"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "human_review_policy",
    title: "Mandatory human review scenarios",
    content:
      "Human review is mandatory for A-grade formal RFQs, large quantity orders, high-voltage projects, utility/government/EPC projects, special certification requests, customer requests for certificate copies, parameter deviation or custom design, price, delivery, payment terms, warranty, penalty terms, performance guarantees, agency discounts, and contract terms. AI can identify intent, extract parameters, detect missing fields, retrieve knowledge, draft follow-up questions, generate an English reply draft, grade the customer, suggest next action, and save customer records. AI cannot make final commercial or technical commitments.",
    tags: ["human review", "approval", "RFQ", "A-grade", "commercial commitment", "technical commitment"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "market_customer_profile",
    title: "Regional buyer demand profile for transformer inquiries",
    content:
      "Use regional buyer profiles only as sales analysis hints, not as fixed rules for every customer. North America inquiries often focus on ANSI/IEEE project standards, 60Hz, UL/CSA or project-specific requirements, technical specifications, utility/EPC projects, delivery capability, product liability, and contract requirements. Middle East/GCC inquiries often focus on project-based procurement, EPC/contractors, power and infrastructure projects, high-temperature operating environment, local certification or approval requirements, CIF/ocean shipping, and project delivery schedule. Southern/Eastern Europe inquiries often focus on IEC standards, grid and industrial projects, technical parameters, CE/project compliance, and EPC projects. South America inquiries often focus on local standards/certification, voltage and frequency matching, ocean shipping and destination ports, payment terms, and EPC/industrial projects. Africa inquiries often focus on power infrastructure projects, EPC contractors, distribution and transmission equipment, project financing, ocean shipping, on-site installation guidance, and after-sales service.",
    tags: ["market profile", "North America", "Middle East", "GCC", "Europe", "South America", "Africa", "ANSI", "IEEE", "IEC", "60Hz"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "testing_capability",
    title: "Testing capability and report response policy",
    content:
      "The client information form states that the test hall can perform routine tests, type tests, and special tests for transformers, reactors, mobile substations, and prefabricated substations up to 750kV according to GB, IEC, ANSI, BS, DIN, and user requirements. When a buyer asks for a Routine Test Report, Routine Test Certificate, Type Test Report, special test data, or stamped/original documents, AI may state that relevant testing capability and records can be checked, but final reports, stamped documents, original test data, and certificate copies must be reviewed and approved manually before being sent externally.",
    tags: ["testing", "routine test", "type test", "special test", "750kV", "reactor", "mobile substation", "prefabricated substation"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "packing_shipping_after_sales",
    title: "Packing, shipping and after-sales response policy",
    content:
      "For packing and transportation questions, the client information form says transformer transportation force is calculated and reliable positioning and sealing measures are used; the company has large transformer and heavy equipment loading, transportation and transfer capability. AI should keep this wording general unless an approved packing plan is available. For after-sales questions, the form states the company provides pre-sales, in-sales and after-sales service, including on-site installation guidance, commissioning, training, operation/maintenance and spare parts service. Quality issue information should receive a response within 24 hours or service personnel should be dispatched as soon as possible. Warranty terms must be confirmed according to contract and project requirements; AI must not promise a fixed warranty period unless approved policy is in the knowledge base.",
    tags: ["packing", "shipping", "transportation", "after-sales", "commissioning", "training", "spare parts", "24 hours", "warranty"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "risk_customer_policy",
    title: "Risk customer and low-priority lead policy",
    content:
      "Risk customer signals include abnormal payment requests, requests for sensitive internal materials, unverifiable company information, obvious fraud signals, severe mismatch with target markets or product scope, and requests to bypass normal approval processes. C-grade or low-priority leads can receive a standard product introduction or catalogue and be guided to provide specifications. They should be re-rated when they provide a clear project, specification, quantity, purchase timeline, or valid company/contact information.",
    tags: ["risk customer", "fraud", "low priority", "C-grade", "lead reactivation", "approval"],
    version: "client-form-2026-09-01",
  },
  {
    sourceType: "first_reply_template",
    title: "Standard first-response English inquiry template",
    content:
      "Use this structure for the first English reply after an inquiry is received. Fill known facts only; do not invent missing parameters, models, prices, delivery dates, or certifications.\n\nDear Sir/Madam,\n\nThank you for your inquiry.\n\nWe understand that you are looking for [transformer type] for [application scenario].\n\nOur preliminary understanding of the known technical parameters is:\n- Rated Capacity:\n- HV Voltage:\n- LV Voltage:\n- Frequency:\n- Quantity:\n\nTo prepare an accurate technical proposal and quotation, please kindly provide or confirm:\n1. Rated Capacity\n2. HV / LV Voltage\n3. Frequency\n4. Quantity\n5. Vector Group\n6. Tap Changer / OLTC requirement\n7. Cooling Type\n8. Applicable Standard\n9. Destination / Destination Port\n10. Required Delivery Time\n11. Certification Requirement\n12. Project Background\n\nIf available, please also share the technical specification or datasheet.\n\nWe will need to confirm price, delivery time, certification scope and commercial terms with our sales/engineering team before providing a final commitment.\n\nBest regards,\nExport Sales\nLiaoning EFACEC Electrical Equipment Co., Ltd.",
    tags: ["first reply", "English template", "thank you", "missing parameters", "Capacity", "HV", "LV", "Frequency", "Quantity"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "commercial_terms_policy",
    title: "Payment terms and quotation validity wording",
    content:
      "Approved external wording for payment and quotation validity from the client information form. Payment: Payment terms are negotiable and will be confirmed according to the project, quantity, destination and contract requirements. Our sales team will confirm the applicable payment terms. Quotation validity: The quotation validity will be stated in the formal quotation after technical and commercial confirmation. AI must not invent a payment ratio, L/C or T/T split, down payment percentage, or a fixed validity period such as 15/30 days unless an approved quotation already states it. Price, payment, validity, Incoterms and warranty remain mandatory human-review items.",
    tags: ["payment", "quotation validity", "commercial terms", "negotiable", "human review"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "delivery_rule",
    title: "Urgent delivery handling workflow",
    content:
      "When a buyer requests urgent, rush, or shortened delivery, record the requested target date in the inquiry, extract it as a delivery requirement, and mark the inquiry as Urgent. Then notify sales and production planning. AI may acknowledge the urgency and state that delivery depends on product configuration, capacity, voltage level and production schedule. Final delivery commitment can only be issued after sales and production confirmation. Do not treat the internal 45-day reference as a promised urgent lead time. Do not invent an earlier delivery date to win the inquiry.",
    tags: ["urgent", "delivery", "rush", "lead time", "production planning", "45 days"],
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "internal_data_policy",
    title: "Internal-only materials blacklist for AI replies",
    content:
      "The following internal materials must never be sent to buyers or used as external facts: cost, cost structure, margin, target margin, floor price, authorized price exceptions, sales commissions, unreleased production schedule, unreleased capacity plan, unauthorized drawings, unauthorized test reports, original certificate files before sales approval, customer database, historical quote amounts, account credentials, API keys, passwords, contract templates with unapproved commercial terms, and any document marked internal-only. If a buyer asks for these, refuse, mark the inquiry as risk if appropriate, and route to human sales. Public catalogue, public website product descriptions, and already-approved reply wording may be used.",
    tags: ["internal only", "blacklist", "cost", "margin", "floor price", "drawings", "credentials", "customer database"],
    visibility: "restricted",
    version: "client-form-2026-09-02",
  },
  {
    sourceType: "official_website_company_profile",
    title: "Official website - LEEEC company scale and capability",
    content:
      "Source: https://www.leeec.com/?pages_26/=. The official website states that 辽宁易发式电气设备有限公司 is located in Liaoyang, Liaoning, is a provincial technology center and high-tech enterprise, and was recognized as a provincial specialized and innovative SME in 2022. It was established in October 1994 with registered capital of RMB 100 million, total assets of RMB 1.05 billion, land area of 64,000 square meters, building area of 33,528 square meters, workshop area of 30,559 square meters, 669 sets of general and special transformer production equipment, including 411 imported equipment sets from 11 countries, and 310 employees. Use this as public company profile wording, but verify exact English translation before external release.",
    tags: ["official website", "company profile", "factory scale", "equipment", "Liaoyang"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_product_capability",
    title: "Official website - public product capability range",
    content:
      "Source: https://www.leeec.com/?pages_26/=. The official website states that the company mainly produces oil-immersed power transformers up to 370MVA/500kV, oil-immersed distribution transformers up to 6.3MVA/35kV, epoxy resin cast dry-type transformers up to 3.15MVA/35kV, mobile substations, prefabricated substations, and EPC general contracting projects. This range should guide AI product classification and follow-up questions. Exact model parameters still require official catalogue or datasheet confirmation.",
    tags: ["official website", "product capability", "370MVA", "500kV", "6.3MVA", "35kV", "3.15MVA", "dry type"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_export_markets",
    title: "Official website - export markets and customer references",
    content:
      "Source: https://www.leeec.com/?pages_26/= and https://www.leeec.com/?products_31/46.html=. The official website states that products serve power transmission and distribution, national defense industry, and key domestic and overseas transmission/distribution projects; products are sold to more than 20 provinces/cities in China and exported to more than 70 countries and regions. The power transformer page lists export coverage including Ukraine, Saudi Arabia, Ethiopia, New Zealand, Ecuador, Philippines, Bangladesh, Kyrgyzstan, Zambia, Morocco, Jordan, Malawi, and customer references including State Grid, ANDRITZ, ZESCO, NEPCO, Ukraine power company, Kyrgyzstan national grid, ABB India, ABB sro Nigeria, and Polina Ukraine. Customer/project references should be used cautiously and preferably after sales confirmation.",
    tags: ["official website", "export", "customer references", "Africa", "Middle East", "Europe", "South America"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_quality_certification",
    title: "Official website - quality system and certification references",
    content:
      "Source: https://www.leeec.com/?pages_26/= and certification pages. The official website states that since 2007 the company has obtained ISO9001-2000 quality management system certification, ISO14001 environmental management system certification, GB/T 28001-2001 occupational health and safety management system certification, international multilateral certification covering 17 countries including the United States, United Kingdom and Germany, and more than 50 transformer tests/certifications through CTQC, SGS, VEIKI-VNL, KEMA and ASTA. Certification list pages include examples such as ASTA 100M/220kV, KEMA 180MVA/220kV, Rheinland 26MVA/132kV, Rheinland 13MVA/132kV, Rheinland 40MVA/132kV, and CTQC 26MVA/132kV, 40MVA/66kV, 40MVA/132kV, 51MVA/169kV, 63MVA/110kV, 180MVA/220kV, 33MVA/161kV, 77MVA/235kV. AI must not claim certificate applicability without checking original certificates and validity.",
    tags: ["official website", "ISO9001", "ISO14001", "GB/T 28001", "CTQC", "SGS", "KEMA", "ASTA", "Rheinland"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_power_transformer",
    title: "Official website - Power transformer product knowledge",
    content:
      "Source: https://www.leeec.com/?products_31/46.html=. The official power transformer page describes design using transformer optimization calculation software and analysis of electric field, magnetic field, temperature field, and impulse voltage gradients. Public technical feature themes include reducing partial discharge, preventing oil leakage, reducing noise, and sudden short-circuit resistance. Examples mentioned include 200MVA/330kV autotransformer with 330/161±8*1.25%/34.5kV and YNaod11, 300MVA/230kV autotransformer, 150MVA/225kV and 100MVA/225kV external auxiliary transformers, 44.8MVA main series transformer, 67MVA/132kV power transformer, and 40MVA/66kV power transformer. Use as product knowledge for classification and sales discussion, not as automatic model recommendation without matching datasheets.",
    tags: ["official website", "power transformer", "330kV", "220kV", "110kV", "66kV", "autotransformer", "short-circuit"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_dry_transformer",
    title: "Official website - Dry-type transformer product knowledge",
    content:
      "Source: https://www.leeec.com/?products_31/50.html=. The dry-type transformer page lists product features including fire resistance, no pollution, corrosion resistance, direct installation at load center, operation under 100% humidity, convenient installation, low overall operating cost, low loss, low partial discharge, low noise, high mechanical strength, short-circuit resistance, and strong heat dissipation. Applications include power transmission/distribution systems, hotels, restaurants, high-rise buildings, commercial centers, stadiums, petrochemical factories, subways, stations, airports, offshore drilling platforms, load centers, and places with special fire protection requirements. Use condition references include altitude <=1000m, indoor installation, ambient temperature range from -25C to 40C, ventilation requirements, and IP00/IP20/IP23 options; conditions outside this range require adjustment according to GB1094.11.",
    tags: ["official website", "dry-type transformer", "cast resin", "fire protection", "load center", "IP00", "IP20", "IP23", "GB1094.11"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_mobile_substation",
    title: "Official website - Mobile substation product knowledge",
    content:
      "Source: https://www.leeec.com/?products_31/1302.html=. The mobile substation page states that a mobile substation integrates transformer, primary equipment, secondary protection, and control equipment to complete power conversion requirements. It requires compact structure, small size, light weight, vibration resistance, and suitability for vehicle transport. Applications include emergency power, maintenance power, temporary power, and construction power. The website describes two-trailer loading: one trailer for primary protection equipment such as disconnecting switch, arrester, current/voltage transformer and circuit breaker; another trailer for main transformer, cooling equipment, auxiliary transformer cable well, and secondary protection/control instruments. Project references include PHCN Nigeria, CMEC, Beijing Creative Distribution Automation, and CAMCE Ethiopia project from 2009 to 2020.",
    tags: ["official website", "mobile substation", "emergency power", "temporary power", "Nigeria", "Ethiopia", "PHCN"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_prefabricated_substation",
    title: "Official website - Prefabricated substation product knowledge",
    content:
      "Source: https://www.leeec.com/?products_31/1303.html=. The prefabricated substation page describes three prefabricated units according to system configuration: high-voltage module, main transformer module, and low-voltage module. It states the high-voltage module consists of flame-retardant, insulation and shielding enclosure plus high-voltage switchgear; the main transformer module consists of enclosure plus transformer; the low-voltage module consists of enclosure plus medium-voltage switchgear, secondary control/protection equipment and auxiliary power equipment, with modules connected by cable. The page states factory production cycle of 3 months and on-site construction cycle of 1 month, smaller footprint than traditional substations, six-layer anti-corrosion shell technology, 30-year anti-corrosion and 60-year service life claims, and applications in urban centers, coal, oil, photovoltaic, wind power, suburban/remote mountain areas. Treat production cycle and service life claims as public references requiring project confirmation before external commitment.",
    tags: ["official website", "prefabricated substation", "modular", "photovoltaic", "wind power", "3 months", "1 month"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_box_transformer",
    title: "Official website - Box-type transformer product knowledge",
    content:
      "Source: https://www.leeec.com/?products_31/1304.html=. The box-type transformer page divides products into American style and European style. American-style combined transformer / box-type substation features include low loss, low noise, long service life, and a sealed, movable steel-structure enclosure with moisture-proof, rust-proof, dust-proof, rodent-proof, fireproof, anti-theft and heat-insulation characteristics. European-style units include independent transformer room and can use dry-type or oil-immersed transformer; HV switchgear, transformer and LV switchgear are integrated, with five-prevention function, safe operation, simple maintenance, small footprint, short production cycle and convenient transport. Applications include urban distribution, street lighting power supply, industrial and mining enterprises, urban construction, residential areas, mountain areas, hotels, parks, construction sites, airports, oilfields, docks and highways.",
    tags: ["official website", "box-type transformer", "American style", "European style", "compact substation", "urban distribution"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_contact",
    title: "Official website - public contact information",
    content:
      "Source: https://www.leeec.com/?pages_39/=. Public website contact information includes address 中国辽宁省辽阳市白塔区北园路29号, phone +86-419-3130233, fax +86-419-3133643, domestic after-sales phone 86 18841941368, Saudi after-sales phone 966 506648950, contact person 边禹, Saudi office address Al Dabab, Dammam 32261 Saudi Arabia, postcode 111000, website http://www.leeec.com. The website also shows an email field, but the crawler masks it as [email protected], so the real sales email still needs customer confirmation before using in reply signatures.",
    tags: ["official website", "contact", "phone", "fax", "Saudi office", "email to confirm"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
  {
    sourceType: "official_website_capacity_expansion",
    title: "Official website - 2026 transformer capacity expansion notice",
    content:
      "Source: https://www.leeec.com/?news_32/1283.html=. A public environmental impact disclosure dated 2026-01-26 describes a power transformer capacity expansion project at 北园路29号, including new power transformer workshop/assembly workshop 4 with area 3782.88 square meters for coil drying, core turnover, assembly and related processes; new box workshop 4 with area 1994.4 square meters including painting and shot blasting rooms; modification of existing box workshop 1 with added drying process; after completion, annual transformer capacity increases by 20 sets. Treat as public company development information, not as delivery capacity commitment for quotations.",
    tags: ["official website", "capacity expansion", "2026", "workshop", "annual capacity", "20 sets"],
    visibility: "public_reference",
    version: "official-site-2026-09-01",
  },
];

const products: ProductInput[] = [
  {
    model: "Client-provided range - 11-750kV Power Transformers",
    type: "Power transformer",
    voltagePrim: "11-750kV",
    standard: "IEC / GB / ANSI / BS / DIN subject to project confirmation",
    summary:
      "Client information form lists 11-750kV Power Transformers as the promoted product range. Use for high-level capability discussion and inquiry classification; exact capacity, voltage combination, vector group, impedance, cooling and certification scope require official catalogue confirmation.",
  },
  {
    model: "Client-provided capability - up to 800MVA/750kV transformer",
    type: "Power transformer",
    capacityKva: 800000,
    voltagePrim: "750kV",
    standard: "IEC / GB / ANSI / BS / DIN subject to project confirmation",
    summary:
      "Client information form states R&D, design and manufacturing capability for full capacity and full voltage combinations up to 800MVA/750kV. This is client-provided capability wording and must be confirmed against official product catalogue before external commitment.",
  },
  {
    model: "Public range - oil-immersed power transformer up to 370MVA/500kV",
    type: "Oil-immersed power transformer",
    capacityKva: 370000,
    voltagePrim: "500kV",
    standard: "GB / IEC / ANSI / BS / DIN subject to project confirmation",
    summary:
      "Official website public range: oil-immersed power transformers up to 370MVA/500kV. Use for product classification and capability discussion; exact model and parameters require official datasheet confirmation.",
  },
  {
    model: "Public range - oil-immersed distribution transformer up to 6.3MVA/35kV",
    type: "Oil-immersed distribution transformer",
    capacityKva: 6300,
    voltagePrim: "35kV",
    standard: "GB / IEC subject to project confirmation",
    summary:
      "Official website public range: oil-immersed distribution transformers up to 6.3MVA/35kV. Suitable for distribution and industrial/commercial power supply inquiries; exact parameter matching requires catalogue data.",
  },
  {
    model: "Public range - epoxy resin cast dry-type transformer up to 3.15MVA/35kV",
    type: "Dry-type transformer",
    capacityKva: 3150,
    voltagePrim: "35kV",
    cooling: "AN / AF subject to project configuration",
    standard: "GB1094.11 / IEC subject to project confirmation",
    summary:
      "Official website public range: epoxy resin cast dry-type transformers up to 3.15MVA/35kV. Application references include load centers, high-rise buildings, subways, airports, petrochemical plants, offshore platforms, and fire-protection-sensitive sites.",
  },
  {
    model: "Public category - mobile substation",
    type: "Mobile substation",
    standard: "Project-specific",
    summary:
      "Official website product category: mobile substation integrating transformer, primary equipment, secondary protection and control equipment. Application references include emergency power, maintenance power, temporary power and construction power.",
  },
  {
    model: "Public category - prefabricated substation",
    type: "Prefabricated substation",
    standard: "Project-specific",
    summary:
      "Official website product category: prefabricated substation with high-voltage module, main transformer module and low-voltage module. Applicable to urban centers, coal, oil, photovoltaic, wind power and remote area projects. Website cycle claims require human confirmation before external commitment.",
  },
  {
    model: "Public category - box-type transformer / compact substation",
    type: "Box-type transformer / compact substation",
    standard: "Project-specific",
    summary:
      "Official website product category: American-style and European-style box-type transformer / compact substation for urban distribution, street lighting, industrial and mining enterprises, residential areas, construction sites, airports, oilfields, docks and highways.",
  },
  {
    model: "Client category - reactors",
    type: "Reactor",
    standard: "IEC / GB / ANSI / BS / DIN subject to project confirmation",
    summary:
      "Client information form includes Reactors as related power transmission and transformation equipment. Exact reactor type, voltage, capacity/rating, insulation level, cooling, applicable standard and test requirements must be confirmed from official technical documents.",
  },
  {
    model: "Client category - OLTC transformer",
    type: "OLTC transformer",
    standard: "IEC / GB subject to project confirmation",
    summary:
      "Client information form includes OLTC Transformers. If a buyer mentions on-load tap changer, voltage regulation, tap range or grid voltage fluctuation, the inquiry should be classified as potentially requiring an OLTC transformer and sales should confirm tap range, step, control requirement and standards.",
  },
  {
    model: "Client category - special transformer solutions",
    type: "Special transformer solution",
    standard: "Project-specific",
    summary:
      "Client information form includes Special Transformer Solutions and other special-purpose power transformers. AI should not invent configurations; it should collect application scenario, technical specification, operating environment, standards, certification and project background for engineering review.",
  },
  {
    model: "SCB10 Dry-Type Transformer",
    type: "Dry-type transformer",
    voltagePrim: "10kV",
    voltageSec: "0.4kV",
    cooling: "AN",
    standard: "IEC / GB subject to datasheet confirmation",
    summary:
      "Representative model mentioned in the customer information form. Exact capacity, impedance, vector group, dimensions and certification scope must follow the official catalogue.",
  },
  {
    model: "SSZ22 Three-Winding Power Transformer",
    type: "Three-winding power transformer",
    capacityKva: 360000,
    voltagePrim: "220kV",
    standard: "IEC / GB subject to datasheet confirmation",
    summary:
      "Representative three-winding power transformer model mentioned in the customer information form. Exact voltage ratio, capacity, vector group, impedance and tap-changer data must follow the official catalogue.",
  },
  {
    model: "Website example - 200MVA/330kV autotransformer",
    type: "Power transformer / autotransformer",
    capacityKva: 200000,
    voltagePrim: "330kV",
    voltageSec: "161kV / 34.5kV",
    summary:
      "Official website power transformer page example: 200MVA/330kV autotransformer, 330/161±8*1.25%/34.5kV, YNaod11. Use as public case reference only; not automatic recommendation.",
  },
  {
    model: "Website example - 300MVA/230kV autotransformer",
    type: "Power transformer / autotransformer",
    capacityKva: 300000,
    voltagePrim: "230kV",
    summary:
      "Official website power transformer page example: 300MVA/230kV autotransformer. Use as public case reference only; detailed parameters require official datasheet confirmation.",
  },
  {
    model: "Website example - 67MVA/132kV power transformer",
    type: "Power transformer",
    capacityKva: 67000,
    voltagePrim: "132kV",
    summary:
      "Official website power transformer page example: 67MVA/132kV power transformer. Use as public case reference only; detailed parameters require official datasheet confirmation.",
  },
  {
    model: "Website example - 40MVA/66kV power transformer",
    type: "Power transformer",
    capacityKva: 40000,
    voltagePrim: "66kV",
    summary:
      "Official website power transformer page example: 40MVA/66kV power transformer. Use as public case reference only; detailed parameters require official datasheet confirmation.",
  },
];

const certifications: CertificationInput[] = [
  {
    name: "CE marking / CE certification reference",
    market: "Europe / Project-specific",
    modelScope: "Scope must be checked against original certificates",
    summary:
      "Client information form lists CE together with IEC and ISO as known standard/certification references. Treat as a known certification clue, not as product certification covering all transformers. Original certificate, applicable product range, validity, and whether a specific product carries CE marking must be checked before external release. AI must not treat meeting IEC as having CE, and must not send CE copies without human confirmation.",
  },
  {
    name: "ISO9001 quality management system certification",
    market: "Global",
    modelScope: "Company system certification",
    summary:
      "Official website mentions ISO9001-2000 quality management system certification. Treat as company system certification, not product certification.",
  },
  {
    name: "ISO14001 environmental management system certification",
    market: "Global",
    modelScope: "Company system certification",
    summary:
      "Official website mentions ISO14001 environmental management system certification. Treat as company system certification, not product certification.",
  },
  {
    name: "GB/T 28001 occupational health and safety management system certification",
    market: "China / Global reference",
    modelScope: "Company system certification",
    summary:
      "Official website mentions GB/T 28001-2001 occupational health and safety management system certification. Treat as company system certification, not product certification.",
  },
  {
    name: "GB/T 23331 energy management system certification",
    market: "China / Global reference",
    modelScope: "Company system certification",
    summary:
      "Client information form says the company has GB/T23331 energy management system certification. Treat as company system certification; original certificate, validity and exact English wording must be checked before external release.",
  },
  {
    name: "GB/T 39604 social responsibility management system certification",
    market: "China / Global reference",
    modelScope: "Company system certification",
    summary:
      "Client information form says the company has GB/T39604 social responsibility management system certification. Treat as company system certification; original certificate, validity and exact English wording must be checked before external release.",
  },
  {
    name: "ISO/IEC information security management system certification",
    market: "Global reference",
    modelScope: "Company system certification",
    summary:
      "Client information form says the company has ISO/IEC information security management system certification. Treat as company system certification; original certificate, scope, validity and exact standard number must be checked before external release.",
  },
  {
    name: "ISO28000 security and resilience management system certification",
    market: "Global reference",
    modelScope: "Company system certification",
    summary:
      "Client information form says the company has ISO28000 security and resilience management system certification. Treat as company system certification; original certificate, validity and exact English wording must be checked before external release.",
  },
  {
    name: "PCCC national product certification reference",
    market: "China / Project-specific",
    modelScope: "Scope must be checked against original certificates",
    summary:
      "Client information form says the company has national PCCC certification. AI must not claim that all transformer products are covered; exact product scope, validity and certificate files require manual confirmation.",
  },
  {
    name: "International multilateral certification reference",
    market: "17 countries including US / UK / Germany per website",
    modelScope: "Scope must be checked against original certificates",
    summary:
      "Official website mentions international multilateral certification covering 17 countries including the United States, United Kingdom and Germany. AI must not claim country/product applicability without original certificate review.",
  },
  {
    name: "CTQC transformer test/certification references",
    market: "Project-specific",
    modelScope: "Examples include 26MVA/132kV, 40MVA/66kV, 40MVA/132kV, 51MVA/169kV, 63MVA/110kV, 180MVA/220kV, 33MVA/161kV, 77MVA/235kV",
    summary:
      "Official website qualification pages list multiple CTQC transformer certification/test references. Original certificate files, validity and applicability must be checked before external release.",
  },
  {
    name: "KEMA 180MVA/220kV certification reference",
    market: "Project-specific",
    modelScope: "180MVA/220kV reference listed on official website",
    summary:
      "Official website qualification page lists KEMA 180MVA/220kV certification reference. Original certificate, validity and applicability must be checked before external release.",
  },
  {
    name: "ASTA 100M/220kV certification reference",
    market: "Project-specific",
    modelScope: "100M/220kV reference listed on official website",
    summary:
      "Official website qualification page lists ASTA 100M/220kV certification reference. Original certificate, validity and applicability must be checked before external release.",
  },
  {
    name: "TUV Rheinland transformer certification references",
    market: "Project-specific",
    modelScope: "Examples include 26MVA/132kV, 13MVA/132kV, 40MVA/132kV",
    summary:
      "Official website qualification pages list Rheinland transformer certification references. Original certificate, validity and applicability must be checked before external release.",
  },
  {
    name: "SGS transformer test/certification reference",
    market: "Project-specific",
    modelScope: "Scope must be checked against original certificates",
    summary:
      "Official website mentions SGS among transformer test/certification organizations. Original certificate, validity and applicability must be checked before external release.",
  },
  {
    name: "VEIKI-VNL transformer test/certification reference",
    market: "Project-specific",
    modelScope: "Scope must be checked against original certificates",
    summary:
      "Official website mentions VEIKI-VNL among transformer test/certification organizations. Original certificate, validity and applicability must be checked before external release.",
  },
];


async function upsertSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function upsertKnowledgeDocument(doc: KnowledgeInput) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { sourceType: doc.sourceType, title: doc.title },
  });

  const data = {
    sourceType: doc.sourceType,
    title: doc.title,
    content: doc.content,
    tagsJson: JSON.stringify(doc.tags),
    visibility: doc.visibility ?? "internal",
    version: doc.version,
  };

  if (existing) {
    await prisma.knowledgeDocument.update({ where: { id: existing.id }, data });
    return "updated";
  }

  await prisma.knowledgeDocument.create({ data });
  return "created";
}

async function upsertProduct(product: ProductInput) {
  await prisma.product.upsert({
    where: { model: product.model },
    create: product,
    update: product,
  });
}

async function upsertCertification(certification: CertificationInput) {
  const existing = await prisma.certification.findFirst({
    where: { name: certification.name, market: certification.market },
  });
  if (existing) {
    await prisma.certification.update({ where: { id: existing.id }, data: certification });
    return "updated";
  }
  await prisma.certification.create({ data: certification });
  return "created";
}

async function main() {
  for (const [key, value] of Object.entries(settings)) {
    await upsertSetting(key, value);
  }

  let created = 0;
  let updated = 0;
  for (const doc of knowledgeDocs) {
    const result = await upsertKnowledgeDocument(doc);
    if (result === "created") created += 1;
    else updated += 1;
  }

  for (const product of products) {
    await upsertProduct(product);
  }

  let certificationsCreated = 0;
  let certificationsUpdated = 0;
  for (const certification of certifications) {
    const result = await upsertCertification(certification);
    if (result === "created") certificationsCreated += 1;
    else certificationsUpdated += 1;
  }

  const inquiryAgent = await prisma.agentConfig.findUnique({ where: { code: "inquiry_reply" } });
  if (inquiryAgent) {
    await prisma.agentConfig.update({
      where: { id: inquiryAgent.id },
      data: {
        name: "变压器询盘回复 Agent",
        description: "识别变压器询盘意图、产品类型、应用场景和关键参数，检索企业知识库后生成英文回复草稿，并沉淀客户档案。",
        systemPrompt:
          "You are the inquiry reply Agent for Liaoning EFACEC Electrical Equipment Co., Ltd. Understand the buyer intent, transformer type, application scenario, and quotation readiness. Extract rated voltage, HV, LV, capacity, frequency, vector group, OLTC requirement, impedance, IEC standard, installation altitude, quantity, destination, delivery requirement, and certification requirement. Use only retrieved company knowledge. Source priority: official catalogue, then official datasheet, then human-approved historical materials, then human confirmation. If a fact is not in the current database, say: Information not available in the current database. We will need to confirm this with our sales/engineering team before providing a final commitment. For first replies, thank the buyer, summarize identified demand, list known parameters, ask missing parameters in priority order, and request the technical specification if available. Payment terms are negotiable and will be confirmed by sales. Quotation validity will be stated in the formal quotation. Mark urgent delivery requests as Urgent and route to sales/production; do not invent a shorter lead time. A-grade leads should be flagged for human sales follow-up within 24 hours. Never invent models, certifications, impedance, prices, delivery dates, factory cases, project photos, payment ratios, warranty years, or technical commitments. Never disclose cost, margin, floor price, commissions, unreleased schedules, unauthorized drawings/test reports, customer databases, or account credentials. All final price, delivery, certification scope, payment, warranty, and contractual commitments require human approval.",
        modelProvider: "api",
        modelName: "configured-ai-model",
        channelsJson: JSON.stringify(["manual", "website_form", "alibaba"]),
      },
    });
  }

  console.log("LEEEC client info imported.");
  console.log(`Settings upserted: ${Object.keys(settings).length}`);
  console.log(`Products upserted: ${products.length}`);
  console.log(`Certifications created: ${certificationsCreated}`);
  console.log(`Certifications updated: ${certificationsUpdated}`);
  console.log(`Knowledge documents created: ${created}`);
  console.log(`Knowledge documents updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
