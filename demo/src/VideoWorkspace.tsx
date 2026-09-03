import { useMemo, useState } from "react";
import {
  approveVideoJob,
  confirmVideoScript,
  createVideoJob,
  scheduleVideoJob,
} from "./video/api";
import type { AspectRatio, Brief, Platform, ScriptOption, VideoJob } from "./video/types";
import "./VideoWorkspace.css";

type Tab = "scripts" | "storyboard" | "voice" | "render" | "review" | "publish";

const DEFAULT_BRIEF: Brief = {
  product: "33kV 500kVA 油浸式配电变压器",
  sellingPoints:
    "符合 IEC 60076 标准、ONAN 冷却、无励磁分接开关、出厂例行测试、出口木箱包装、常规生产周期 25-45 天",
  audience: "非洲和东南亚的 EPC 承包商、变电站采购经理、电力项目业主",
  platform: "TikTok",
  aspectRatio: "9:16",
  duration: 45,
  voice: "中文专业男声，沉稳技术风格",
  language: "Chinese",
};

const FLOW_STEPS = [
  { title: "整理任务", output: "整理产品、卖点、平台与时长" },
  { title: "检索资料", output: "匹配产品资料、认证与交期规则" },
  { title: "生成文案", output: "生成 5 条可选短视频文案" },
  { title: "确认文案", output: "选择一条文案，或手动填写" },
  { title: "生成旁白", output: "生成配音稿，并校正专业术语读音" },
  { title: "安排成片", output: "拆分画面、字幕与合成任务" },
  { title: "人工确认", output: "核对认证、交期与画面真实性" },
  { title: "待发布", output: "进入 TikTok / YouTube 待发布队列" },
];

const OWNER_LABEL: Record<string, string> = {
  RAG: "资料检索",
  TTS: "配音",
  ComfyUI: "画面补充",
  HyperFrames: "时间轴",
  FFmpeg: "成片合成",
};

function statusText(status?: VideoJob["status"]) {
  const map: Record<VideoJob["status"], string> = {
    idle: "待开始",
    drafting: "生成文案",
    script: "选择文案",
    building: "生成方案",
    review: "待确认",
    approved: "已通过",
    scheduled: "待发布",
    failed: "失败",
  };
  return status ? map[status] : "待开始";
}

function stepState(status: VideoJob["status"], index: number) {
  const progressByStatus: Record<VideoJob["status"], number> = {
    idle: 0,
    drafting: 1,
    script: 3,
    building: 5,
    review: 6,
    approved: 7,
    scheduled: 8,
    failed: 0,
  };
  const completed = progressByStatus[status];
  if (status === "failed") return "blocked";
  if (index < completed) return "done";
  if (index === completed) return "current";
  return "pending";
}

function stepEvidence(job: VideoJob, index: number) {
  const sources = job.plan?.sources.length || 0;
  const scenes = job.plan?.scenes.length || 0;
  const tasks = job.plan?.assetTasks.length || 0;
  const checks = job.plan?.checks.length || 0;
  const evidence = [
    `任务编号：${job.id.slice(0, 8)}`,
    `参考资料：${sources || "待确认"} 条`,
    `候选文案：${job.scriptOptions.length} 条`,
    job.selectedScript ? "文案已确认" : "等待选择文案",
    job.plan?.ssml ? "配音稿已生成" : "配音稿待生成",
    `成片任务：${tasks || "待生成"} 个，分镜：${scenes || "待生成"} 个`,
    `确认项：${checks || "待生成"} 项`,
    job.status === "scheduled" ? "已进入待发布队列" : "尚未加入发布队列",
  ];
  return evidence[index];
}

type Props = {
  onError?: (msg: string) => void;
};

export function VideoWorkspace({ onError }: Props) {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState("copy-1");
  const [manualScript, setManualScript] = useState("");
  const [approvedChecks, setApprovedChecks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("scripts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedScript = useMemo(() => {
    if (selectedScriptId === "manual") return manualScript.trim();
    return job?.scriptOptions.find((item) => item.id === selectedScriptId)?.script || "";
  }, [job?.scriptOptions, manualScript, selectedScriptId]);

  const progress = useMemo(() => {
    if (!job) return 0;
    if (job.status === "script") return 35;
    if (job.status === "review") return 78;
    if (job.status === "approved") return 90;
    if (job.status === "scheduled") return 100;
    return 10;
  }, [job]);

  const setErr = (msg: string) => {
    setError(msg);
    onError?.(msg);
  };

  const updateBrief = <K extends keyof Brief>(key: K, value: Brief[K]) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  const createJob = async () => {
    setBusy(true);
    setErr("");
    setApprovedChecks([]);
    try {
      const created = await createVideoJob(brief);
      setJob(created);
      setSelectedScriptId(created.scriptOptions[0]?.id || "manual");
      setManualScript("");
      setActiveTab("scripts");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "生成文案失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmScript = async () => {
    if (!job || !selectedScript.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await confirmVideoScript(job.id, {
        scriptId: selectedScriptId === "manual" ? undefined : selectedScriptId,
        manualScript: selectedScriptId === "manual" ? manualScript : undefined,
      });
      setJob(updated);
      setApprovedChecks([]);
      setActiveTab("storyboard");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "确认文案失败");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!job?.plan) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await approveVideoJob(job.id, approvedChecks);
      setJob(updated);
      setActiveTab("publish");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "确认失败");
    } finally {
      setBusy(false);
    }
  };

  const schedule = async () => {
    if (!job) return;
    setBusy(true);
    setErr("");
    try {
      const updated = await scheduleVideoJob(job.id);
      setJob(updated);
      setActiveTab("publish");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "加入发布队列失败");
    } finally {
      setBusy(false);
    }
  };

  const toggleCheck = (check: string) => {
    setApprovedChecks((current) =>
      current.includes(check) ? current.filter((item) => item !== check) : [...current, check],
    );
  };

  const sourceTypeLabel: Record<string, string> = {
    product: "产品资料",
    certification: "认证规则",
    lead_time: "交期规则",
    quote_rule: "报价规则",
    brand_rule: "品牌规范",
  };

  return (
    <div className="video-workspace">
      <div className="video-hero panel">
        <div>
          <h1>短视频制作</h1>
          <p>输入产品卖点，生成文案与分镜，确认后进入待发布队列。当前为模拟成片与发布。</p>
        </div>
        <div className={`video-progress status video-status-${job?.status || "idle"}`}>
          <span>{statusText(job?.status)}</span>
          <strong>{progress}%</strong>
          <div className="video-progress-bar" aria-hidden>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="video-layout">
        <section className="panel video-brief">
          <div className="panel-head compact">
            <div>
              <h2>任务信息</h2>
              <p>填写产品与卖点后，先生成可选文案。</p>
            </div>
          </div>

          <label className="block-label">
            产品 / 型号
            <input value={brief.product} onChange={(e) => updateBrief("product", e.target.value)} />
          </label>

          <label className="block-label">
            核心卖点
            <textarea
              rows={6}
              value={brief.sellingPoints}
              onChange={(e) => updateBrief("sellingPoints", e.target.value)}
            />
          </label>

          <label className="block-label">
            目标受众
            <input value={brief.audience} onChange={(e) => updateBrief("audience", e.target.value)} />
          </label>

          <div className="form-grid">
            <label>
              平台
              <select
                value={brief.platform}
                onChange={(e) => updateBrief("platform", e.target.value as Platform)}
              >
                <option>TikTok</option>
                <option>YouTube Shorts</option>
                <option>YouTube</option>
              </select>
            </label>
            <label>
              画幅
              <select
                value={brief.aspectRatio}
                onChange={(e) => updateBrief("aspectRatio", e.target.value as AspectRatio)}
              >
                <option>9:16</option>
                <option>16:9</option>
                <option>1:1</option>
              </select>
            </label>
            <label>
              时长（秒）
              <input
                type="number"
                min={15}
                max={90}
                value={brief.duration}
                onChange={(e) => updateBrief("duration", Number(e.target.value))}
              />
            </label>
          </div>

          <label className="block-label">
            配音风格
            <input value={brief.voice} onChange={(e) => updateBrief("voice", e.target.value)} />
          </label>

          <button className="primary full-btn" onClick={createJob} disabled={busy}>
            {busy ? "处理中…" : "创建任务并生成文案"}
          </button>
        </section>

        <section className="video-main">
          {error && <div className="error-banner">{error}</div>}

          {!job && (
            <div className="panel video-empty">
              <div className="video-empty-frame">
                <span>制作流程</span>
                <strong>整理卖点 → 生成文案 → 确认分镜 → 人工核对 → 待发布</strong>
              </div>
              <h2>从左侧创建任务开始</h2>
              <p>系统会先给出 5 条文案供选择，也可手写第 6 条，再继续生成分镜与发布草稿。</p>
            </div>
          )}

          {job && (
            <div className="video-result-stack">
              <section className="panel">
                <div className="panel-head compact">
                  <div>
                    <h2>处理进度</h2>
                    <p>清楚看到当前做到哪一步，以及每一步产出了什么。</p>
                  </div>
                </div>
                <div className="video-steps">
                  {FLOW_STEPS.map((step, index) => {
                    const state = stepState(job.status, index);
                    const label =
                      state === "done"
                        ? "已完成"
                        : state === "current"
                          ? "进行中"
                          : state === "blocked"
                            ? "异常"
                            : "待开始";
                    return (
                      <article key={step.title} className={`video-step ${state}`}>
                        <div className="video-step-top">
                          <span className="step-badge" aria-hidden>
                            {state === "done" ? (
                              <i className="step-light on" />
                            ) : (
                              <b>{index + 1}</b>
                            )}
                          </span>
                          <strong>{step.title}</strong>
                          <span className={`step-tag ${state}`}>{label}</span>
                        </div>
                        <p>{step.output}</p>
                        <small>{stepEvidence(job, index)}</small>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="tabs">
                {(
                  [
                    ["scripts", "脚本文案"],
                    ["storyboard", "分镜"],
                    ["voice", "配音稿"],
                    ["render", "成片任务"],
                    ["review", "人工确认"],
                    ["publish", "发布草稿"],
                  ] as Array<[Tab, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    className={activeTab === key ? "tab on" : "tab"}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "scripts" && (
                <section className="panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>选择文案</h2>
                      <p>可任选 1 条系统文案，或填写第 6 条手写文案。</p>
                    </div>
                  </div>
                  <div className="script-grid">
                    {job.scriptOptions.map((option: ScriptOption) => (
                      <label
                        key={option.id}
                        className={`script-card ${selectedScriptId === option.id ? "on" : ""}`}
                      >
                        <input
                          type="radio"
                          name="script"
                          checked={selectedScriptId === option.id}
                          onChange={() => setSelectedScriptId(option.id)}
                        />
                        <strong>{option.title}</strong>
                        <span>{option.angle}</span>
                        <p>{option.script}</p>
                      </label>
                    ))}
                    <label className={`script-card ${selectedScriptId === "manual" ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="script"
                        checked={selectedScriptId === "manual"}
                        onChange={() => setSelectedScriptId("manual")}
                      />
                      <strong>第 6 条：手写文案</strong>
                      <span>按你的表达继续生成分镜与发布草稿</span>
                      <textarea
                        rows={6}
                        value={manualScript}
                        placeholder="在这里填写视频脚本文案…"
                        onChange={(e) => {
                          setManualScript(e.target.value);
                          setSelectedScriptId("manual");
                        }}
                      />
                    </label>
                  </div>
                  <div className="panel-actions">
                    <div className="hint">确认后会继续生成分镜、配音稿与成片任务。</div>
                    <div className="action-group">
                      <button className="ghost" onClick={createJob} disabled={busy}>
                        重新生成
                      </button>
                      <button
                        className="primary"
                        onClick={confirmScript}
                        disabled={busy || !selectedScript.trim()}
                      >
                        确认文案并继续
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "storyboard" && job.plan && (
                <section className="panel scene-list">
                  {job.plan.scenes.map((scene) => (
                    <article key={scene.id} className="scene-card">
                      <div className="scene-meta">
                        <strong>{scene.id}</strong>
                        <span>{scene.time}</span>
                        <em>{OWNER_LABEL[scene.renderTool] || scene.renderTool}</em>
                      </div>
                      <h3>{scene.title}</h3>
                      <p>{scene.voiceover}</p>
                      <small>{scene.visual}</small>
                      <b>{scene.overlay}</b>
                    </article>
                  ))}
                </section>
              )}

              {activeTab === "voice" && job.plan && (
                <section className="panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>配音稿</h2>
                      <p>正式版会据此生成真实旁白音频。</p>
                    </div>
                  </div>
                  <pre className="raw-inquiry">{job.plan.ssml}</pre>
                </section>
              )}

              {activeTab === "render" && job.plan && (
                <section className="panel render-grid">
                  {job.plan.assetTasks.map((task) => (
                    <article key={task.id} className={`render-card ${task.status}`}>
                      <div className="render-top">
                        <strong>{OWNER_LABEL[task.owner] || task.owner}</strong>
                        <span>{task.id}</span>
                      </div>
                      <h3>{task.task}</h3>
                      <p>{task.note}</p>
                    </article>
                  ))}
                </section>
              )}

              {activeTab === "review" && job.plan && (
                <section className="panel">
                  <div className="panel-head compact">
                    <div>
                      <h2>人工确认</h2>
                      <p>全部勾选后，才能加入待发布队列。</p>
                    </div>
                  </div>
                  <div className="check-list">
                    {job.plan.checks.map((check) => (
                      <label key={check} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={approvedChecks.includes(check)}
                          onChange={() => toggleCheck(check)}
                        />
                        {check}
                      </label>
                    ))}
                  </div>
                  <div className="panel-actions">
                    <div className="hint">请核对认证、交期、画面真实性与客户信息。</div>
                    <div className="action-group">
                      <button
                        className="ghost"
                        onClick={approve}
                        disabled={busy || approvedChecks.length !== job.plan.checks.length}
                      >
                        确认通过
                      </button>
                      <button
                        className="primary"
                        onClick={schedule}
                        disabled={busy || job.status !== "approved"}
                      >
                        加入发布队列
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "publish" && job.plan && (
                <section className="panel publish-grid">
                  {Object.entries(job.plan.publishCopy).map(([platform, copy]) => (
                    <article key={platform} className="publish-card">
                      <strong>{platform}</strong>
                      <p>{copy}</p>
                      <small>{job.plan?.hashtags.join(" ")}</small>
                    </article>
                  ))}
                </section>
              )}
            </div>
          )}
        </section>

        <aside className="video-side">
          <section className="panel">
            <div className="panel-head compact">
              <div>
                <h2>制作步骤</h2>
                <p>每一步都可追溯，后续可接真实配音与成片。</p>
              </div>
            </div>
            <div className="side-chain">
              {FLOW_STEPS.map((step, index) => {
                const state = job ? stepState(job.status, index) : index === 0 ? "current" : "pending";
                return (
                  <article key={step.title} className={state}>
                    <div className="side-chain-top">
                      <span className="step-badge" aria-hidden>
                        {state === "done" ? (
                          <i className="step-light on" />
                        ) : (
                          <b>{index + 1}</b>
                        )}
                      </span>
                      <strong>{step.title}</strong>
                      {state === "done" && <span className="step-tag done">完成</span>}
                      {state === "current" && <span className="step-tag current">进行中</span>}
                    </div>
                    <p>{step.output}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {job?.plan?.sources && (
            <section className="panel">
              <div className="panel-head compact">
                <div>
                  <h2>参考资料</h2>
                  <p>文案与承诺应能对应到这些资料。</p>
                </div>
              </div>
              <div className="source-list">
                {job.plan.sources.map((source) => (
                  <article key={source.id} className="source-card">
                    <strong>{source.title}</strong>
                    <span>{sourceTypeLabel[source.type] || source.type}</span>
                    <p>{source.snippet}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {job && (
            <section className="panel">
              <div className="panel-head compact">
                <div>
                  <h2>操作记录</h2>
                  <p>记录谁在何时确认了哪些内容。</p>
                </div>
              </div>
              <div className="audit-list">
                {job.auditLog.map((log) => (
                  <article key={`${log.at}-${log.action}`}>
                    <strong>{log.action}</strong>
                    <span>
                      {log.actor === "operator" ? "业务员" : "系统"} ·{" "}
                      {new Date(log.at).toLocaleString()}
                    </span>
                    {log.detail && <p>{log.detail}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
