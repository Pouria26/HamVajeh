import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAgentHealth, sendAgentChatMessage } from "../api/agent";
import { ChatSidebar } from "../components/ChatSidebar";
import { MarkdownContent } from "../components/MarkdownContent";
import { Spinner } from "../components/ui/Spinner";
import { useChatSessions } from "../hooks/useChatSessions";
import type { AgentChatMessage, AgentHealthResponse } from "../types";

const STARTER_PROMPTS = [
  {
    icon: "🔍",
    title: "باهم‌آیی‌های فعل سبک",
    prompt: "با کلمه «تصمیم» چه فعل‌های سبکی هم‌آیی می‌سازند و کدام در پایگاه داده هم‌واژه رایج‌تر است؟",
  },
  {
    icon: "💡",
    title: "تفاوت باهم‌آیی و اصطلاح",
    prompt: "تفاوت باهم‌آیی (Collocation) و اصطلاح (Idiom) در زبان فارسی چیست؟ با چند مثال توضیح بده.",
  },
  {
    icon: "✍️",
    title: "کاربرد همنشینی در جمله",
    prompt: "فعل مناسب برای «جامه عمل» چیست و چگونه باید در جمله رسمی به کار برود؟",
  },
  {
    icon: "📊",
    title: "ترکیب‌های اضافی و وصفی",
    prompt: "چند نمونه از پرکاربردترین باهم‌آیی‌های موصوف و صفت در زبان فارسی را به همراه مثال بگو.",
  },
];

export function Tutor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryHandled = useRef(false);

  const {
    sessions,
    activeSessionId,
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    clearAllSessions,
    clearCurrentSession,
    appendMessage,
  } = useChatSessions();

  const messages = activeSession?.messages || [];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [health, setHealth] = useState<AgentHealthResponse | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Scroll to bottom smoothly when messages change or while loading
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Check health on mount
  useEffect(() => {
    let ignore = false;
    getAgentHealth()
      .then((res) => {
        if (!ignore) setHealth(res);
      })
      .catch(() => {
        if (!ignore) setHealth({ status: "error" });
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userMessage: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    appendMessage(userMessage);
    setInput("");
    setLoading(true);

    // Build history for backend gateway
    const historyPayload = messages
      .filter((m) => !m.isError && m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    try {
      const response = await sendAgentChatMessage({
        message: query,
        history: historyPayload,
      });

      const modelMessage: AgentChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        content: response.reply,
        timestamp: Date.now(),
        suggestedFollowups: response.suggested_followups,
      };

      appendMessage(modelMessage);
    } catch (err: unknown) {
      let errorText = (err as { message?: string })?.message;
      if (!errorText || errorText.startsWith("request_failed") || errorText === "network_error") {
        errorText =
          "متأسفانه در حال حاضر ارتباط با سرویس هوشمند برقرار نشد. لطفاً چند لحظه دیگر دوباره تلاش نمایید.";
      }

      const errorMessage: AgentChatMessage = {
        id: `err-${Date.now()}`,
        role: "model",
        content: errorText,
        timestamp: Date.now(),
        isError: true,
      };
      appendMessage(errorMessage);
    } finally {
      setLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Handle incoming query param from external links (?q=...)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialQueryHandled.current) {
      initialQueryHandled.current = true;
      setSearchParams({}, { replace: true });
      handleSend(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-11.5rem)] min-h-[540px] max-h-[820px] max-w-5xl gap-3">
      {/* Sidebar for Sessions */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          switchSession(id);
          if (window.innerWidth < 640) setSidebarOpen(false);
        }}
        onNewChat={() => {
          createSession();
          if (window.innerWidth < 640) setSidebarOpen(false);
        }}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onClearAll={clearAllSessions}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col rounded-3xl border border-ink-100 bg-white/95 shadow-sm backdrop-blur-md overflow-hidden min-w-0">
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 bg-white/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 shadow-2xs transition hover:bg-ink-50 hover:border-ink-300 active:scale-95 shrink-0"
              title="تاریخچه گفتگوها"
            >
              <span>💬</span>
              <span className="hidden sm:inline">تاریخچه</span>
              <span className="rounded-full bg-brand-50 px-1.5 py-0.2 text-[10px] font-bold text-brand-700">
                {sessions.length}
              </span>
            </button>

            <div className="h-4 w-px bg-ink-200 hidden sm:block shrink-0" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-base text-white shadow-xs">
                  🤖
                </div>
                <span
                  className={`absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    health?.status === "ok"
                      ? "bg-emerald-500"
                      : health?.status === "degraded"
                      ? "bg-amber-500"
                      : "bg-ink-300"
                  }`}
                  title={
                    health?.status === "ok"
                      ? "متصل و آنلاین"
                      : health?.status === "degraded"
                      ? "سرویس تنزل‌یافته"
                      : "در حال بررسی ارتباط"
                  }
                />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xs font-extrabold text-ink-900 sm:text-sm">
                  {activeSession?.title || "هم‌یار هوشمند باهم‌آیی‌ها"}
                </h1>
                <p className="hidden text-[10px] text-ink-400 sm:block">
                  پایگاه داده زبانی و آموزش تعاملی هم‌واژه
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 mr-2">
            <button
              type="button"
              onClick={() => createSession()}
              className="flex items-center gap-1 rounded-xl bg-brand-50 border border-brand-200 px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 active:scale-95"
              title="ایجاد گفتگوی جدید"
            >
              <span>+</span>
              <span className="hidden sm:inline">چت جدید</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("آیا مایل به پاک کردن این گفتگو هستید؟")) {
                    clearCurrentSession();
                  }
                }}
                title="پاک‌کردن پیام‌های این گفتگو"
                className="rounded-xl border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-50 hover:text-danger-600 active:scale-95"
              >
                پاک‌کردن
              </button>
            )}
          </div>
        </div>

      {/* Messages stream / Empty state */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="my-auto flex min-h-full flex-col items-center justify-start sm:justify-center py-6 text-center animate-fade-in-up">
            <div className="relative mb-4 flex items-center justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white p-3 shadow-lg shadow-brand-500/10 border border-brand-100 ring-4 ring-brand-50">
                <img
                  src="/favicon.svg"
                  alt="هم‌واژه"
                  className="h-14 w-14 object-contain"
                />
                <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500 text-white shadow-xs text-xs">
                  ✨
                </span>
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-ink-900 sm:text-2xl">
              سلام! من «هم‌یار» هستم
            </h2>
            <p className="mt-2 max-w-md text-sm text-ink-500 leading-6">
              دستیار آموزشی شما برای یادگیری، کشف همنشینی‌های طبیعی و تسلط بر باهم‌آیی‌های زبان فارسی بر پایه پایگاه داده جامع و معتبر هم‌واژه.
            </p>

            <div className="mt-6 w-full max-w-2xl">
              <p className="mb-3 text-right text-xs font-semibold text-ink-400">
                پیشنهادها برای شروع گفتگو:
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(item.prompt)}
                    className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 text-right shadow-2xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-xs active:translate-y-0"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-ink-900">{item.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-ink-500">
                        {item.prompt}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 animate-fade-in-up ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!isUser && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-sm text-white shadow-xs">
                      🤖
                    </div>
                  )}

                  <div
                    className={`group relative max-w-[85%] sm:max-w-[78%] ${
                      isUser
                        ? "rounded-2xl rounded-tl-xs bg-brand-500 text-white shadow-xs p-3.5 sm:p-4 text-sm leading-7"
                        : msg.isError
                        ? "rounded-2xl rounded-tr-xs border border-danger-200 bg-danger-50/90 text-danger-800 p-4 text-sm leading-7 shadow-xs"
                        : "rounded-2xl rounded-tr-xs border border-ink-100 bg-white p-4 text-sm leading-7 text-ink-900 shadow-2xs sm:p-5"
                    }`}
                  >
                    {isUser || msg.isError ? (
                      <div className="whitespace-pre-line break-words">{msg.content}</div>
                    ) : (
                      <MarkdownContent content={msg.content} />
                    )}

                    {!isUser && !msg.isError && (
                      <div className="mt-3 flex items-center justify-between border-t border-ink-100/60 pt-2 text-[11px] text-ink-400">
                        <span>هم‌یار هوشمند • پایگاه داده زبانی هم‌واژه</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-ink-700 transition"
                        >
                          {copiedId === msg.id ? "✓ کپی شد" : "📋 کپی متن"}
                        </button>
                      </div>
                    )}

                    {!isUser &&
                      msg.suggestedFollowups &&
                      msg.suggestedFollowups.length > 0 && (
                        <div className="mt-3.5 space-y-1.5 border-t border-ink-100 pt-3">
                          <p className="text-[11px] font-semibold text-ink-400">
                            💡 پرسش‌های پیشنهادی برای ادامه یادگیری:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestedFollowups.map((chip, chipIdx) => (
                              <button
                                key={chipIdx}
                                type="button"
                                onClick={() => handleSend(chip)}
                                className="rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-300 active:scale-95"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-2.5 animate-fade-in-up">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-sm text-white shadow-xs">
                  🤖
                </div>
                <div className="rounded-2xl rounded-tr-xs border border-ink-100 bg-white p-4 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-medium text-brand-600">
                    <Spinner className="h-4 w-4 text-brand-500" />
                    <span>هم‌یار در حال کاوش در پایگاه داده زبانی هم‌واژه و تدوین پاسخ است…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-ink-100 bg-white/90 p-3 backdrop-blur-md sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="پرسش خود درباره باهم‌آیی‌های فارسی را بنویسید… (مثلاً: با «تصمیم» چه فعل‌هایی می‌آید؟)"
            disabled={loading}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-xs transition hover:bg-brand-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            title="ارسال پیام"
          >
            {loading ? <Spinner className="h-4 w-4 text-white" /> : <span>↑</span>}
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-ink-400">
          <span>Enter برای ارسال • Shift+Enter برای رفتن به سطر بعد</span>
          <span>پاسخ‌ها توسط هوش مصنوعی و بر اساس پایگاه داده جامع هم‌واژه تولید می‌شوند.</span>
        </div>
      </div>
    </div>
  </div>
);
}
