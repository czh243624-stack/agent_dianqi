import { useEffect, useState } from "react";
import {
  CHANNEL_LABEL,
  listAgents,
  updateAgent,
  type AgentConfig,
} from "./api";

const CHANNEL_OPTIONS = Object.keys(CHANNEL_LABEL);

type Props = {
  agentCode: string;
  title?: string;
  onClose: () => void;
  onError: (msg: string) => void;
};

export function SettingsPanel({ agentCode, title, onClose, onError }: Props) {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [draft, setDraft] = useState<Partial<AgentConfig> | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedHint, setSavedHint] = useState("");

  const load = async () => {
    const res = await listAgents();
    const current = res.items.find((item) => item.code === agentCode);
    if (!current) {
      throw new Error("未找到当前模块配置");
    }
    setAgent(current);
    setDraft({ ...current });
  };

  useEffect(() => {
    setSavedHint("");
    load().catch((e) => onError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentCode]);

  const toggleChannel = (channel: string) => {
    if (!draft) return;
    const current = draft.channels ?? [];
    setDraft({
      ...draft,
      channels: current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    });
  };

  const handleSave = async () => {
    if (!agent || !draft) return;
    setBusy(true);
    setSavedHint("");
    try {
      const updated = await updateAgent(agent.id, {
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        systemPrompt: draft.systemPrompt,
        modelProvider: draft.modelProvider,
        modelName: draft.modelName,
        temperature: Number(draft.temperature ?? 0.2),
        channels: draft.channels,
      });
      setAgent(updated);
      setDraft({ ...updated });
      setSavedHint("已保存");
    } catch (e) {
      onError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h1>{title || "模块设置"}</h1>
            <p>正在加载…</p>
          </div>
          <button className="ghost" onClick={onClose}>
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-head">
        <div>
          <h1>{title || "模块设置"}</h1>
          <p>只调整当前业务模块的工作方式，保存后长期保留。</p>
        </div>
        <button className="ghost" onClick={onClose}>
          返回
        </button>
      </div>

      {savedHint && <div className="save-banner">{savedHint}</div>}

      <div className="agent-editor">
        <div className="form-grid">
          <label>
            模块名称
            <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.enabled ?? true}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            启用此模块
          </label>
        </div>

        <label className="block-label">
          模块说明
          <textarea
            value={draft.description || ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
          />
        </label>

        <label className="block-label">
          工作说明
          <textarea
            value={draft.systemPrompt || ""}
            onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
            rows={10}
            placeholder="说明这个模块应如何整理询盘、回复客户、注意哪些事项…"
          />
        </label>

        <div className="block-label">
          接收渠道
          <div className="channel-checks">
            {CHANNEL_OPTIONS.map((channel) => (
              <label key={channel} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={(draft.channels || []).includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                {CHANNEL_LABEL[channel]}
              </label>
            ))}
          </div>
        </div>

        <div className="panel-actions">
          <div className="hint">修改后立即作用于本模块。</div>
          <button className="primary" disabled={busy || !draft.name} onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
