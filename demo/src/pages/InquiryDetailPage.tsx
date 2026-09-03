import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CHANNEL_LABEL,
  SOURCE_TYPE_LABEL,
  STATUS_LABEL,
  analyzeInquiry,
  approveInquiry,
  formatTime,
  getInquiry,
  rejectInquiry,
  sendInquiry,
  updateInquiry,
  type Inquiry,
  type ParameterItem,
} from "../api";
import { Dialog } from "../components/Dialog";

const TABS = [
  { id: "raw", label: "买家原始询盘" },
  { id: "ai", label: "AI 智能分析" },
  { id: "params", label: "技术参数" },
  { id: "missing", label: "缺失参数追问" },
  { id: "sources", label: "知识库参考资料" },
  { id: "draft", label: "英文回复草稿" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ConfirmKind = "analyze" | "approve" | "reject" | "send" | null;

function normalizeParams(inquiry: Inquiry): ParameterItem[] {
  if (Array.isArray(inquiry.parameterChecklist) && inquiry.parameterChecklist.length) {
    return inquiry.parameterChecklist;
  }
  if (Array.isArray(inquiry.extracted)) return inquiry.extracted;
  return [];
}

function confidenceText(value?: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function sourceText(value?: string) {
  const map: Record<string, string> = {
    buyer_text: "买家原文",
    semantic_inference: "语义推断",
    knowledge_base: "知识库",
    not_provided: "未提供",
  };
  return value ? map[value] || value : "—";
}

function interpretationText(value?: string) {
  const map: Record<string, string> = {
    explicit: "明确提供",
    inferred: "推断结果",
    mentioned_not_requirement: "仅被提及",
    missing: "缺失",
  };
  return value ? map[value] || value : "—";
}

function priorityText(value?: string) {
  const map: Record<string, string> = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  };
  return value ? map[value] || value : "中优先级";
}

export function InquiryDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [tab, setTab] = useState<TabId>("raw");
  const [draft, setDraft] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await getInquiry(id);
      setInquiry(data);
      setDraft(data.draftReply || "");
      setQuestionsText((data.missingQuestions || []).join("\n"));
      if (data.status !== "new" && data.status !== "analyzing") setTab("ai");
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (id) load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const params = useMemo(() => (inquiry ? normalizeParams(inquiry) : []), [inquiry]);
  const missingCount = params.filter((p) => p.missing || !p.value || p.value === "未提供" || p.value === "Not provided").length;
  const requiredMissing = params.filter((p) => (p.requiredForQuote ?? p.requiredForQuotation) && (p.missing || !p.value || p.value === "未提供" || p.value === "Not provided"));

  const runConfirm = async () => {
    if (!inquiry || !confirm) return;
    setBusy(true);
    setError("");
    setHint("");
    try {
      if (confirm === "analyze") {
        const data = await analyzeInquiry(inquiry.id);
        setInquiry(data);
        setDraft(data.draftReply || "");
        setQuestionsText((data.missingQuestions || []).join("\n"));
        setTab("ai");
        setHint("AI 智能分析已完成，请核对参数与草稿。");
      } else if (confirm === "approve") {
        await updateInquiry(inquiry.id, { draftReply: draft });
        const data = await approveInquiry(inquiry.id, "业务员审核通过");
        setInquiry(data);
        setHint("已审核通过，可确认发送。");
      } else if (confirm === "reject") {
        const data = await rejectInquiry(inquiry.id, "退回修改");
        setInquiry(data);
        setHint("已退回，可重新分析或修改后再次提交。");
      } else if (confirm === "send") {
        const res = await sendInquiry(inquiry.id);
        setInquiry(res.inquiry);
        setHint("已模拟发送。当前不会真实外发至客户邮箱。");
        setTab("draft");
      }
      setConfirm(null);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!inquiry) return;
    setBusy(true);
    setError("");
    try {
      const data = await updateInquiry(inquiry.id, { draftReply: draft });
      setInquiry(data);
      setHint("草稿已保存。");
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const saveQuestions = async () => {
    if (!inquiry) return;
    const list = questionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      const data = await updateInquiry(inquiry.id, { missingQuestions: list });
      setInquiry(data);
      setHint("追问内容已保存。");
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const copyQuestions = async () => {
    await navigator.clipboard.writeText(questionsText);
    setHint("追问内容已复制到剪贴板。");
  };

  if (!inquiry && !error) {
    return <div className="ry-card"><div className="ry-card-bd">加载中…</div></div>;
  }
  if (!inquiry) {
    return (
      <div className="ry-card">
        <div className="ry-card-bd">
          <div className="error-banner">{error}</div>
          <button className="ry-btn ry-btn-plain" type="button" onClick={() => nav("/inquiries")}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const confirmCopy: Record<Exclude<ConfirmKind, null>, { title: string; body: string; type: "primary" | "success" | "warning" | "danger"; ok: string }> = {
    analyze: {
      title: "开始 AI 智能分析",
      body: "系统将分析变压器类型、应用场景、买家意图、技术参数，并生成追问、客户评级与英文草稿。是否继续？",
      type: "primary",
      ok: "开始分析",
    },
    approve: {
      title: "审核通过",
      body: "确认当前英文草稿无自动承诺风险，审核通过后可进入发送步骤。",
      type: "success",
      ok: "确认通过",
    },
    reject: {
      title: "退回修改",
      body: "将该询盘退回修改状态，业务员可继续调整后再分析/审核。",
      type: "warning",
      ok: "确认退回",
    },
    send: {
      title: "确认发送",
      body: "当前为模拟发送，不会真实发到客户邮箱。价格、交期、认证承诺必须由人工确认，系统不会自动对外承诺。是否继续？",
      type: "danger",
      ok: "确认发送",
    },
  };

  return (
    <>
      <div className="ry-card">
        <div className="ry-card-hd">
          <div>
            <h2>
              {inquiry.buyerCompany || inquiry.buyerName || "询盘详情"}
              {inquiry.leadGrade ? (
                <span className={`ry-tag grade-${inquiry.leadGrade}`} style={{ marginLeft: 8 }}>
                  {inquiry.leadGrade} 级
                </span>
              ) : null}
            </h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {CHANNEL_LABEL[inquiry.channel] || inquiry.channel} · {STATUS_LABEL[inquiry.status]} · 创建于{" "}
              {formatTime(inquiry.createdAt)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ry-btn ry-btn-plain" type="button" onClick={() => nav("/inquiries")}>
              返回列表
            </button>
            {inquiry.customerId ? (
              <Link className="ry-btn ry-btn-plain" to={`/customers/${inquiry.customerId}`}>
                客户档案
              </Link>
            ) : null}
            <button
              className="ry-btn ry-btn-primary"
              type="button"
              disabled={busy}
              onClick={() => setConfirm("analyze")}
            >
              AI 智能分析
            </button>
          </div>
        </div>
        <div className="ry-card-bd">
          {error ? <div className="error-banner">{error}</div> : null}
          {hint ? <div className="ry-alert ry-alert-success">{hint}</div> : null}

          <div className="ry-stat-row">
            <div className="ry-stat">
              <div className="label">买家意图</div>
              <div className="value" style={{ fontSize: 16 }}>{inquiry.businessIntent || "—"}</div>
            </div>
            <div className="ry-stat">
              <div className="label">变压器类型</div>
              <div className="value" style={{ fontSize: 16 }}>{inquiry.productType || "—"}</div>
            </div>
            <div className="ry-stat">
              <div className="label">应用场景</div>
              <div className="value" style={{ fontSize: 16 }}>{inquiry.applicationScenario || "—"}</div>
            </div>
            <div className="ry-stat">
              <div className="label">客户评分</div>
              <div className="value">
                {inquiry.leadGrade || "—"}
                {inquiry.leadScore != null ? ` / ${inquiry.leadScore}` : ""}
              </div>
            </div>
          </div>

          <div className="ry-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ry-tab ${tab === t.id ? "on" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === "params" && missingCount ? ` (${missingCount})` : ""}
              </button>
            ))}
          </div>

          {tab === "raw" && (
            <>
              <dl className="ry-desc">
                <div className="ry-desc-item"><dt>客户公司</dt><dd>{inquiry.buyerCompany || "—"}</dd></div>
                <div className="ry-desc-item"><dt>联系人</dt><dd>{inquiry.buyerName || "—"}</dd></div>
                <div className="ry-desc-item"><dt>邮箱</dt><dd>{inquiry.buyerEmail || "—"}</dd></div>
                <div className="ry-desc-item"><dt>国家</dt><dd>{inquiry.buyerCountry || "—"}</dd></div>
                <div className="ry-desc-item"><dt>来源渠道</dt><dd>{CHANNEL_LABEL[inquiry.channel] || inquiry.channel}</dd></div>
              </dl>
              <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>原始英文询盘</h3>
              <div className="ry-raw">{inquiry.rawText}</div>
            </>
          )}

          {tab === "ai" && (
            <>
              <dl className="ry-desc">
                <div className="ry-desc-item"><dt>买家意图</dt><dd>{inquiry.businessIntent || "尚未分析"}</dd></div>
                <div className="ry-desc-item"><dt>变压器类型</dt><dd>{inquiry.productType || "尚未分析"}{inquiry.productTypeNeedsConfirmation ? " · 需确认" : ""}</dd></div>
                <div className="ry-desc-item"><dt>应用场景</dt><dd>{inquiry.applicationScenario || "尚未分析"}</dd></div>
                <div className="ry-desc-item"><dt>语义摘要</dt><dd>{inquiry.semanticSummary || "完成 AI 分析后生成"}</dd></div>
                <div className="ry-desc-item"><dt>判断置信度</dt><dd>意图 {confidenceText(inquiry.intentConfidence)} · 类型 {confidenceText(inquiry.productTypeConfidence)} · 场景 {confidenceText(inquiry.scenarioConfidence)}</dd></div>
                <div className="ry-desc-item">
                  <dt>客户等级</dt>
                  <dd>
                    {inquiry.leadGrade ? <span className={`ry-tag grade-${inquiry.leadGrade}`}>{inquiry.leadGrade}</span> : "—"}
                    {inquiry.leadScore != null ? ` · 评分 ${inquiry.leadScore}` : ""}
                  </dd>
                </div>
                <div className="ry-desc-item"><dt>推荐型号</dt><dd>{inquiry.recommendedModel || "—"}</dd></div>
                <div className="ry-desc-item">
                  <dt>报价提示</dt>
                  <dd>
                    {inquiry.quoteHint || "—"}
                    <span className="internal-note">内部参考，需人工确认</span>
                  </dd>
                </div>
              </dl>
              <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>评级原因</h3>
              {inquiry.leadReasons?.length ? (
                <ul className="list-plain">
                  {inquiry.leadReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">暂无</div>
              )}
              <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>销售跟进建议</h3>
              <div className="ry-alert ry-alert-info">{inquiry.followUpAdvice || "完成 AI 分析后生成"}</div>
              <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>AI 分析工作流</h3>
              {inquiry.analysisSkills?.length ? (
                <div className="skill-grid">
                  {inquiry.analysisSkills.map((skill) => (
                    <div className="skill-card" key={skill.code}>
                      <div className="skill-card-head">
                        <div>
                          <strong>{skill.name}</strong>
                          <em className={`skill-priority priority-${skill.priority || "medium"}`}>{priorityText(skill.priority)}</em>
                        </div>
                        <span>置信度 {confidenceText(skill.confidence)}</span>
                      </div>
                      <div className="skill-label">判断结论</div>
                      <p>{skill.result}</p>
                      {skill.nextAction ? (
                        <>
                          <div className="skill-label">下一步动作</div>
                          <p>{skill.nextAction}</p>
                        </>
                      ) : null}
                      {skill.warnings?.length ? (
                        <div className="skill-warning">
                          {skill.warnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      ) : null}
                      {skill.evidence.length ? <small>依据：{skill.evidence.slice(0, 2).join("；")}</small> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">暂无 AI 分析工作流结果，请先执行 AI 智能分析。</div>
              )}
            </>
          )}

          {tab === "params" && (
            <>
              <div className="ry-alert ry-alert-warning">
                红色为缺失参数。标注「报价前必填」的项，正式报价前必须由业务员确认补齐。
                {requiredMissing.length ? ` 当前报价前必填缺失 ${requiredMissing.length} 项。` : ""}
              </div>
              <div className="ry-table-wrap">
                <table className="ry-table">
                  <thead>
                    <tr>
                      <th>参数</th>
                      <th>识别结果</th>
                      <th>状态</th>
                      <th>来源</th>
                      <th>置信度</th>
                      <th>判断依据</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map((p) => {
                      const missing = p.missing || !p.value || p.value === "未提供" || p.value === "Not provided";
                      return (
                        <tr key={p.key}>
                          <td>{p.label || p.key}</td>
                          <td className={missing ? "param-missing" : "param-ok"}>{p.value || "未提供"}</td>
                          <td>
                            {missing ? (
                              <span className="ry-tag ry-tag-danger">缺失</span>
                            ) : (
                              <span className="ry-tag ry-tag-success">已识别</span>
                            )}
                          </td>
                          <td>{sourceText(p.source)} · {interpretationText(p.interpretation)}</td>
                          <td>{confidenceText(p.confidence)}</td>
                          <td>{p.evidence || "—"}</td>
                          <td>
                            {(p.requiredForQuote ?? p.requiredForQuotation) ? <span className="ry-tag ry-tag-warning">报价前必填</span> : "—"}
                            {p.needsConfirmation && !missing ? <span className="internal-note">需业务员确认</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                    {!params.length ? (
                      <tr>
                        <td colSpan={7}><div className="ry-empty">请先执行 AI 智能分析</div></td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "missing" && (
            <>
              <div className="ry-alert ry-alert-info">以下英文追问可复制发给买家，也可由业务员编辑后保存。</div>
              <textarea className="ry-textarea" rows={12} value={questionsText} onChange={(e) => setQuestionsText(e.target.value)} />
              <div className="ry-actions">
                <button className="ry-btn ry-btn-plain" type="button" onClick={copyQuestions}>复制</button>
                <button className="ry-btn ry-btn-primary" type="button" disabled={busy} onClick={saveQuestions}>保存追问</button>
              </div>
            </>
          )}

          {tab === "sources" && (
            <>
              <div className="ry-alert ry-alert-warning">
                参考资料仅供起草使用。历史报价、交期与认证范围均为<strong>内部参考，需人工确认</strong>，不会自动写入对外承诺。
              </div>
              <div className="ry-table-wrap">
                <table className="ry-table">
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>标题</th>
                      <th>摘要</th>
                      <th>版本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inquiry.sources || []).map((s) => (
                      <tr key={`${s.type}-${s.id}-${s.title}`}>
                        <td>{SOURCE_TYPE_LABEL[s.type] || s.type}</td>
                        <td>
                          {s.title}
                          {s.type === "quote_history" || s.type === "lead_time" || s.type === "certification" ? (
                            <span className="internal-note">内部参考，需人工确认</span>
                          ) : null}
                        </td>
                        <td>{s.snippet}</td>
                        <td>{s.version || "—"}</td>
                      </tr>
                    ))}
                    {!inquiry.sources?.length ? (
                      <tr>
                        <td colSpan={4}><div className="ry-empty">暂无参考资料，请先分析</div></td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "draft" && (
            <>
              <div className="ry-alert ry-alert-danger">
                发送前必须人工确认：不得自动对外承诺具体价格、交期与认证；当前发送为模拟发送。
              </div>
              <textarea className="ry-textarea" rows={16} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="ry-actions">
                <button className="ry-btn ry-btn-plain" type="button" disabled={busy} onClick={saveDraft}>
                  保存草稿
                </button>
                <button
                  className="ry-btn ry-btn-success"
                  type="button"
                  disabled={busy || inquiry.status === "sent"}
                  onClick={() => setConfirm("approve")}
                >
                  审核通过
                </button>
                <button
                  className="ry-btn ry-btn-warning"
                  type="button"
                  disabled={busy || inquiry.status === "sent"}
                  onClick={() => setConfirm("reject")}
                >
                  退回修改
                </button>
                <button
                  className="ry-btn ry-btn-danger"
                  type="button"
                  disabled={busy || (inquiry.status !== "approved" && inquiry.status !== "sent")}
                  onClick={() => setConfirm("send")}
                >
                  确认发送
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={!!confirm}
        title={confirm ? confirmCopy[confirm].title : ""}
        size="sm"
        confirmType={confirm ? confirmCopy[confirm].type : "primary"}
        confirmText={confirm ? confirmCopy[confirm].ok : "确定"}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>{confirm ? confirmCopy[confirm].body : ""}</p>
      </Dialog>
    </>
  );
}
