import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface RequestValidators {
    params?: ZodSchema;
    query?: ZodSchema;
    body?: ZodSchema;
}

export function validateRequest(validators: RequestValidators) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (validators.params) {
                const parsed = validators.params.parse(req.params);
                // Assign validated and coerced values back
                Object.assign(req.params, parsed);
            }
            if (validators.query) {
                const parsed = validators.query.parse(req.query);
                Object.assign(req.query, parsed);
            }
            if (validators.body) {
                req.body = validators.body.parse(req.body);
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const firstIssue = error.issues[0];
                const pathStr = firstIssue.path.join(".");
                let errorCode = "invalid_input";

                if (
                    firstIssue.message.startsWith("invalid_") ||
                    firstIssue.message.startsWith("missing_")
                ) {
                    errorCode = firstIssue.message;
                } else if (
                    pathStr.includes("id") ||
                    pathStr.includes("collocationId") ||
                    pathStr.includes("exampleId")
                ) {
                    errorCode = "invalid_id";
                } else if (pathStr.includes("category")) {
                    errorCode = "missing_category";
                } else if (pathStr.includes("reason")) {
                    errorCode = "invalid_reason";
                } else if (pathStr.includes("optionId")) {
                    errorCode = "invalid_input";
                }

                res.status(400).json({
                    error: errorCode,
                    details: error.flatten(),
                });
                return;
            }
            next(error);
        }
    };
}
