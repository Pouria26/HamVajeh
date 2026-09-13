import { useState } from "react";
import type { ChatSession } from "../types";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onClearAll: () => void;
}

interface GroupedSessions {
  today: ChatSession[];
  yesterday: ChatSession[];
  pastWeek: ChatSession[];
  older: ChatSession[];
}

function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfPastWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const grouped: GroupedSessions = {
    today: [],
    yesterday: [],
    pastWeek: [],
    older: [],
  };

  for (const session of sessions) {
    const time = session.updatedAt || session.createdAt;
    if (time >= startOfToday) {
      grouped.today.push(session);
    } else if (time >= startOfYesterday) {
      grouped.yesterday.push(session);
    } else if (time >= startOfPastWeek) {
      grouped.pastWeek.push(session);
    } else {
      grouped.older.push(session);
    }
  }

  return grouped;
}

export function ChatSidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onClearAll,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveEditing = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("آیا مایل به حذف این گفتگو هستید؟")) {
      onDeleteSession(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("آیا مایل به پاک‌کردن تمامی گفتگوها هستید؟ این عمل غیرقابل بازگشت است.")) {
      onClearAll();
    }
  };

  const grouped = groupSessionsByDate(sessions);

  const renderSection = (title: string, list: ChatSession[]) => {
    if (list.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-2 pb-1.5 text-[11px] font-bold text-ink-400">{title}</div>
        <div className="space-y-1">
          {list.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = session.id === editingId;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-right transition cursor-pointer ${
                  isActive
                    ? "bg-brand-50 text-brand-900 font-semibold border border-brand-200/80 shadow-2xs"
                    : "text-ink-700 hover:bg-ink-100/70 hover:text-ink-900"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                  <span className="text-sm shrink-0">{isActive ? "💬" : "🗨️"}</span>

                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveEditing(session.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 flex-1"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="w-full rounded-md border border-brand-300 bg-white px-2 py-0.5 text-xs text-ink-900 outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={(e) => saveEditing(session.id, e)}
                        title="ذخیره"
                        className="text-emerald-600 hover:text-emerald-700 text-xs px-1"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        title="انصراف"
                        className="text-ink-400 hover:text-ink-600 text-xs px-1"
                      >
                        ✕
                      </button>
                    </form>
                  ) : (
                    <span className="truncate text-xs">{session.title}</span>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 mr-1">
                    <button
                      type="button"
                      onClick={(e) => startEditing(session, e)}
                      title="ویرایش عنوان"
                      className="rounded p-1 text-ink-400 hover:bg-white hover:text-ink-700 transition"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(session.id, e)}
                      title="حذف گفتگو"
                      className="rounded p-1 text-ink-400 hover:bg-white hover:text-danger-600 transition"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink-950/30 backdrop-blur-xs sm:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-ink-100 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-in-out sm:static sm:z-0 sm:w-64 sm:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-xl sm:shadow-none" : "translate-x-full sm:hidden"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-ink-100 p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-ink-900">گفتگوها</span>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
              {sessions.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 sm:hidden"
              title="بستن منو"
            >
              ✕
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 640) onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:brightness-105 active:scale-98"
          >
            <span>+</span>
            <span>گفتگوی جدید</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          {renderSection("امروز", grouped.today)}
          {renderSection("دیروز", grouped.yesterday)}
          {renderSection("۷ روز گذشته", grouped.pastWeek)}
          {renderSection("گفتگوهای پیشین", grouped.older)}
        </div>

        {/* Footer */}
        <div className="border-t border-ink-100 p-3">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-200 px-3 py-1.5 text-[11px] font-medium text-ink-500 transition hover:bg-danger-50 hover:border-danger-200 hover:text-danger-600 active:scale-98"
          >
            <span>🗑️</span>
            <span>پاک‌کردن تمام گفتگوها</span>
          </button>
        </div>
      </aside>
    </>
  );
}
