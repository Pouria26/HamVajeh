import type { AgentChatMessage, ChatSession } from "../types";

export const SESSIONS_STORAGE_KEY = "hamvajeh_tutor_sessions_v2";
export const ACTIVE_SESSION_STORAGE_KEY = "hamvajeh_tutor_active_session_id_v2";
export const SESSIONS_UPDATED_EVENT = "hamvajeh_sessions_updated";

export interface ActiveSessionSummary {
  id: string;
  title: string;
  messageCount: number;
}

export interface ChatHandoffOptions {
  prompt: string;
  reply?: string;
  suggestedFollowups?: string[];
  mode: "new" | "current";
  sessionTitle?: string;
}

export function cleanTitleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^(\s*سلام\s*|\s*درود\s*|[؟!.,،:;'"«»()])/g, "")
    .replace(/[؟!.,،:;'"«»()]/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "گفتگوی جدید";

  const titleWords = words.slice(0, 5).join(" ");
  return titleWords.length > 35 ? titleWords.slice(0, 35).trim() + "…" : titleWords;
}

export function getStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

export function getActiveSessionSummary(): ActiveSessionSummary | null {
  try {
    const sessions = getStoredSessions();
    if (sessions.length === 0) return null;
    const activeId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    const active = sessions.find((s) => s.id === activeId) || sessions[0];
    return {
      id: active.id,
      title: active.title || "گفتگوی بدون عنوان",
      messageCount: active.messages?.length || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Transfers a prompt and optionally its pre-computed reply into a chat session.
 * If a reply is present, both user and model messages are persisted directly,
 * requiring zero new network calls to the LLM upon navigating to /tutor.
 */
export function transferToChat(options: ChatHandoffOptions): { sessionId: string; willAutoSend: boolean } {
  const { prompt, reply, suggestedFollowups, mode, sessionTitle } = options;
  const now = Date.now();
  let sessions = getStoredSessions();
  let activeId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || "";

  const hasReply = Boolean(reply && reply.trim().length > 0);

  const messagesToAdd: AgentChatMessage[] = [
    {
      id: `user-${now}`,
      role: "user",
      content: prompt.trim(),
      timestamp: now,
    },
  ];

  if (hasReply) {
    messagesToAdd.push({
      id: `model-${now + 1}`,
      role: "model",
      content: reply!.trim(),
      timestamp: now + 1,
      suggestedFollowups:
        suggestedFollowups && suggestedFollowups.length > 0 ? suggestedFollowups : undefined,
    });
  }

  if (mode === "new" || sessions.length === 0) {
    const newSessionId = `session_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const title = sessionTitle?.trim() || cleanTitleFromPrompt(prompt);

    const newSession: ChatSession = {
      id: newSessionId,
      title,
      createdAt: now,
      updatedAt: now,
      messages: hasReply ? messagesToAdd : [],
    };

    sessions = [newSession, ...sessions];
    activeId = newSessionId;
  } else {
    // Current active session
    let targetIndex = sessions.findIndex((s) => s.id === activeId);
    if (targetIndex === -1) {
      targetIndex = 0;
      activeId = sessions[0].id;
    }

    if (hasReply) {
      const targetSession = sessions[targetIndex];
      const updatedMessages = [...targetSession.messages, ...messagesToAdd];
      let updatedTitle = targetSession.title;
      if (targetSession.title === "گفتگوی جدید" && targetSession.messages.length === 0) {
        updatedTitle = sessionTitle?.trim() || cleanTitleFromPrompt(prompt);
      }

      sessions[targetIndex] = {
        ...targetSession,
        title: updatedTitle,
        updatedAt: now,
        messages: updatedMessages,
      };
    }
  }

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeId);
    window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT));
  } catch (err) {
    console.error("Failed to persist chat handoff in localStorage", err);
  }

  return { sessionId: activeId, willAutoSend: !hasReply };
}
