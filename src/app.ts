import express from "express";
import cors from "cors";
import { authRouter } from "./modules/auth/auth.router";
import { filesRouter } from "./modules/files/files.router";
import { errorMiddleware } from "./middlewares/error.middleware";
import { loggerMiddleware } from "./middlewares/logger.middleware";

export const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],}));
app.use(express.json());
app.use(loggerMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/files", filesRouter);

app.use(errorMiddleware);
