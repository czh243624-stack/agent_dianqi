import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  createInquiry,
  formatTime,
  listInquiries,
  syncAlibaba,
  type Inquiry,
} from "../api";
import { Dialog } from "../components/Dialog";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "new", label: "未分析" },
  { value: "analyzing", label: "分析中" },
  { value: "pending_review", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已退回" },
  { value: "sent", label: "已发送" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "全部来源" },
  { value: "manual", label: "手动粘贴" },
  { value: "website_form", label: "独立站" },
  { value: "alibaba", label: "阿里国际站" },
];

const GRADE_OPTIONS = [
  { value: "", label: "全部等级" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

function statusTag(status: string) {
  const map: Record<string, string> = {
    new: "ry-tag-info",
    analyzing: "ry-tag-warning",
    pending_review: "ry-tag-primary",
    approved: "ry-tag-success",
    rejected: "ry-tag-danger",
    sent: "ry-tag-success",
  };
  return map[status] || "ry-tag-info";
}

export function InquiryListPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [channel, setChannel] = useState(() => searchParams.get("channel") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [leadGrade, setLeadGrade] = useState(() => searchParams.get("leadGrade") || "");
  const [qInput, setQInput] = useState(() => searchParams.get("q") || "");
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState("createdAt_desc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerCountry, setBuyerCountry] = useState("");
  const pageSize = 10;

  useEffect(() => {
    setQInput(searchParams.get("q") || "");
    setQ(searchParams.get("q") || "");
    setStatus(searchParams.get("status") || "");
    setChannel(searchParams.get("channel") || "");
    setLeadGrade(searchParams.get("leadGrade") || "");
  }, [searchParams]);

  const load = async (p = page) => {
    setBusy(true);
    setError("");
    try {
      const data = await listInquiries({
        page: p,
        pageSize,
        channel: channel || undefined,
        status: status || undefined,
        leadGrade: leadGrade || undefined,
        q: q || undefined,
        sort,
      });
      setItems(data.items);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const data = await listInquiries({
          page: 1,
          pageSize,
          channel: channel || undefined,
          status: status || undefined,
          leadGrade: leadGrade || undefined,
          q: q || undefined,
          sort,
        });
        if (cancelled) return;
        setItems(data.items);
        setPage(data.page);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message || e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, status, leadGrade, q, sort]);

  const handleCreate = async () => {
    if (!rawText.trim()) return;
    setBusy(true);
    try {
      const created = await createInquiry({
        rawText: rawText.trim(),
        channel: "manual",
        buyerCompany: buyerCompany || undefined,
        buyerName: buyerName || undefined,
        buyerEmail: buyerEmail || undefined,
        buyerCountry: buyerCountry || undefined,
      });
      setCreateOpen(false);
      setRawText("");
      setBuyerCompany("");
      setBuyerName("");
      setBuyerEmail("");
      setBuyerCountry("");
      nav(`/inquiries/${created.id}`);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncAlibaba = async () => {
    if (!window.confirm("确认从阿里国际站同步通知询盘？")) return;
    setBusy(true);
    try {
      const res = await syncAlibaba();
      await load(1);
      if (!res.count) setError(res.note || "暂无新的阿里通知");
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ry-card">
        <div className="ry-card-hd">
          <h2>询盘工作台</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ry-btn ry-btn-plain" type="button" disabled={busy} onClick={handleSyncAlibaba}>
              同步阿里通知
            </button>
            <button className="ry-btn ry-btn-primary" type="button" onClick={() => setCreateOpen(true)}>
              手动新增询盘
            </button>
          </div>
        </div>
        <div className="ry-card-bd">
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="ry-toolbar">
            <select className="ry-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="ry-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all-status"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="ry-select" value={leadGrade} onChange={(e) => setLeadGrade(e.target.value)}>
              {GRADE_OPTIONS.map((o) => (
                <option key={o.value || "all-grade"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="ry-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="createdAt_desc">最新创建</option>
              <option value="createdAt_asc">最早创建</option>
              <option value="updatedAt_desc">最近更新</option>
            </select>
            <input
              className="ry-input grow"
              value={qInput}
              placeholder="搜索公司 / 联系人 / 邮箱 / 内容"
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQ(qInput.trim());
              }}
            />
            <button className="ry-btn ry-btn-primary" type="button" onClick={() => setQ(qInput.trim())}>
              搜索
            </button>
            <button
              className="ry-btn ry-btn-plain"
              type="button"
              onClick={() => {
                setQInput("");
                setQ("");
                setChannel("");
                setStatus("");
                setLeadGrade("");
                setSort("createdAt_desc");
                nav("/inquiries");
              }}
            >
              重置
            </button>
          </div>

          <div className="ry-table-wrap">
            <table className="ry-table">
              <thead>
                <tr>
                  <th>公司</th>
                  <th>联系人</th>
                  <th>国家</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>客户等级</th>
                  <th>变压器类型</th>
                  <th>应用场景</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.buyerCompany || "—"}</td>
                    <td>{item.buyerName || "—"}</td>
                    <td>{item.buyerCountry || "—"}</td>
                    <td>{CHANNEL_LABEL[item.channel] || item.channel}</td>
                    <td>
                      <span className={`ry-tag ${statusTag(item.status)}`}>
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.leadGrade ? (
                        <span className={`ry-tag grade-${item.leadGrade}`}>{item.leadGrade}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{item.productType || "—"}</td>
                    <td>{item.applicationScenario || "—"}</td>
                    <td>{formatTime(item.createdAt)}</td>
                    <td>
                      <Link className="ry-btn ry-btn-text" to={`/inquiries/${item.id}`}>
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
                {!items.length && !busy ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="ry-empty">暂无询盘，可点击右上角「手动新增询盘」</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="ry-pager">
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <button
              className="ry-page-btn"
              type="button"
              disabled={page <= 1 || busy}
              onClick={() => load(page - 1)}
            >
              ‹
            </button>
            <button className="ry-page-btn on" type="button">
              {page}
            </button>
            <button
              className="ry-page-btn"
              type="button"
              disabled={page >= totalPages || busy}
              onClick={() => load(page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={createOpen}
        title="手动新增询盘"
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreate}
        confirmText="保存并进入详情"
        busy={busy}
      >
        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>公司</label>
            <input className="ry-input block" value={buyerCompany} onChange={(e) => setBuyerCompany(e.target.value)} />
          </div>
          <div className="ry-form-row">
            <label>联系人</label>
            <input className="ry-input block" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          </div>
          <div className="ry-form-row">
            <label>邮箱</label>
            <input className="ry-input block" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
          </div>
          <div className="ry-form-row">
            <label>国家</label>
            <input className="ry-input block" value={buyerCountry} onChange={(e) => setBuyerCountry(e.target.value)} />
          </div>
        </div>
        <div className="ry-form-row">
          <label>原始英文询盘 *</label>
          <textarea
            className="ry-textarea"
            rows={10}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="粘贴买家英文询盘原文…"
          />
        </div>
      </Dialog>
    </>
  );
}
