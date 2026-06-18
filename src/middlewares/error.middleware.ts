import { Request, Response, NextFunction } from "express";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error(`[error] ${message}`, err instanceof Error ? err.stack : err);
  res.status(500).json({ error: message });
}
