import { useEffect, useState } from "react";
import { updateWorkbenchProfile } from "../api";
import { readSession, saveSession } from "../auth";
import { UserAvatar } from "../components/UserAvatar";
import { readTheme, setTheme, subscribeTheme, type WorkbenchTheme } from "../theme";

function resizeAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 160;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("无法处理头像"));
        return;
      }
      const edge = Math.min(image.width, image.height);
      const sx = (image.width - edge) / 2;
      const sy = (image.height - edge) / 2;
      ctx.drawImage(image, sx, sy, edge, edge, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片无法读取"));
    };
    image.src = url;
  });
}

export function ProfilePage() {
  const current = readSession();
  const [displayName, setDisplayName] = useState(current?.displayName || "");
  const [title, setTitle] = useState(current?.title || "");
  const [avatarUrl, setAvatarUrl] = useState(current?.avatarUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState<WorkbenchTheme>(() => readTheme());

  useEffect(() => {
    const next = readSession();
    if (!next) return;
    setDisplayName(next.displayName);
    setTitle(next.title);
    setAvatarUrl(next.avatarUrl || "");
  }, []);

  useEffect(() => subscribeTheme(() => setThemeState(readTheme())), []);

  const chooseTheme = (next: WorkbenchTheme) => {
    setTheme(next);
    setThemeState(next);
  };

  const preview = {
    ...(current || {
      id: "",
      username: "sales",
      displayName,
      title,
      avatarText: displayName.slice(0, 1) || "业",
    }),
    displayName,
    title,
    avatarText: displayName.trim().slice(0, 1) || "业",
    avatarUrl: avatarUrl || null,
  };

  return (
    <div className="ry-card profile-card">
      <div className="ry-card-hd">
        <h2>个人中心</h2>
      </div>
      <div className="ry-card-bd">
        {error ? <div className="error-banner">{error}</div> : null}
        {hint ? <div className="ry-alert ry-alert-success">{hint}</div> : null}

        <div className="profile-layout">
          <div className="profile-avatar-block">
            <UserAvatar user={preview} className="ry-avatar profile-avatar" />
            <strong>{displayName || "业务员"}</strong>
            <span>{title || "外贸业务员"}</span>
            <label className="ry-btn ry-btn-plain">
              上传头像
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    setAvatarUrl(await resizeAvatar(file));
                    setHint("头像已选择，点击保存后生效。");
                    setError("");
                  } catch (e) {
                    setError(String((e as Error).message || e));
                  }
                }}
              />
            </label>
            {avatarUrl ? (
              <button
                className="ry-btn ry-btn-text"
                type="button"
                onClick={() => {
                  setAvatarUrl("");
                  setHint("已去掉头像，保存后恢复为姓名首字。");
                }}
              >
                移除头像
              </button>
            ) : null}
          </div>

          <div className="profile-main">
            <div className="theme-picker">
              <h3>外观</h3>
              <p>选择工作台配色，切换后立即生效。</p>
              <div className="theme-picker-grid">
                <button
                  type="button"
                  className={`theme-choice${theme === "light" ? " on" : ""}`}
                  onClick={() => chooseTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  <span className="theme-swatch light">
                    <b />
                    <i />
                  </span>
                  <strong>浅色</strong>
                </button>
                <button
                  type="button"
                  className={`theme-choice${theme === "dark" ? " on" : ""}`}
                  onClick={() => chooseTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <span className="theme-swatch dark">
                    <b />
                    <i />
                  </span>
                  <strong>深色</strong>
                </button>
              </div>
            </div>

          <form
            className="profile-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (newPassword && newPassword !== confirmPassword) {
                setError("两次输入的新密码不一致");
                return;
              }
              setBusy(true);
              setError("");
              setHint("");
              try {
                const { user } = await updateWorkbenchProfile({
                  displayName,
                  title,
                  avatarUrl: avatarUrl || null,
                  clearAvatar: !avatarUrl,
                  currentPassword: newPassword ? currentPassword : undefined,
                  newPassword: newPassword || undefined,
                });
                saveSession(user);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setHint("个人资料已保存。");
              } catch (e) {
                setError(String((e as Error).message || e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="ry-form-row">
              <label>登录账号</label>
              <input className="ry-input block" value={current?.username || ""} disabled />
            </div>
            <div className="ry-form-row">
              <label>显示名称</label>
              <input className="ry-input block" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={20} />
            </div>
            <div className="ry-form-row">
              <label>职务</label>
              <input className="ry-input block" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={30} placeholder="例如：外贸业务员" />
            </div>
            <div className="profile-password">
              <h3>修改密码</h3>
              <p>不改密码就留空。要改的话需要填写当前密码。</p>
              <div className="ry-form-row">
                <label>当前密码</label>
                <input className="ry-input block" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </div>
              <div className="ry-grid-2">
                <div className="ry-form-row">
                  <label>新密码</label>
                  <input className="ry-input block" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                </div>
                <div className="ry-form-row">
                  <label>确认新密码</label>
                  <input className="ry-input block" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                </div>
              </div>
            </div>
            <button className="ry-btn ry-btn-primary" type="submit" disabled={busy || !displayName.trim()}>
              {busy ? "保存中..." : "保存资料"}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
