import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getWorkbenchProfile } from "../api";
import { clearSession, readSession, saveSession, subscribeSession, type WorkbenchUser } from "../auth";
import { UserAvatar } from "../components/UserAvatar";
import { NAV_ICONS } from "../icons";
import { readTheme, setTheme, subscribeTheme, type WorkbenchTheme } from "../theme";

const MENUS = [
  {
    group: "业务中心",
    items: [
      { to: "/", label: "首页", icon: "dashboard" as const },
      { to: "/inquiries", label: "询盘工作台", icon: "inquiries" as const },
      { to: "/ai-assistant", label: "AI 助手", icon: "assistant" as const },
      { to: "/customers", label: "客户池", icon: "customers" as const },
      { to: "/knowledge", label: "企业知识库", icon: "knowledge" as const },
    ],
  },
  {
    group: "系统",
    items: [
      { to: "/logs", label: "审核与日志", icon: "logs" as const },
    ],
  },
];

const TITLE_MAP: Record<string, string> = {
  "/": "首页",
  "/inquiries": "询盘工作台",
  "/ai-assistant": "AI 助手",
  "/customers": "客户池",
  "/knowledge": "企业知识库",
  "/logs": "审核与日志",
  "/ai-config": "AI 模型配置",
  "/profile": "个人中心",
};

export function AdminLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<WorkbenchUser | null>(() => readSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState<WorkbenchTheme>(() => readTheme());
  const menuRef = useRef<HTMLDivElement>(null);
  const base =
    Object.keys(TITLE_MAP)
      .sort((a, b) => b.length - a.length)
      .find((k) => (k === "/" ? loc.pathname === "/" : loc.pathname.startsWith(k))) || "/";
  const title = TITLE_MAP[base] || "工作台";
  const fillPage = base === "/ai-assistant" || base === "/";

  useEffect(() => subscribeSession(() => setUser(readSession())), []);
  useEffect(() => subscribeTheme(() => setThemeState(readTheme())), []);

  useEffect(() => {
    getWorkbenchProfile()
      .then((res) => saveSession(res.user))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  return (
    <div className="ry-layout">
      <aside className="ry-sidebar">
        <div className="ry-logo">
          <div className="ry-logo-mark">YF</div>
          <span>易发式电气工作台</span>
        </div>
        <nav className="ry-menu">
          {MENUS.map((block) => (
            <div key={block.group}>
              <div className="ry-menu-group">{block.group}</div>
              {block.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => (isActive ? "active" : undefined)}
                  >
                    <Icon />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="ry-sidebar-user-wrap" ref={menuRef}>
          {menuOpen ? (
            <div className="ry-user-popover">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  nav("/profile");
                }}
              >
                个人中心
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  nav("/login", { replace: true });
                }}
              >
                退出登录
              </button>
            </div>
          ) : null}
          <button className={`ry-sidebar-user${menuOpen ? " open" : ""}`} type="button" onClick={() => setMenuOpen((open) => !open)}>
            <UserAvatar user={user} />
            <div className="ry-sidebar-user-meta">
              <strong>{user?.displayName || "业务员"}</strong>
              <span>{user?.title || "外贸业务员"}</span>
            </div>
            <span className="ry-sidebar-user-caret">{menuOpen ? "▾" : "▴"}</span>
          </button>
        </div>
      </aside>

      <div className="ry-main">
        <header className="ry-header">
          <div className="ry-header-left">
            <div className="ry-crumb">
              外贸业务系统 / <strong>{title}</strong>
            </div>
          </div>
          <div className="ry-header-right">
            <div className="ry-theme-switch" role="group" aria-label="外观">
              <button type="button" className={theme === "light" ? "on" : undefined} onClick={() => setTheme("light")}>
                浅色
              </button>
              <button type="button" className={theme === "dark" ? "on" : undefined} onClick={() => setTheme("dark")}>
                深色
              </button>
            </div>
            <form
              className="ry-header-search"
              onSubmit={(event) => {
                event.preventDefault();
                const q = search.trim();
                if (q) nav(`/inquiries?q=${encodeURIComponent(q)}`);
              }}
            >
              <span>搜索</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="客户 / 询盘 / 型号" />
            </form>
          </div>
        </header>
        <main className={`ry-content${fillPage ? " fill" : ""}${base === "/" ? " ops-fill" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
