import { Request, Response, NextFunction } from "express";

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  console.log(`[req] ${req.method} ${req.path}`);

  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[res] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });

  next();
}
