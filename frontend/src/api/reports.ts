import { apiClient } from "./client";
import { getAdminToken } from "./admin";
import type { AdminReportListResponse, Report, ReportReason } from "../types";

// Public: any learner can flag a collocation (or one of its example
// sentences) as wrong. No auth required — this only ever creates a
// 'pending' row for the admin queue.
export function submitReport(
  collocationId: number | string,
  payload: { reason: ReportReason; comment?: string; example_id?: number }
) {
  return apiClient.post<{ report: Report }>(`/api/collocations/${collocationId}/report`, payload);
}

function adminAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function listAdminReports(opts: { status?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return apiClient.get<AdminReportListResponse>(`/api/admin/reports?${params.toString()}`, adminAuthHeaders());
}

export function updateAdminReportStatus(id: number, status: "pending" | "resolved" | "dismissed") {
  return apiClient.patch<{ report: Report }>(`/api/admin/reports/${id}`, { status }, adminAuthHeaders());
}

export function deleteAdminReport(id: number) {
  return apiClient.delete<{ deleted: boolean }>(`/api/admin/reports/${id}`, adminAuthHeaders());
}
