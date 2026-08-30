import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

// Simple shared-secret auth for the curation panel. Not a real user system —
// intentionally minimal for a tool used by a handful of trusted people.
// Configure ADMIN_TOKEN in the backend's .env; anyone with that value can
// read/write everything under /api/admin.
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const configuredToken = process.env.ADMIN_TOKEN;

    if (!configuredToken) {
        // Fail closed: without a configured token, admin routes are unusable
        // rather than silently open.
        console.error("ADMIN_TOKEN is not set — refusing all /api/admin requests.");
        res.status(503).json({ error: "admin_not_configured" });
        return;
    }

    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token || !safeEqual(token, configuredToken)) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }

    next();
}

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // timingSafeEqual throws if lengths differ, so guard first — this length
    // check itself leaks only length, which is an acceptable trade-off here.
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}
