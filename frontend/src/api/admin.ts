import { apiClient } from "./client";
import type {
  AdminCollocationDetailResponse,
  AdminCollocationListResponse,
  AdminExample,
  NewCollocationPayload,
  UpdateCollocationPayload,
  UpdateExamplePayload,
} from "../types";

// The admin panel is a shared-secret gate, not a real login system: the
// token is whatever the person typed into the prompt, kept only for this
// browser tab (sessionStorage), and sent as a bearer token on every call.
const TOKEN_KEY = "hv_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function listAdminCollocations(opts: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return apiClient.get<AdminCollocationListResponse>(
    `/api/admin/collocations?${params.toString()}`,
    authHeaders()
  );
}

export function getAdminCollocation(id: number) {
  return apiClient.get<AdminCollocationDetailResponse>(`/api/admin/collocations/${id}`, authHeaders());
}

export function createAdminCollocation(payload: NewCollocationPayload) {
  return apiClient.post<AdminCollocationDetailResponse>(
    `/api/admin/collocations`,
    payload,
    authHeaders()
  );
}

export function updateAdminCollocation(id: number, payload: UpdateCollocationPayload) {
  return apiClient.patch<{ collocation: unknown }>(
    `/api/admin/collocations/${id}`,
    payload,
    authHeaders()
  );
}

export function deleteAdminCollocation(id: number) {
  return apiClient.delete<{ deleted: boolean }>(`/api/admin/collocations/${id}`, authHeaders());
}

export function updateAdminExample(id: number, payload: UpdateExamplePayload) {
  return apiClient.patch<{ example: AdminExample }>(`/api/admin/examples/${id}`, payload, authHeaders());
}

export function deleteAdminExample(id: number) {
  return apiClient.delete<{ deleted: boolean }>(`/api/admin/examples/${id}`, authHeaders());
}

export function reorderAdminExamples(collocationId: number, orderedIds: number[]) {
  return apiClient.patch<{ examples: AdminExample[] }>(
    `/api/admin/collocations/${collocationId}/reorder-examples`,
    { orderedIds },
    authHeaders()
  );
}
