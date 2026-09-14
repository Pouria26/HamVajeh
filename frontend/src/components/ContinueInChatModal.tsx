import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cleanTitleFromPrompt,
  getActiveSessionSummary,
  transferToChat,
  type ActiveSessionSummary,
} from "../utils/chatHandoff";

export interface ContinueInChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  reply?: string;
  suggestedFollowups?: string[];
  defaultTitle?: string;
  badgeLabel?: string;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ContinueInChatModal({
  isOpen,
  onClose,
  prompt,
  reply,
  suggestedFollowups,
  defaultTitle,
  badgeLabel,
}: ContinueInChatModalProps) {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<"new" | "current">("new");
  const [activeSession, setActiveSession] = useState<ActiveSessionSummary | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const hasReply = Boolean(reply && reply.trim().length > 0);
  const resolvedTitle = defaultTitle?.trim() || cleanTitleFromPrompt(prompt);

  // Sync active session info whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const summary = getActiveSessionSummary();
      setActiveSession(summary);
      // Default to "current" if there is an active session with existing messages,
      // or "new" if none exists.
      setSelectedMode("new");
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const { willAutoSend } = transferToChat({
      prompt,
      reply,
      suggestedFollowups,
      mode: selectedMode,
      sessionTitle: resolvedTitle,
    });

    onClose();

    if (willAutoSend) {
      // If there is no pre-computed reply, let Tutor auto-send it
      navigate(`/tutor?q=${encodeURIComponent(prompt)}`);
    } else {
      // Zero-quota handoff: messages are already injected into localStorage
      navigate("/tutor");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="continue-chat-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-2xl transition-all animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-brand-50/70 via-white to-brand-50/30 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-500 text-lg text-white shadow-xs">
              ✨
            </div>
            <div>
              <h3 id="continue-chat-title" className="text-base font-bold text-ink-900">
                ادامه گفتگو در هم‌یار هوشمند
              </h3>
              <p className="text-xs text-ink-500">
                {badgeLabel || "انتقال پرسش و پاسخ تحلیلی به صفحه چت زنده"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 active:scale-95"
            aria-label="بستن پنجره"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 p-5">
          {/* Zero-quota badge notice */}
          {hasReply ? (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-800">
              <span className="text-base">⚡️</span>
              <span className="font-medium">
                <strong>بدون مصرف مجدد سهمیه:</strong> پاسخ ایجنت بلافاصله و بدون معطلی به گفتگو منتقل می‌شود.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs text-brand-800">
              <span className="text-base">💡</span>
              <span className="font-medium">
                پرسش شما در هم‌یار مطرح خواهد شد و می‌توانید گفتگو را به شکل تعاملی پیش ببرید.
              </span>
            </div>
          )}

          {/* Context Snippet Preview */}
          <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-3.5 text-xs">
            <div className="font-semibold text-ink-500 mb-1">پرسش کاربر:</div>
            <p className="line-clamp-2 font-medium text-ink-800 leading-6">
              «{prompt}»
            </p>

            {hasReply && (
              <div className="mt-2.5 border-t border-ink-100/80 pt-2">
                <div className="font-semibold text-ink-500 mb-1">خلاصه پاسخ آماده هم‌یار:</div>
                <p className="line-clamp-3 text-ink-700 leading-6 whitespace-pre-line">
                  {reply!.replace(/[#*`_]/g, "").slice(0, 180)}…
                </p>
              </div>
            )}
          </div>

          {/* Session Selection Choices */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-ink-700">
              انتخاب مقصد گفتگو:
            </div>

            {/* Option 1: New Session */}
            <button
              type="button"
              onClick={() => setSelectedMode("new")}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-right transition active:scale-[0.99] ${
                selectedMode === "new"
                  ? "border-brand-500 bg-brand-50/60 shadow-xs ring-1 ring-brand-500/20"
                  : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/40"
              }`}
            >
              <div
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                  selectedMode === "new"
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-ink-300 bg-white"
                }`}
              >
                {selectedMode === "new" && <CheckIcon className="h-3 w-3" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-ink-900">
                    شروع در گفتگوی جدید
                  </span>
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                    پیشنهادی
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500 leading-5">
                  ایجاد یک گفتگوی تازه با عنوان «{resolvedTitle}» جهت تفکیک موضوع از سایر مکالمات.
                </p>
              </div>
            </button>

            {/* Option 2: Current Session */}
            <button
              type="button"
              onClick={() => setSelectedMode("current")}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-right transition active:scale-[0.99] ${
                selectedMode === "current"
                  ? "border-brand-500 bg-brand-50/60 shadow-xs ring-1 ring-brand-500/20"
                  : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/40"
              }`}
            >
              <div
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                  selectedMode === "current"
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-ink-300 bg-white"
                }`}
              >
                {selectedMode === "current" && <CheckIcon className="h-3 w-3" />}
              </div>

              <div className="flex-1">
                <div className="text-sm font-bold text-ink-900">
                  ادامه در گفتگوی فعلی
                </div>
                <p className="mt-1 text-xs text-ink-500 leading-5">
                  {activeSession ? (
                    <>
                      الحاق به انتهای گفتگوی <strong>«{activeSession.title}»</strong>
                      {activeSession.messageCount > 0 ? (
                        <span> ({activeSession.messageCount} پیام قبلی)</span>
                      ) : (
                        <span> (خالی)</span>
                      )}
                    </>
                  ) : (
                    "ادامه در گفتگوی جاری هم‌یار"
                  )}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-ink-100 bg-ink-50/40 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-600 transition hover:bg-ink-50 active:scale-95"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:from-brand-600 hover:to-brand-700 active:scale-95"
          >
            <span>انتقال به هم‌یار و ادامه گفتگو</span>
            <span>←</span>
          </button>
        </div>
      </div>
    </div>
  );
}
