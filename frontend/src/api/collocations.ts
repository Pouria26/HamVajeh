import { apiClient } from "./client";
import type {
  BrowseResponse,
  CollocationDetailResponse,
  PatternsResponse,
  SearchResponse,
} from "../types";

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

// Categories (pos_pattern) with counts, for the browse-by-category page.
export function getPatterns() {
  return apiClient.get<PatternsResponse>("/api/collocations/patterns");
}

// Paginated, quality-filtered listing of collocations within one category.
export function browseByPattern(pattern: string, limit = 24, offset = 0) {
  const params = new URLSearchParams({ pattern, limit: String(limit), offset: String(offset) });
  return apiClient.get<BrowseResponse>(`/api/collocations/browse?${params.toString()}`);
}
