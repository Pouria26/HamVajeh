import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAgentHealth, sendAgentChatMessage } from "../api/agent";
import { Spinner } from "../components/ui/Spinner";
import type { AgentChatMessage, AgentHealthResponse } from "../types";

const STORAGE_KEY = "hamvajeh_tutor_history_v1";

const STARTER_PROMPTS = [
  {
    icon: "🔍",
    title: "باهم‌آیی‌های فعل سبک",
    prompt: "با کلمه «تصمیم» چه فعل‌های سبکی هم‌آیی می‌سازند و کدام در پیکره فارسی رایج‌تر است؟",
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

  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore localStorage parse errors
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [health, setHealth] = useState<AgentHealthResponse | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync conversation to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore localStorage write quota errors
    }
  }, [messages]);

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

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // Build history for backend gateway
    const historyPayload = messages
      .filter((m) => !m.isError && m.content.trim().length > 0)
      .slice(-6)
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

      setMessages([...nextMessages, modelMessage]);
    } catch (err: unknown) {
      const errorText =
        (err as { message?: string })?.message ||
        "متأسفانه در برقراری ارتباط با هم‌یار خطایی رخ داد. لطفاً دوباره تلاش کنید.";

      const errorMessage: AgentChatMessage = {
        id: `err-${Date.now()}`,
        role: "model",
        content: errorText,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages([...nextMessages, errorMessage]);
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

  const handleClearHistory = () => {
    if (window.confirm("آیا مایل به پاک کردن تاریخچه گفتگو با هم‌یار هستید؟")) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
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
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-4xl flex-col sm:h-[calc(100vh-9.5rem)]">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-ink-100 bg-white/70 px-4 py-3 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-xl text-white shadow-sm">
              🤖
            </div>
            <span
              className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white ${
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
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-ink-900 sm:text-lg">
                هم‌یار هوشمند باهم‌آیی‌ها
              </h1>
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                هوش مصنوعی
              </span>
            </div>
            <p className="text-xs text-ink-400">
              آموزش و کاوش تعاملی در باهم‌آیی‌های پیکره زبان فارسی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="پاک‌کردن تاریخچه گفتگو"
              className="rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-50 hover:text-danger-600 active:scale-95"
            >
              پاک‌کردن چت
            </button>
          )}
        </div>
      </div>

      {/* Messages stream / Empty state */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center animate-fade-in-up">
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-brand-500 to-brand-300 grid place-items-center text-3xl text-white shadow-md">
                ✨
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-ink-900 sm:text-2xl">
              سلام! من «هم‌یار» هستم
            </h2>
            <p className="mt-2 max-w-md text-sm text-ink-500 leading-6">
              دستیار آموزشی شما برای یادگیری، کشف همنشینی‌های طبیعی و تسلط بر باهم‌آیی‌های زبان فارسی بر پایه پیکره معتبر همشهری.
            </p>

            <div className="mt-8 w-full max-w-2xl">
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
                    <div className="whitespace-pre-line break-words">{msg.content}</div>

                    {!isUser && !msg.isError && (
                      <div className="mt-3 flex items-center justify-between border-t border-ink-100/60 pt-2 text-[11px] text-ink-400">
                        <span>هم‌یار هوشمند • پایگاه پیکره همشهری</span>
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
                    <span>هم‌یار در حال جستجو در پیکره زبانی و تدوین پاسخ است…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-ink-100 bg-white/90 p-3 backdrop-blur-md rounded-b-2xl sm:p-4">
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
          <span>پاسخ‌ها توسط هوش مصنوعی و بر اساس پیکره زبانی همشهری تولید می‌شوند.</span>
        </div>
      </div>
    </div>
  );
}
