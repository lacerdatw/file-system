import express from "express";
import { authRouter } from "./modules/auth/auth.router";
import { filesRouter } from "./modules/files/files.router";
import { errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/files", filesRouter);

app.use(errorMiddleware);
