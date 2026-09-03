import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  formatTime,
  getCustomer,
  listCustomers,
  type CustomerSummary,
  type Inquiry,
} from "../api";

export function CustomerListPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<CustomerSummary[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const grade = searchParams.get("grade") || "";

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    listCustomers()
      .then((res) => setItems(res.items))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const filtered = items.filter((c) => {
    const hay = `${c.company} ${c.country || ""} ${c.email || ""} ${c.productInterest || ""}`.toLowerCase();
    const matchQ = !q || hay.includes(q.toLowerCase());
    const matchGrade = !grade || c.leadGrade === grade;
    return matchQ && matchGrade;
  });

  return (
    <div className="ry-card">
      <div className="ry-card-hd">
          <h2>{grade ? `客户池 · ${grade} 级` : "客户池 / 客户档案"}</h2>
      </div>
      <div className="ry-card-bd">
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="ry-toolbar">
          <input
            className="ry-input grow"
            placeholder="搜索公司 / 国家 / 邮箱 / 产品兴趣"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ry-table-wrap">
          <table className="ry-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>国家</th>
                <th>来源</th>
                <th>客户等级</th>
                <th>产品兴趣</th>
                <th>应用场景</th>
                <th>最近意图</th>
                <th>跟进状态</th>
                <th>询盘数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.company}</td>
                  <td>{c.country || "—"}</td>
                  <td>{CHANNEL_LABEL[c.channel || ""] || c.channel || "—"}</td>
                  <td>
                    {c.leadGrade ? <span className={`ry-tag grade-${c.leadGrade}`}>{c.leadGrade}</span> : "—"}
                  </td>
                  <td>{c.productInterest || "—"}</td>
                  <td>{c.applicationScenario || "—"}</td>
                  <td>{c.lastIntent || "—"}</td>
                  <td>{c.followUpStatus || "—"}</td>
                  <td>{c._count?.inquiries ?? "—"}</td>
                  <td>
                    <Link className="ry-btn ry-btn-text" to={`/customers/${c.id}`}>
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={10}><div className="ry-empty">暂无客户档案</div></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [customer, setCustomer] = useState<(CustomerSummary & { inquiries?: Inquiry[]; touchpoints?: Array<{ id: string; summary: string; channel: string; direction: string; createdAt: string; nextAction?: string | null }> }) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCustomer(id)
      .then(setCustomer)
      .catch((e) => setError(String(e.message || e)));
  }, [id]);

  if (!customer && !error) return <div className="ry-card"><div className="ry-card-bd">加载中…</div></div>;
  if (!customer) {
    return (
      <div className="ry-card">
        <div className="ry-card-bd">
          <div className="error-banner">{error}</div>
          <button className="ry-btn ry-btn-plain" type="button" onClick={() => nav("/customers")}>返回</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ry-card">
        <div className="ry-card-hd">
          <h2>{customer.company}</h2>
          <button className="ry-btn ry-btn-plain" type="button" onClick={() => nav("/customers")}>返回客户池</button>
        </div>
        <div className="ry-card-bd">
          <dl className="ry-desc">
            <div className="ry-desc-item"><dt>国家</dt><dd>{customer.country || "—"}</dd></div>
            <div className="ry-desc-item"><dt>联系人</dt><dd>{customer.contactName || "—"}</dd></div>
            <div className="ry-desc-item"><dt>邮箱</dt><dd>{customer.email || "—"}</dd></div>
            <div className="ry-desc-item"><dt>来源渠道</dt><dd>{CHANNEL_LABEL[customer.channel || ""] || customer.channel || "—"}</dd></div>
            <div className="ry-desc-item">
              <dt>客户等级</dt>
              <dd>{customer.leadGrade ? <span className={`ry-tag grade-${customer.leadGrade}`}>{customer.leadGrade}</span> : "—"}</dd>
            </div>
            <div className="ry-desc-item"><dt>产品兴趣</dt><dd>{customer.productInterest || "—"}</dd></div>
            <div className="ry-desc-item"><dt>应用场景</dt><dd>{customer.applicationScenario || "—"}</dd></div>
            <div className="ry-desc-item"><dt>最近意图</dt><dd>{customer.lastIntent || "—"}</dd></div>
            <div className="ry-desc-item"><dt>跟进状态</dt><dd>{customer.followUpStatus || "—"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="ry-card">
        <div className="ry-card-hd"><h3>历史询盘</h3></div>
        <div className="ry-card-bd">
          <table className="ry-table">
            <thead>
              <tr>
                <th>创建时间</th>
                <th>来源</th>
                <th>状态</th>
                <th>等级</th>
                <th>类型</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(customer.inquiries || []).map((inq) => (
                <tr key={inq.id}>
                  <td>{formatTime(inq.createdAt)}</td>
                  <td>{CHANNEL_LABEL[inq.channel] || inq.channel}</td>
                  <td>{STATUS_LABEL[inq.status]}</td>
                  <td>{inq.leadGrade || "—"}</td>
                  <td>{inq.productType || "—"}</td>
                  <td><Link className="ry-btn ry-btn-text" to={`/inquiries/${inq.id}`}>查看</Link></td>
                </tr>
              ))}
              {!customer.inquiries?.length ? (
                <tr><td colSpan={6}><div className="ry-empty">暂无历史询盘</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ry-card">
        <div className="ry-card-hd"><h3>沟通记录</h3></div>
        <div className="ry-card-bd">
          <table className="ry-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>渠道</th>
                <th>方向</th>
                <th>摘要</th>
                <th>下一步</th>
              </tr>
            </thead>
            <tbody>
              {(customer.touchpoints || []).map((t) => (
                <tr key={t.id}>
                  <td>{formatTime(t.createdAt)}</td>
                  <td>{t.channel}</td>
                  <td>{t.direction}</td>
                  <td>{t.summary}</td>
                  <td>{t.nextAction || "—"}</td>
                </tr>
              ))}
              {!customer.touchpoints?.length ? (
                <tr><td colSpan={5}><div className="ry-empty">暂无沟通记录</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
