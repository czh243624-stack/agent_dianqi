import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginWorkbench } from "../api";
import { readSession, saveSession } from "../auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const existing = readSession();
  const [username, setUsername] = useState("sales");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (existing) return <Navigate to="/" replace />;

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="ry-logo-mark">YF</div>
          <div>
            <strong>易发式电气</strong>
            <span>外贸询盘工作台</span>
          </div>
        </div>
        <h1>登录后进入工作台</h1>
        <p>业务员账号登录后，可查看首页消息、处理询盘，并使用 AI 助手。</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);
            setError("");
            try {
              const { user } = await loginWorkbench(username, password);
              saveSession(user);
              navigate(from === "/login" ? "/" : from, { replace: true });
            } catch (e) {
              setError(String((e as Error).message || e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {error ? <div className="login-error">{error}</div> : null}
          <label>
            账号
            <input
              className="ry-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              className="ry-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="ry-btn ry-btn-primary login-submit" type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? "登录中..." : "进入工作台"}
          </button>
        </form>
        <div className="login-hint">演示账号 <code>sales</code> / 密码 <code>leeec2026</code></div>
      </div>
    </div>
  );
}
