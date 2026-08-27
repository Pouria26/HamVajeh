import { apiClient } from "./client";
import type { CollocationDetailResponse, SearchResponse } from "../types";

export function searchCollocations(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiClient.get<SearchResponse>(`/api/collocations/search?${params.toString()}`);
}

export function getCollocationDetail(id: number | string) {
  return apiClient.get<CollocationDetailResponse>(`/api/collocations/${id}`);
}
