import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  chatAssistantSession,
  createAssistantSession,
  deleteAssistantSession,
  getAssistantSession,
  listAssistantSessions,
  renameAssistantSession,
  type AiAssistantMessage,
  type AssistantSessionSummary,
} from "../api";
import { readLanguagePreference, saveLanguagePreference, type UiLanguage } from "../languagePreference";
import { toPlainReply } from "../plainReply";

type Language = UiLanguage;
type SessionMenu = { id: string; x: number; y: number } | null;

const LAST_SESSION_KEY = "leeec.assistant.sessionId";

const COPY = {
  zh: {
    title: "AI 助手",
    subtitle: "业务数据问答 · 询盘 / 客户 / 知识库",
    language: "语言",
    me: "我",
    loadingAnswer: "正在读取真实业务数据并调用模型...",
    missingAi: "AI 模型未配置。请先配置可用 API Key，然后再问业务问题。",
    failedPrefix: "这次没有拿到 AI 回答：",
    placeholder: "例如：最近一个月业绩怎么样？",
    send: "发送",
    newChat: "新会话",
    rename: "重命名",
    remove: "删除",
    confirmDelete: "确定删除这个会话？聊天记录会一并删除。",
    sessions: "会话",
    emptySession: "还没有会话",
    quickQuestions: [
      "最近30天收到了多少询盘？",
      "现在还有多少询盘没有回复？",
      "A级客户有哪些？应该先跟进谁？",
      "哪些变压器类型咨询最多？",
    ],
  },
  en: {
    title: "AI Assistant",
    subtitle: "Business Q&A · Inquiries / Customers / Knowledge Base",
    language: "Language",
    me: "Me",
    loadingAnswer: "Reading live business data and calling the AI model...",
    missingAi: "AI model is not configured. Please configure a valid API Key before asking business questions.",
    failedPrefix: "No AI answer was returned this time: ",
    placeholder: "Example: How was performance in the last month?",
    send: "Send",
    newChat: "New chat",
    rename: "Rename",
    remove: "Delete",
    confirmDelete: "Delete this session and its messages?",
    sessions: "Sessions",
    emptySession: "No sessions yet",
    quickQuestions: [
      "How many inquiries were received in the last 30 days?",
      "How many inquiries are still waiting for reply?",
      "Which A-grade leads should sales follow up first?",
      "Which transformer types are requested most?",
    ],
  },
} as const;

function toMessages(session?: AssistantSessionSummary | null): AiAssistantMessage[] {
  return (session?.messages ?? []).map((item) => ({ role: item.role, content: item.content }));
}

export function AiAssistantPage() {
  const [language, setLanguage] = useState<Language>(() => readLanguagePreference());
  const [sessions, setSessions] = useState<AssistantSessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiAssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [sessionMenu, setSessionMenu] = useState<SessionMenu>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const text = useMemo(() => COPY[language], [language]);

  const persistActive = (id: string) => {
    localStorage.setItem(LAST_SESSION_KEY, id);
    setActiveId(id);
  };

  const openSession = async (id: string) => {
    const session = await getAssistantSession(id);
    persistActive(session.id);
    setMessages(toMessages(session));
    setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, ...session } : item)));
  };

  const bootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      let items = (await listAssistantSessions()).items;
      if (!items.length) {
        const created = await createAssistantSession(language);
        items = [created];
      }
      setSessions(items);
      const preferred = localStorage.getItem(LAST_SESSION_KEY);
      const next = items.find((item) => item.id === preferred) || items[0];
      await openSession(next.id);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending, activeId]);

  useEffect(() => {
    const close = () => setSessionMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("contextmenu", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const openSessionMenu = (event: ReactMouseEvent, session: AssistantSessionSummary) => {
    event.preventDefault();
    event.stopPropagation();
    setSessionMenu({
      id: session.id,
      x: Math.min(event.clientX, window.innerWidth - 148),
      y: Math.min(event.clientY, window.innerHeight - 98),
    });
  };

  const startRename = (session: AssistantSessionSummary) => {
    setSessionMenu(null);
    setEditingId(session.id);
    setDraftTitle(session.title);
  };

  const commitRename = async (id: string) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (!title) return;
    try {
      const updated = await renameAssistantSession(id, title);
      setSessions((current) => current.map((item) => (item.id === id ? { ...item, title: updated.title } : item)));
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  };

  const handleCreate = async () => {
    try {
      const created = await createAssistantSession(language);
      setSessions((current) => [created, ...current]);
      persistActive(created.id);
      setMessages(toMessages(created));
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  };

  const handleDelete = async (id: string) => {
    setSessionMenu(null);
    if (!window.confirm(text.confirmDelete)) return;
    try {
      await deleteAssistantSession(id);
      const remaining = sessions.filter((item) => item.id !== id);
      setSessions(remaining);
      if (activeId === id) {
        if (remaining[0]) await openSession(remaining[0].id);
        else {
          const created = await createAssistantSession(language);
          setSessions([created]);
          persistActive(created.id);
          setMessages(toMessages(created));
        }
      }
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  };

  const sendQuestion = async (value?: string) => {
    const nextQuestion = (value ?? question).trim();
    if (!nextQuestion || sending || !activeId) return;

    setMessages((current) => [...current, { role: "user", content: nextQuestion }]);
    setQuestion("");
    setSending(true);
    setError("");

    try {
      const result = await chatAssistantSession(activeId, { question: nextQuestion, language });
      setMessages(toMessages(result.session));
      setSessions((current) => {
        const rest = current.filter((item) => item.id !== result.session.id);
        return [{ ...result.session }, ...rest];
      });
    } catch (e) {
      const msg = String((e as Error).message || e);
      setError(msg);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            msg.includes("AI 模型未配置") || msg.includes("AI_CONFIG_REQUIRED")
              ? COPY[language].missingAi
              : `${COPY[language].failedPrefix}${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="assistant-page">
      <aside className="assistant-sessions">
        <div className="assistant-sessions-hd">
          <strong>{text.sessions}</strong>
          <button className="ry-btn ry-btn-primary" type="button" onClick={() => handleCreate().catch(() => undefined)}>
            {text.newChat}
          </button>
        </div>
        <div className="assistant-session-list">
          {sessions.map((session) => (
            <div
              className={`assistant-session-item${session.id === activeId ? " active" : ""}`}
              key={session.id}
              onContextMenu={(event) => openSessionMenu(event, session)}
              title="右键管理会话"
            >
              {editingId === session.id ? (
                <input
                  className="ry-input"
                  autoFocus
                  value={draftTitle}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => commitRename(session.id).catch(() => undefined)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename(session.id).catch(() => undefined);
                    }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button className="assistant-session-open" type="button" onClick={() => openSession(session.id).catch(() => undefined)}>
                  <strong>{session.title}</strong>
                  <small>{session.preview || "—"}</small>
                </button>
              )}
            </div>
          ))}
          {!sessions.length && !loading ? <div className="muted">{text.emptySession}</div> : null}
        </div>
        {sessionMenu ? (
          <div
            className="assistant-context-menu"
            style={{ left: sessionMenu.x, top: sessionMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => {
                const session = sessions.find((item) => item.id === sessionMenu.id);
                if (session) startRename(session);
              }}
            >
              {text.rename}
            </button>
            <button type="button" className="danger" onClick={() => handleDelete(sessionMenu.id).catch(() => undefined)}>
              {text.remove}
            </button>
          </div>
        ) : null}
      </aside>

      <div className="ry-card assistant-chat-card">
        <div className="ry-card-hd">
          <div>
            <h2>{text.title}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {text.subtitle}
            </div>
          </div>
          <label className="assistant-lang-control">
            <span>{text.language}</span>
            <select className="ry-select" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <div className="ry-card-bd assistant-chat-body">
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="assistant-chat-window" ref={scroller}>
            {messages.map((message, index) => (
              <div className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="assistant-message-role">{message.role === "user" ? text.me : "AI"}</div>
                <div className="assistant-message-bubble">{message.role === "assistant" ? toPlainReply(message.content) : message.content}</div>
              </div>
            ))}
            {sending ? (
              <div className="assistant-message assistant">
                <div className="assistant-message-role">AI</div>
                <div className="assistant-message-bubble">{text.loadingAnswer}</div>
              </div>
            ) : null}
          </div>

          <div className="assistant-composer">
            <div className="assistant-quick">
              {text.quickQuestions.map((item) => (
                <button className="ry-btn ry-btn-plain" type="button" key={item} onClick={() => sendQuestion(item)}>
                  {item}
                </button>
              ))}
            </div>
            <form
              className="assistant-input-row"
              onSubmit={(event) => {
                event.preventDefault();
                sendQuestion().catch(() => undefined);
              }}
            >
              <input
                className="ry-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={text.placeholder}
              />
              <button className="ry-btn ry-btn-primary" type="submit" disabled={sending || !question.trim()}>
                {text.send}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
