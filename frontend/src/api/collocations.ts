import { apiClient } from "./client";
import type { CollocationDetailResponse, SearchResponse } from "../types";

export function searchCollocations(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiClient.get<SearchResponse>(`/api/collocations/search?${params.toString()}`);
}

export function getCollocationDetail(id: number | string) {
  return apiClient.get<CollocationDetailResponse>(`/api/collocations/${id}`);
}

// High-quality, curated collocations for the homepage (backend filters out noise).
export function getFeaturedCollocations(limit = 6) {
  return apiClient.get<SearchResponse>(`/api/collocations/featured?limit=${limit}`);
}

// Other collocations sharing a word with this one (also quality-filtered on the backend).
export function getRelatedCollocations(id: number | string, limit = 6) {
  return apiClient.get<SearchResponse>(`/api/collocations/${id}/related?limit=${limit}`);
}
