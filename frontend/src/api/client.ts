import { API_BASE_URL } from "../config";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("network_error", 0);
  }

  if (!res.ok) {
    let message = `request_failed_${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (body?.message) {
        message = body.message;
        code = body.error;
      } else if (body?.error) {
        message = body.error;
        code = body.error;
      }
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new ApiError(message, res.status, code);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, headers?: HeadersInit) => request<T>(path, { headers }),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), headers }),
  patch: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), headers }),
  delete: <T>(path: string, headers?: HeadersInit) => request<T>(path, { method: "DELETE", headers }),
};
