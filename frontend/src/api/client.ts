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
    let message = "متأسفانه در پردازش درخواست خطایی رخ داد. لطفاً دوباره تلاش کنید.";
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string" && body.detail.trim().length > 0) {
        message = body.detail;
      } else if (typeof body?.message === "string" && body.message.trim().length > 0) {
        message = body.message;
      } else if (typeof body?.error === "string" && body.error.trim().length > 0) {
        message = body.error;
        code = body.error;
      }
    } catch {
      if (res.status === 429) {
        message = "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کرده و مجدداً تلاش فرمایید.";
      } else if (res.status >= 500) {
        message = "سرویس هوشمند در حال حاضر با بار کاری بالا مواجه است. لطفاً دقایقی بعد دوباره تلاش نمایید.";
      }
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
