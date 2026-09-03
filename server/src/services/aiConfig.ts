import { prisma } from "../db.js";

const SETTING_KEYS = {
  provider: "ai_provider",
  model: "ai_model",
  baseUrl: "ai_base_url",
  apiKey: "ai_api_key",
  mode: "ai_mode",
  requireConfigured: "ai_require_configured",
} as const;

export type AiProvider = "deepseek" | "qwen" | "openai" | "claude" | "custom";

export type AiConfigInput = {
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  mode?: "api";
  requireConfigured?: boolean;
};

export type AiConfigDTO = {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  mode: "api";
  requireConfigured: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export type AiRuntimeConfig = AiConfigDTO & {
  apiKey: string;
};

function maskKey(value: string | undefined) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

async function getSettingMap() {
  const rows = await prisma.systemSetting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function defaultBaseUrl(provider: AiProvider) {
  switch (provider) {
    case "deepseek":
      return "https://api.deepseek.com";
    case "qwen":
      return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "claude":
      return "https://api.anthropic.com";
    default:
      return "";
  }
}

export function defaultModel(provider: AiProvider) {
  switch (provider) {
    case "deepseek":
      return "deepseek-chat";
    case "qwen":
      return "qwen-plus";
    case "openai":
      return "gpt-4.1-mini";
    case "claude":
      return "claude-sonnet-4-5";
    default:
      return "";
  }
}

export async function getAiConfig(): Promise<AiConfigDTO> {
  const map = await getSettingMap();
  const provider = ((map[SETTING_KEYS.provider] || process.env.AI_PROVIDER || "deepseek") as AiProvider);
  const apiKey = map[SETTING_KEYS.apiKey] || process.env.AI_API_KEY || "";
  return {
    provider,
    model: map[SETTING_KEYS.model] || process.env.AI_MODEL || defaultModel(provider),
    baseUrl: map[SETTING_KEYS.baseUrl] || process.env.AI_BASE_URL || defaultBaseUrl(provider),
    mode: "api",
    requireConfigured: (map[SETTING_KEYS.requireConfigured] || process.env.AI_REQUIRE_CONFIGURED || "true") !== "false",
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: maskKey(apiKey),
  };
}

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const map = await getSettingMap();
  const provider = ((map[SETTING_KEYS.provider] || process.env.AI_PROVIDER || "deepseek") as AiProvider);
  const apiKey = map[SETTING_KEYS.apiKey] || process.env.AI_API_KEY || "";
  const dto = await getAiConfig();
  return {
    ...dto,
    provider,
    model: map[SETTING_KEYS.model] || process.env.AI_MODEL || defaultModel(provider),
    baseUrl: map[SETTING_KEYS.baseUrl] || process.env.AI_BASE_URL || defaultBaseUrl(provider),
    apiKey,
  };
}

export async function updateAiConfig(input: AiConfigInput): Promise<AiConfigDTO> {
  const current = await getAiConfig();
  const provider = input.provider ?? current.provider;
  const entries: Record<string, string> = {
    [SETTING_KEYS.provider]: provider,
    [SETTING_KEYS.model]: input.model?.trim() || current.model || defaultModel(provider),
    [SETTING_KEYS.baseUrl]: input.baseUrl?.trim() || current.baseUrl || defaultBaseUrl(provider),
    [SETTING_KEYS.mode]: "api",
    [SETTING_KEYS.requireConfigured]: String(input.requireConfigured ?? true),
  };

  if (input.clearApiKey) {
    await prisma.systemSetting.deleteMany({ where: { key: SETTING_KEYS.apiKey } });
  } else if (input.apiKey !== undefined) {
    const nextKey = input.apiKey.trim();
    if (nextKey) entries[SETTING_KEYS.apiKey] = nextKey;
  }

  for (const [key, value] of Object.entries(entries)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return getAiConfig();
}

export async function assertAiConfigured() {
  const config = await getAiRuntimeConfig();
  if (config.requireConfigured && !config.hasApiKey) {
    throw new Error("AI_CONFIG_REQUIRED");
  }
  return config;
}
