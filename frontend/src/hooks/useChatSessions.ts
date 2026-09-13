import { useCallback, useEffect, useState } from "react";
import type { AgentChatMessage, ChatSession } from "../types";

const SESSIONS_STORAGE_KEY = "hamvajeh_tutor_sessions_v2";
const ACTIVE_SESSION_STORAGE_KEY = "hamvajeh_tutor_active_session_id_v2";
const LEGACY_STORAGE_KEY = "hamvajeh_tutor_history_v1";

function cleanTitleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^(\s*سلام\s*|\s*درود\s*|[؟!.,،:;'"«»()])/g, "")
    .replace(/[؟!.,،:;'"«»()]/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "گفتگوی جدید";

  const titleWords = words.slice(0, 5).join(" ");
  return titleWords.length > 35 ? titleWords.slice(0, 35).trim() + "…" : titleWords;
}

function createNewSessionObject(initialTitle = "گفتگوی جدید"): ChatSession {
  const now = Date.now();
  return {
    id: `session_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: initialTitle,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as ChatSession[];
        }
      }

      // Check legacy migration
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const legacyMessages: unknown = JSON.parse(legacy);
        if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
          const migrated: ChatSession = {
            id: `session_${Date.now()}_legacy`,
            title: "گفتگوی پیشین",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: legacyMessages as AgentChatMessage[],
          };
          return [migrated];
        }
      }
    } catch {
      // Ignore parse errors and initialize fresh
    }

    return [createNewSessionObject()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (savedActive) return savedActive;
    } catch {
      // Ignore
    }
    return sessions[0]?.id || "";
  });

  // Ensure activeSessionId points to a valid session
  useEffect(() => {
    if (!sessions.some((s) => s.id === activeSessionId)) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        const fresh = createNewSessionObject();
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    }
  }, [sessions, activeSessionId]);

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    } catch {
      // Ignore quota errors
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const createSession = useCallback((customTitle?: string): string => {
    const newSession = createNewSessionObject(customTitle || "گفتگوی جدید");
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createNewSessionObject();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      return remaining;
    });
  }, []);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed, updatedAt: Date.now() } : s))
    );
  }, []);

  const clearAllSessions = useCallback(() => {
    const fresh = createNewSessionObject();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const clearCurrentSession = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [], updatedAt: Date.now(), title: "گفتگوی جدید" }
          : s
      )
    );
  }, [activeSessionId]);

  const appendMessage = useCallback(
    (message: AgentChatMessage) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;

          const updatedMessages = [...s.messages, message];
          let updatedTitle = s.title;

          // Auto-generate title on first user message if title is default
          if (s.title === "گفتگوی جدید" && message.role === "user") {
            updatedTitle = cleanTitleFromPrompt(message.content);
          }

          return {
            ...s,
            title: updatedTitle,
            updatedAt: Date.now(),
            messages: updatedMessages,
          };
        })
      );
    },
    [activeSessionId]
  );

  return {
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
  };
}
