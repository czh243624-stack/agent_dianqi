import { useEffect, useMemo, useState } from "react";
import { getAiConfig, updateAiConfig, type AiConfig } from "../api";

const PROVIDERS: Array<{ value: AiConfig["provider"]; label: string; model: string; baseUrl: string }> = [
  { value: "deepseek", label: "DeepSeek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
  { value: "qwen", label: "通义千问 / Qwen", model: "qwen-plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { value: "openai", label: "OpenAI", model: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" },
  { value: "claude", label: "Claude", model: "claude-sonnet-4-5", baseUrl: "https://api.anthropic.com" },
  { value: "custom", label: "自定义兼容接口", model: "", baseUrl: "" },
];

export function AiConfigPage() {
  const [provider, setProvider] = useState<AiConfig["provider"]>("deepseek");
  const [model, setModel] = useState("deepseek-chat");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentProvider = useMemo(() => PROVIDERS.find((item) => item.value === provider), [provider]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const config = await getAiConfig();
      setProvider(config.provider);
      setModel(config.model);
      setBaseUrl(config.baseUrl);
      setHasApiKey(config.hasApiKey);
      setApiKeyMasked(config.apiKeyMasked);
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const applyProviderPreset = (next: AiConfig["provider"]) => {
    setProvider(next);
    const preset = PROVIDERS.find((item) => item.value === next);
    if (preset && next !== "custom") {
      setModel(preset.model);
      setBaseUrl(preset.baseUrl);
    }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await updateAiConfig({
        provider,
        model,
        baseUrl,
        apiKey: apiKey.trim() || undefined,
        requireConfigured: true,
      });
      setHasApiKey(saved.hasApiKey);
      setApiKeyMasked(saved.apiKeyMasked);
      setApiKey("");
      setMessage("AI 模型配置已保存。正式接入模型后，未配置或调用失败会直接报错，不走规则兜底。");
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm("确认清除当前 API Key？清除后正式 AI 分析会提示模型未配置。")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await updateAiConfig({ clearApiKey: true, requireConfigured: true });
      setHasApiKey(saved.hasApiKey);
      setApiKeyMasked(saved.apiKeyMasked);
      setApiKey("");
      setMessage("API Key 已清除。");
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ry-card">
      <div className="ry-card-hd">
        <h2>AI 模型配置</h2>
        <button className="ry-btn ry-btn-plain" type="button" onClick={load} disabled={busy}>
          刷新配置
        </button>
      </div>
      <div className="ry-card-bd">
        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <div className="success-banner">{message}</div> : null}

        <div className="ry-alert">
          <strong>项目决策：</strong>
          正式 AI 分析不使用规则兜底。API Key 未配置、API 调用失败、AI 输出格式错误时，系统应直接报错。
          系统通过企业知识库资料、业务提示词和结构化输出格式，让模型理解变压器外贸询盘业务。
        </div>

        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>模型服务商</label>
            <select className="ry-select block" value={provider} onChange={(e) => applyProviderPreset(e.target.value as AiConfig["provider"])}>
              {PROVIDERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ry-form-row">
            <label>模型名称</label>
            <input className="ry-input block" value={model} onChange={(e) => setModel(e.target.value)} placeholder={currentProvider?.model || "model"} />
          </div>

          <div className="ry-form-row">
            <label>API Base URL</label>
            <input className="ry-input block" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={currentProvider?.baseUrl || "https://..."} />
          </div>

          <div className="ry-form-row">
            <label>API Key</label>
            <input
              className="ry-input block"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? `已配置：${apiKeyMasked}，留空则不修改` : "请输入 API Key"}
              type="password"
            />
          </div>
        </div>

        <div className="ai-config-status">
          <div>
            <span className={hasApiKey ? "status-dot on" : "status-dot off"} />
            {hasApiKey ? `API Key 已配置（${apiKeyMasked}）` : "API Key 未配置"}
          </div>
          <div>当前模式：真实 API 调用；不训练模型；不启用规则兜底。</div>
        </div>

        <div className="ry-actions">
          <button className="ry-btn ry-btn-primary" type="button" onClick={save} disabled={busy}>
            保存 AI 配置
          </button>
          <button className="ry-btn ry-btn-danger" type="button" onClick={clearKey} disabled={busy || !hasApiKey}>
            清除 API Key
          </button>
        </div>
      </div>
    </div>
  );
}
