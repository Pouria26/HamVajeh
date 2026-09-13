import { Router, Request, Response } from "express";
import { validateRequest } from "../middleware/validate";
import { agentChatSchema, agentExplainSchema } from "../schemas";

export const agentRouter = Router();

const DEFAULT_AGENT_SERVICE_URL = "http://127.0.0.1:8001";

export function getAgentServiceUrl(): string {
    return process.env.AGENT_SERVICE_URL || DEFAULT_AGENT_SERVICE_URL;
}

interface ForwardResult {
    ok: boolean;
    status: number;
    data: unknown;
}

export async function forwardToAgent(
    endpoint: string,
    method = "POST",
    body?: unknown,
    timeoutMs = 30000
): Promise<ForwardResult> {
    const baseUrl = getAgentServiceUrl();
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });

        let data: unknown;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return {
            ok: response.ok,
            status: response.status,
            data,
        };
    } catch (err: unknown) {
        const errorMessage = (err as Error)?.message || "Agent service unreachable";
        return {
            ok: false,
            status: 503,
            data: {
                error: "agent_service_unavailable",
                message: "سرویس دستیار هوشمند در حال حاضر در دسترس نیست. لطفاً دقایقی دیگر مجدداً تلاش فرمایید.",
                details: errorMessage,
            },
        };
    }
}

/**
 * POST /api/agent/chat
 * Multi-turn conversational endpoint for the Persian Collocation AI Tutor ("هم‌یار").
 */
agentRouter.post(
    "/chat",
    validateRequest({ body: agentChatSchema }),
    async (req: Request, res: Response): Promise<void> => {
        const result = await forwardToAgent("/chat", "POST", req.body);
        res.status(result.status).json(result.data);
    }
);

/**
 * POST /api/agent/explain
 * Linguistic error analysis endpoint explaining quiz mistakes against authentic corpus evidence.
 */
agentRouter.post(
    "/explain",
    validateRequest({ body: agentExplainSchema }),
    async (req: Request, res: Response): Promise<void> => {
        const result = await forwardToAgent("/explain", "POST", req.body);
        res.status(result.status).json(result.data);
    }
);

/**
 * GET /api/agent/health
 * Probes the health and status of the internal agent microservice.
 */
agentRouter.get("/health", async (_req: Request, res: Response): Promise<void> => {
    const result = await forwardToAgent("/health", "GET", undefined, 5000);
    if (!result.ok) {
        res.status(503).json({
            status: "degraded",
            agent_service: "unreachable",
            message: "سرویس ایجنت پایتون در دسترس نیست.",
        });
        return;
    }
    res.status(200).json({
        status: "ok",
        agent_service: "connected",
        metrics: result.data,
    });
});
