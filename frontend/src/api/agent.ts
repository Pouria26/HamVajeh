import { apiClient } from "./client";
import type {
  AgentChatPayload,
  AgentChatResponse,
  AgentExplainPayload,
  AgentExplainResponse,
  AgentHealthResponse,
  SearchAssistantPayload,
  SearchAssistantResponse,
  SentenceWorkshopPayload,
  SentenceWorkshopResponse,
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

export function generateCollocationSentences(
  payload: SentenceWorkshopPayload
): Promise<SentenceWorkshopResponse> {
  return apiClient.post<SentenceWorkshopResponse>("/api/agent/sentences", payload);
}

export function getSearchAssistantAnalysis(
  payload: SearchAssistantPayload
): Promise<SearchAssistantResponse> {
  return apiClient.post<SearchAssistantResponse>("/api/agent/search-assist", payload);
}

