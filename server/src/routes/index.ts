import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getActor, writeAudit } from "../lib/audit.js";
import { emailAdapter } from "../adapters/email.js";
import { websiteFormAdapter } from "../adapters/websiteForm.js";
import { alibabaAdapter } from "../adapters/alibaba.js";
import {
  analyzeInquiry,
  approveInquiry,
  createInquiryFromNormalized,
  rejectInquiry,
  serializeInquiry,
} from "../services/inquiryAgent.js";
import {
  ensureDefaultAgents,
  ensureDefaultSettings,
  serializeAgent,
} from "../services/agentConfig.js";
import { getAiConfig, updateAiConfig } from "../services/aiConfig.js";
import { askAiAssistant, getAssistantSnapshot } from "../services/aiAssistant.js";
import { ensureDefaultUser, getWorkbenchUser, loginWorkbench, updateWorkbenchProfile } from "../services/auth.js";
import {
  chatInSession,
  createAssistantSession,
  deleteAssistantSession,
  getAssistantSession,
  listAssistantSessions,
  renameAssistantSession,
} from "../services/assistantSessions.js";
import { searchKnowledgeBase } from "../services/knowledgeRetrieval.js";
import { INQUIRY_AGENT_SKILLS } from "../services/inquirySkills.js";

export async function registerRoutes(app: FastifyInstance) {
  await ensureDefaultAgents();
  await ensureDefaultSettings();
  await ensureDefaultUser();

  app.get("/api/health", async () => ({
    ok: true,
    service: "transformer-agent-server",
    time: new Date().toISOString(),
  }));

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { username?: string; password?: string };
    try {
      const user = await loginWorkbench(body.username ?? "", body.password ?? "");
      return { user };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "CREDENTIALS_REQUIRED") {
        return reply.code(400).send({ error: "CREDENTIALS_REQUIRED", message: "请输入账号和密码" });
      }
      if (msg === "INVALID_CREDENTIALS") {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "账号或密码不正确" });
      }
      throw e;
    }
  });

  app.get("/api/auth/me", async (req, reply) => {
    try {
      return { user: await getWorkbenchUser(getActor(req.headers as Record<string, unknown>)) };
    } catch (e) {
      if ((e as Error).message === "UNAUTHORIZED") {
        return reply.code(401).send({ error: "UNAUTHORIZED", message: "请先登录" });
      }
      throw e;
    }
  });

  app.patch("/api/auth/profile", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = (req.body ?? {}) as {
      displayName?: string;
      title?: string;
      avatarUrl?: string | null;
      clearAvatar?: boolean;
      currentPassword?: string;
      newPassword?: string;
    };
    try {
      const user = await updateWorkbenchProfile(actor, body);
      return { user };
    } catch (e) {
      const msg = (e as Error).message;
      const map: Record<string, [number, string]> = {
        UNAUTHORIZED: [401, "请先登录"],
        NAME_REQUIRED: [400, "请填写显示名称"],
        NAME_TOO_LONG: [400, "名称不要超过 20 个字"],
        TITLE_TOO_LONG: [400, "职务不要超过 30 个字"],
        AVATAR_INVALID: [400, "头像格式不正确"],
        AVATAR_TOO_LARGE: [400, "头像文件过大，请换一张更小的图"],
        CURRENT_PASSWORD_REQUIRED: [400, "修改密码需要填写当前密码"],
        INVALID_CURRENT_PASSWORD: [400, "当前密码不正确"],
        PASSWORD_TOO_SHORT: [400, "新密码至少 6 位"],
      };
      const mapped = map[msg];
      if (mapped) return reply.code(mapped[0]).send({ error: msg, message: mapped[1] });
      throw e;
    }
  });

  app.get("/api/agents", async () => {
    const items = await prisma.agentConfig.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return { items: items.map(serializeAgent) };
  });

  app.get("/api/agent-skills", async () => ({
    items: INQUIRY_AGENT_SKILLS,
  }));

  app.get("/api/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.agentConfig.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    return serializeAgent(row);
  });

  app.post("/api/agents", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      code: string;
      name: string;
      type?: string;
      description?: string;
      enabled?: boolean;
      systemPrompt?: string;
      modelProvider?: string;
      modelName?: string;
      temperature?: number;
      channels?: string[];
      extra?: Record<string, unknown>;
      sortOrder?: number;
    };
    if (!body.code?.trim() || !body.name?.trim()) {
      return reply.code(400).send({ error: "CODE_AND_NAME_REQUIRED" });
    }
    const code = body.code.trim().toLowerCase().replace(/\s+/g, "_");
    const exists = await prisma.agentConfig.findUnique({ where: { code } });
    if (exists) return reply.code(409).send({ error: "CODE_EXISTS" });

    const row = await prisma.agentConfig.create({
      data: {
        code,
        name: body.name.trim(),
        type: body.type?.trim() || "custom",
        description: body.description ?? null,
        enabled: body.enabled ?? true,
        systemPrompt: body.systemPrompt ?? null,
        modelProvider: body.modelProvider ?? "rules",
        modelName: body.modelName ?? "local-rules",
        temperature: body.temperature ?? 0.2,
        channelsJson: JSON.stringify(body.channels ?? ["manual"]),
        extraJson: body.extra ? JSON.stringify(body.extra) : null,
        sortOrder: body.sortOrder ?? 99,
      },
    });
    await writeAudit({ actor, action: "agent.create", objectType: "agent", objectId: row.id, after: serializeAgent(row) });
    return serializeAgent(row);
  });

  app.patch("/api/agents/:id", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = req.body as {
      name?: string;
      type?: string;
      description?: string;
      enabled?: boolean;
      systemPrompt?: string;
      modelProvider?: string;
      modelName?: string;
      temperature?: number;
      channels?: string[];
      extra?: Record<string, unknown>;
      sortOrder?: number;
    };
    const before = await prisma.agentConfig.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: "NOT_FOUND" });

    const row = await prisma.agentConfig.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        type: body.type?.trim() || undefined,
        description: body.description === undefined ? undefined : body.description,
        enabled: body.enabled,
        systemPrompt: body.systemPrompt === undefined ? undefined : body.systemPrompt,
        modelProvider: body.modelProvider,
        modelName: body.modelName,
        temperature: body.temperature,
        channelsJson: body.channels ? JSON.stringify(body.channels) : undefined,
        extraJson: body.extra ? JSON.stringify(body.extra) : undefined,
        sortOrder: body.sortOrder,
      },
    });
    await writeAudit({
      actor,
      action: "agent.update",
      objectType: "agent",
      objectId: id,
      before: serializeAgent(before),
      after: serializeAgent(row),
    });
    return serializeAgent(row);
  });

  app.delete("/api/agents/:id", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const before = await prisma.agentConfig.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: "NOT_FOUND" });
    if (["inquiry_reply", "seo_content", "video_publish"].includes(before.code)) {
      return reply.code(400).send({ error: "BUILTIN_AGENT_LOCKED", message: "内置 Agent 不可删除，可停用或修改配置" });
    }
    await prisma.agentConfig.delete({ where: { id } });
    await writeAudit({ actor, action: "agent.delete", objectType: "agent", objectId: id, before: serializeAgent(before) });
    return { ok: true };
  });

  app.get("/api/settings", async () => {
    const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { items: rows, map };
  });

  app.put("/api/settings", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as { map?: Record<string, string> };
    const map = body.map ?? {};
    for (const [key, value] of Object.entries(map)) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
    }
    await writeAudit({ actor, action: "settings.update", objectType: "settings", after: map });
    const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    return { items: rows, map: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  });

  app.get("/api/ai-config", async () => {
    return getAiConfig();
  });

  app.put("/api/ai-config", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      provider?: "deepseek" | "qwen" | "openai" | "claude" | "custom";
      model?: string;
      baseUrl?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      requireConfigured?: boolean;
    };
    const before = await getAiConfig();
    const after = await updateAiConfig(body);
    await writeAudit({
      actor,
      action: "ai_config.update",
      objectType: "ai_config",
      before,
      after: { ...after, apiKeyMasked: after.apiKeyMasked ? "***" : "" },
    });
    return after;
  });

  app.get("/api/ai-config/status", async () => {
    const config = await getAiConfig();
    return {
      ok: config.hasApiKey,
      message: config.hasApiKey ? "AI model is configured" : "AI model API key is not configured",
      config,
    };
  });

  app.get("/api/ai-assistant/snapshot", async () => {
    return getAssistantSnapshot();
  });

  app.get("/api/ai-assistant/sessions", async () => {
    return { items: await listAssistantSessions() };
  });

  app.post("/api/ai-assistant/sessions", async (req) => {
    const body = (req.body ?? {}) as { language?: "zh" | "en" };
    return createAssistantSession(body.language === "en" ? "en" : "zh");
  });

  app.get("/api/ai-assistant/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await getAssistantSession(id);
    } catch (e) {
      if ((e as Error).message === "SESSION_NOT_FOUND") {
        return reply.code(404).send({ error: "SESSION_NOT_FOUND", message: "会话不存在" });
      }
      throw e;
    }
  });

  app.patch("/api/ai-assistant/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { title?: string };
    try {
      return await renameAssistantSession(id, body.title ?? "");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "SESSION_NOT_FOUND") return reply.code(404).send({ error: "SESSION_NOT_FOUND", message: "会话不存在" });
      if (msg === "TITLE_REQUIRED") return reply.code(400).send({ error: "TITLE_REQUIRED", message: "请输入会话名称" });
      throw e;
    }
  });

  app.delete("/api/ai-assistant/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await deleteAssistantSession(id);
    } catch (e) {
      if ((e as Error).message === "SESSION_NOT_FOUND") {
        return reply.code(404).send({ error: "SESSION_NOT_FOUND", message: "会话不存在" });
      }
      throw e;
    }
  });

  app.post("/api/ai-assistant/sessions/:id/chat", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { question?: string; language?: "zh" | "en" };
    try {
      const result = await chatInSession(id, body.question ?? "", body.language === "en" ? "en" : "zh");
      await writeAudit({
        actor,
        action: "ai_assistant.chat",
        objectType: "ai_assistant_session",
        objectId: id,
        after: {
          question: body.question,
          provider: result.model.provider,
          model: result.model.model,
        },
      });
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "SESSION_NOT_FOUND") return reply.code(404).send({ error: "SESSION_NOT_FOUND", message: "会话不存在" });
      if (msg === "QUESTION_REQUIRED") {
        return reply.code(400).send({ error: "QUESTION_REQUIRED", message: "请输入要咨询的问题" });
      }
      if (msg === "AI_CONFIG_REQUIRED") {
        return reply.code(400).send({ error: "AI_CONFIG_REQUIRED", message: "AI 模型未配置，请先在 AI 模型配置中填写可用 API Key" });
      }
      if (msg.startsWith("AI_SERVICE_FAILED")) {
        return reply.code(502).send({ error: "AI_SERVICE_FAILED", message: "AI 服务调用失败，请检查 API Key、模型名称和接口地址" });
      }
      if (msg === "AI_OUTPUT_PARSE_FAILED") {
        return reply.code(502).send({ error: "AI_OUTPUT_PARSE_FAILED", message: "AI 输出解析失败，请重试或更换模型" });
      }
      throw e;
    }
  });

  app.post("/api/ai-assistant/chat", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = (req.body ?? {}) as {
      question?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      language?: "zh" | "en";
    };
    try {
      const result = await askAiAssistant(body.question ?? "", body.history ?? [], body.language === "en" ? "en" : "zh");
      await writeAudit({
        actor,
        action: "ai_assistant.chat",
        objectType: "ai_assistant",
        after: {
          question: body.question,
          provider: result.model.provider,
          model: result.model.model,
        },
      });
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "QUESTION_REQUIRED") {
        return reply.code(400).send({ error: "QUESTION_REQUIRED", message: "请输入要咨询的问题" });
      }
      if (msg === "AI_CONFIG_REQUIRED") {
        return reply.code(400).send({ error: "AI_CONFIG_REQUIRED", message: "AI 模型未配置，请先在 AI 模型配置中填写可用 API Key" });
      }
      if (msg.startsWith("AI_SERVICE_FAILED")) {
        return reply.code(502).send({ error: "AI_SERVICE_FAILED", message: "AI 服务调用失败，请检查 API Key、模型名称和接口地址" });
      }
      if (msg === "AI_OUTPUT_PARSE_FAILED") {
        return reply.code(502).send({ error: "AI_OUTPUT_PARSE_FAILED", message: "AI 输出解析失败，请重试或更换模型" });
      }
      throw e;
    }
  });

  app.get("/api/inquiries", async (req) => {
    const query = req.query as {
      status?: string;
      channel?: string;
      reply?: string;
      leadGrade?: string;
      q?: string;
      sort?: string;
      page?: string;
      pageSize?: string;
    };

    const page = Math.max(1, Number(query.page || 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10) || 10));
    const sort = query.sort || "createdAt_desc";
    const orderBy =
      sort === "createdAt_asc"
        ? { createdAt: "asc" as const }
        : sort === "updatedAt_asc"
          ? { updatedAt: "asc" as const }
          : sort === "updatedAt_desc"
            ? { updatedAt: "desc" as const }
            : { createdAt: "desc" as const };

    const q = (query.q || "").trim();
    const reply = (query.reply || "").trim();
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadGrade ? { leadGrade: query.leadGrade } : {}),
      ...(reply === "replied"
        ? { status: "sent" }
        : reply === "unreplied"
          ? { status: { not: "sent" } }
          : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(q
        ? {
            OR: [
              { buyerCompany: { contains: q } },
              { buyerName: { contains: q } },
              { buyerEmail: { contains: q } },
              { buyerCountry: { contains: q } },
              { rawText: { contains: q } },
              { recommendedModel: { contains: q } },
              { businessIntent: { contains: q } },
              { productType: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        include: { sourceHits: true, customer: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(serializeInquiry),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });

  app.get("/api/inquiries/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.inquiry.findUnique({
      where: { id },
      include: { sourceHits: true, customer: true },
    });
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    return serializeInquiry(row);
  });

  app.post("/api/inquiries", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      channel?: string;
      rawText: string;
      buyerCompany?: string;
      buyerName?: string;
      buyerEmail?: string;
      buyerCountry?: string;
    };
    const inquiry = await createInquiryFromNormalized(
      {
        channel: (body.channel as "manual") || "manual",
        rawText: body.rawText,
        buyerCompany: body.buyerCompany,
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        buyerCountry: body.buyerCountry,
      },
      actor,
    );
    return serializeInquiry(inquiry);
  });

  app.post("/api/inquiries/:id/analyze", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    try {
      const row = await analyzeInquiry(id, actor);
      return serializeInquiry(row);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "INQUIRY_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      if (msg === "AGENT_DISABLED") return reply.code(400).send({ error: "AGENT_DISABLED", message: "询盘回复 Agent 已停用，请在设置中启用" });
      if (msg === "AI_CONFIG_REQUIRED") {
        return reply.code(400).send({ error: "AI_CONFIG_REQUIRED", message: "AI 模型未配置，请先在 AI 模型配置中填写可用 API Key" });
      }
      if (msg.startsWith("AI_SERVICE_FAILED")) {
        return reply.code(502).send({ error: "AI_SERVICE_FAILED", message: "AI 服务调用失败，请检查 API Key、模型名称和接口地址" });
      }
      if (msg === "AI_OUTPUT_PARSE_FAILED") {
        return reply.code(502).send({ error: "AI_OUTPUT_PARSE_FAILED", message: "AI 输出解析失败，请重试或更换模型" });
      }
      throw e;
    }
  });

  app.patch("/api/inquiries/:id", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = req.body as {
      draftReply?: string;
      missingQuestions?: string[];
      owner?: string;
      status?: string;
    };
    const before = await prisma.inquiry.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: "NOT_FOUND" });

    const row = await prisma.inquiry.update({
      where: { id },
      data: {
        draftReply: body.draftReply ?? undefined,
        missingQuestionsJson:
          body.missingQuestions !== undefined ? JSON.stringify(body.missingQuestions) : undefined,
        owner: body.owner ?? undefined,
        status: body.status ?? undefined,
      },
      include: { sourceHits: true, customer: true },
    });

    await writeAudit({
      actor,
      action: "inquiry.update",
      objectType: "inquiry",
      objectId: id,
      before: { draftReply: before.draftReply, status: before.status },
      after: { draftReply: row.draftReply, status: row.status },
    });

    return serializeInquiry(row);
  });

  app.post("/api/inquiries/:id/approve", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { comment?: string };
    try {
      const row = await approveInquiry(id, actor, body.comment);
      return serializeInquiry(row);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "INQUIRY_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      if (msg === "DRAFT_REQUIRED") return reply.code(400).send({ error: "DRAFT_REQUIRED" });
      throw e;
    }
  });

  app.post("/api/inquiries/:id/reject", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { comment?: string };
    try {
      const row = await rejectInquiry(id, actor, body.comment);
      return serializeInquiry(row);
    } catch (e) {
      if ((e as Error).message === "INQUIRY_NOT_FOUND") return reply.code(404).send({ error: "NOT_FOUND" });
      throw e;
    }
  });

  app.post("/api/inquiries/:id/send", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const inquiry = await prisma.inquiry.findUnique({ where: { id }, include: { customer: true } });
    if (!inquiry) return reply.code(404).send({ error: "NOT_FOUND" });
    if (inquiry.status !== "approved" && inquiry.status !== "sent") {
      return reply.code(400).send({ error: "NEED_APPROVAL" });
    }
    if (!inquiry.draftReply) return reply.code(400).send({ error: "DRAFT_REQUIRED" });

    const to = inquiry.buyerEmail || inquiry.customer?.email;
    if (!to) return reply.code(400).send({ error: "MISSING_BUYER_EMAIL" });

    const sendResult = await emailAdapter.send({
      to,
      subject: `Re: Transformer Inquiry - ${inquiry.recommendedModel ?? "Export Sales"}`,
      body: inquiry.draftReply,
      inquiryId: inquiry.id,
      customerId: inquiry.customerId ?? undefined,
    });

    const updated = await prisma.inquiry.update({
      where: { id },
      data: { status: "sent" },
      include: { sourceHits: true, customer: true },
    });

    await prisma.approvalRecord.create({
      data: {
        objectType: "inquiry",
        objectId: id,
        inquiryId: id,
        action: "send",
        actor,
        comment: `mock email to ${to}`,
        afterJson: JSON.stringify(sendResult),
      },
    });

    await writeAudit({
      actor,
      action: "inquiry.send",
      objectType: "inquiry",
      objectId: id,
      after: sendResult,
    });

    return { inquiry: serializeInquiry(updated), email: sendResult };
  });

  app.get("/api/products", async () => {
    const items = await prisma.product.findMany({
      include: { specs: true, certLinks: { include: { certification: true } } },
      orderBy: { model: "asc" },
    });
    return { items };
  });

  app.post("/api/products", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      model: string;
      type: string;
      capacityKva?: number;
      voltagePrim?: string;
      voltageSec?: string;
      frequency?: string;
      cooling?: string;
      phase?: string;
      standard?: string;
      summary?: string;
    };
    if (!body.model?.trim() || !body.type?.trim()) {
      return reply.code(400).send({ error: "MODEL_AND_TYPE_REQUIRED", message: "请填写产品型号和类型" });
    }
    try {
      const item = await prisma.product.create({
        data: {
          model: body.model.trim(),
          type: body.type.trim(),
          capacityKva: body.capacityKva,
          voltagePrim: body.voltagePrim?.trim() || null,
          voltageSec: body.voltageSec?.trim() || null,
          frequency: body.frequency?.trim() || null,
          cooling: body.cooling?.trim() || null,
          phase: body.phase?.trim() || null,
          standard: body.standard?.trim() || null,
          summary: body.summary?.trim() || null,
        },
      });
      await writeAudit({ actor, action: "product.create", objectType: "product", objectId: item.id, after: item });
      return item;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "MODEL_EXISTS", message: "该型号已存在" });
      }
      throw e;
    }
  });

  app.get("/api/certifications", async () => {
    const items = await prisma.certification.findMany({
      include: { products: { include: { product: true } } },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/api/certifications", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      name?: string;
      market?: string;
      modelScope?: string;
      validUntil?: string;
      summary?: string;
    };
    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "NAME_REQUIRED", message: "请填写认证名称" });
    }
    const item = await prisma.certification.create({
      data: {
        name: body.name.trim(),
        market: body.market?.trim() || null,
        modelScope: body.modelScope?.trim() || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        summary: body.summary?.trim() || null,
      },
    });
    await writeAudit({ actor, action: "certification.create", objectType: "certification", objectId: item.id, after: item });
    return item;
  });

  function serializeKnowledgeDocument(item: {
    id: string;
    sourceType: string;
    title: string;
    content: string;
    tagsJson: string;
    visibility: string;
    version: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...item,
      tags: JSON.parse(item.tagsJson || "[]") as string[],
    };
  }

  app.get("/api/knowledge/search", async (req, reply) => {
    const query = req.query as { q?: string; limit?: string };
    const q = (query.q || "").trim();
    if (!q) return reply.code(400).send({ error: "QUERY_REQUIRED", message: "请输入检索内容" });
    const limit = Number(query.limit || 12) || 12;
    const items = await searchKnowledgeBase(q, { limit });
    return { query: q, items, total: items.length };
  });

  app.get("/api/knowledge-documents", async (req) => {
    const query = req.query as {
      page?: string;
      pageSize?: string;
      q?: string;
    };
    const page = Math.max(1, Number(query.page || 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10) || 10));
    const keyword = (query.q || "").trim();
    const where = keyword
      ? {
          OR: [
            { sourceType: { contains: keyword } },
            { title: { contains: keyword } },
            { content: { contains: keyword } },
            { tagsJson: { contains: keyword } },
            { version: { contains: keyword } },
            { visibility: { contains: keyword } },
          ],
        }
      : undefined;
    const [total, items] = await Promise.all([
      prisma.knowledgeDocument.count({ where }),
      prisma.knowledgeDocument.findMany({
        where,
        orderBy: [{ sourceType: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: items.map(serializeKnowledgeDocument),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });

  app.get("/api/knowledge-documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!item) return reply.code(404).send({ error: "NOT_FOUND", message: "资料不存在" });
    return serializeKnowledgeDocument(item);
  });

  app.post("/api/knowledge-documents", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      sourceType?: string;
      title?: string;
      content?: string;
      tags?: string[];
      visibility?: string;
      version?: string;
    };
    const title = body.title?.trim() || "";
    const content = body.content?.trim() || "";
    const sourceType = (body.sourceType?.trim() || "manual_entry").replace(/\s+/g, "_");
    if (!title || !content) {
      return reply.code(400).send({ error: "TITLE_AND_CONTENT_REQUIRED", message: "请填写标题和内容" });
    }
    const visibility = body.visibility === "restricted" || body.visibility === "public_reference" ? body.visibility : "internal";
    const item = await prisma.knowledgeDocument.create({
      data: {
        sourceType,
        title,
        content,
        tagsJson: JSON.stringify(Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : []),
        visibility,
        version: body.version?.trim() || `manual-${new Date().toISOString().slice(0, 10)}`,
      },
    });
    await writeAudit({ actor, action: "knowledge.create", objectType: "knowledge_document", objectId: item.id, after: serializeKnowledgeDocument(item) });
    return serializeKnowledgeDocument(item);
  });

  app.patch("/api/knowledge-documents/:id", async (req, reply) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const { id } = req.params as { id: string };
    const body = req.body as {
      sourceType?: string;
      title?: string;
      content?: string;
      tags?: string[];
      visibility?: string;
      version?: string;
    };
    const before = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: "NOT_FOUND", message: "资料不存在" });
    const item = await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        sourceType: body.sourceType?.trim() ? body.sourceType.trim().replace(/\s+/g, "_") : undefined,
        title: body.title?.trim() || undefined,
        content: body.content === undefined ? undefined : body.content.trim(),
        tagsJson: body.tags ? JSON.stringify(body.tags.map((t) => String(t).trim()).filter(Boolean)) : undefined,
        visibility:
          body.visibility === "restricted" || body.visibility === "public_reference" || body.visibility === "internal"
            ? body.visibility
            : undefined,
        version: body.version === undefined ? undefined : body.version.trim() || null,
      },
    });
    await writeAudit({
      actor,
      action: "knowledge.update",
      objectType: "knowledge_document",
      objectId: id,
      before: serializeKnowledgeDocument(before),
      after: serializeKnowledgeDocument(item),
    });
    return serializeKnowledgeDocument(item);
  });

  app.get("/api/quotes/rules", async () => {
    const items = await prisma.quoteRule.findMany({ orderBy: { updatedAt: "desc" } });
    return { items };
  });

  app.get("/api/quotes/history", async () => {
    const items = await prisma.historicalQuote.findMany({
      include: { product: true, customer: true },
      orderBy: { quotedAt: "desc" },
    });
    return { items };
  });

  app.get("/api/customers", async () => {
    const items = await prisma.customer.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { inquiries: true, touchpoints: true } },
      },
    });
    return { items };
  });

  app.get("/api/customers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await prisma.customer.findUnique({
      where: { id },
      include: {
        inquiries: {
          orderBy: { createdAt: "desc" },
          include: { sourceHits: true },
        },
        touchpoints: { orderBy: { createdAt: "desc" }, take: 50 },
        emails: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    return {
      ...item,
      inquiries: item.inquiries.map(serializeInquiry),
    };
  });

  app.post("/api/customers", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const body = req.body as {
      company: string;
      country?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      channel?: string;
      notes?: string;
    };
    const item = await prisma.customer.create({ data: body });
    await writeAudit({ actor, action: "customer.create", objectType: "customer", objectId: item.id, after: item });
    return item;
  });

  app.get("/api/approvals", async () => {
    const items = await prisma.approvalRecord.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return { items };
  });

  app.get("/api/audit-logs", async () => {
    const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return { items };
  });

  app.post("/api/webhooks/website-form", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const normalized = await websiteFormAdapter.pullOrReceive(req.body);
    const created = [];
    for (const item of normalized) {
      created.push(serializeInquiry(await createInquiryFromNormalized(item, actor)));
    }
    return { created };
  });

  app.post("/api/integrations/alibaba/sync", async (req) => {
    const actor = getActor(req.headers as Record<string, unknown>);
    const items = await alibabaAdapter.pullOrReceive();
    const created = [];
    for (const item of items) {
      created.push(serializeInquiry(await createInquiryFromNormalized(item, actor)));
    }
    return {
      created,
      count: created.length,
      note: "Alibaba adapter is stubbed. Replace adapters/alibaba.ts with Open API implementation when credentials are ready.",
    };
  });
}
