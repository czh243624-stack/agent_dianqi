import { useEffect, useState } from "react";
import {
  formatTime,
  listApprovals,
  listAuditLogs,
  type ApprovalRecord,
  type AuditLog,
} from "../api";

export { KnowledgePage } from "./KnowledgePage";

export function LogsPage() {
  const [tab, setTab] = useState<"approvals" | "audit">("approvals");
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listApprovals(), listAuditLogs()])
      .then(([a, l]) => {
        setApprovals(a.items);
        setAudits(l.items);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <div className="ry-card">
      <div className="ry-card-hd">
        <h2>审核与操作日志</h2>
      </div>
      <div className="ry-card-bd">
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="ry-tabs">
          <button type="button" className={`ry-tab ${tab === "approvals" ? "on" : ""}`} onClick={() => setTab("approvals")}>
            审核记录
          </button>
          <button type="button" className={`ry-tab ${tab === "audit" ? "on" : ""}`} onClick={() => setTab("audit")}>
            操作日志
          </button>
        </div>

        {tab === "approvals" ? (
          <table className="ry-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>操作人</th>
                <th>对象</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>{formatTime(a.createdAt)}</td>
                  <td>{a.action}</td>
                  <td>{a.actor}</td>
                  <td>
                    {a.objectType} {a.inquiryId || a.objectId}
                  </td>
                  <td>{a.comment || "—"}</td>
                </tr>
              ))}
              {!approvals.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="ry-empty">暂无审核记录</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : (
          <table className="ry-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>操作人</th>
                <th>对象类型</th>
                <th>对象 ID</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td>{formatTime(a.createdAt)}</td>
                  <td>{a.action}</td>
                  <td>{a.actor}</td>
                  <td>{a.objectType}</td>
                  <td>{a.objectId || "—"}</td>
                </tr>
              ))}
              {!audits.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="ry-empty">暂无操作日志</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
