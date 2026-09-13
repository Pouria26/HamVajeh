import { apiClient } from "./client";
import type {
  AgentChatPayload,
  AgentChatResponse,
  AgentExplainPayload,
  AgentExplainResponse,
  AgentHealthResponse,
} from "../types";

export function sendAgentChatMessage(payload: AgentChatPayload): Promise<AgentChatResponse> {
  return apiClient.post<AgentChatResponse>("/api/agent/chat", payload);
}

export function explainExerciseError(payload: AgentExplainPayload): Promise<AgentExplainResponse> {
  return apiClient.post<AgentExplainResponse>("/api/agent/explain", payload);
}

export function getAgentHealth(): Promise<AgentHealthResponse> {
  return apiClient.get<AgentHealthResponse>("/api/agent/health");
}
