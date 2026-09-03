import type { AiRuntimeConfig } from "./aiConfig.js";

export type AiTextRequest = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

function normalizeBaseUrl(baseUrl: string, provider: AiRuntimeConfig["provider"]) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  if (!trimmed) throw new Error("AI_BASE_URL_REQUIRED");
  if (provider === "deepseek") return `${trimmed}/chat/completions`;
  if (provider === "openai" || provider === "qwen" || provider === "custom") return `${trimmed}/chat/completions`;
  return trimmed;
}

async function callChatCompletions(config: AiRuntimeConfig, request: AiTextRequest) {
  const endpoint = normalizeBaseUrl(config.baseUrl, config.provider);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI_SERVICE_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI_OUTPUT_PARSE_FAILED");
  return content;
}

async function callClaude(config: AiRuntimeConfig, request: AiTextRequest) {
  const endpoint = `${config.baseUrl.replace(/\/+$/g, "")}/v1/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      max_tokens: request.maxTokens ?? 1600,
      temperature: request.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI_SERVICE_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = data.content?.find((item) => item.type === "text" || item.text)?.text?.trim();
  if (!content) throw new Error("AI_OUTPUT_PARSE_FAILED");
  return content;
}

export async function callAiText(config: AiRuntimeConfig, request: AiTextRequest) {
  return config.provider === "claude" ? callClaude(config, request) : callChatCompletions(config, request);
}

export function parseAiJsonObject<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI_OUTPUT_PARSE_FAILED");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new Error("AI_OUTPUT_PARSE_FAILED");
  }
}
