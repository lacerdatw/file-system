import { Router, Request } from "express";
import multer from "multer";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware";
import {
  uploadHandler,
  listHandler,
  downloadHandler,
  deleteHandler,
} from "./files.controller";

const upload = multer({ storage: multer.memoryStorage() });

export const filesRouter = Router();

filesRouter.use(authMiddleware);

filesRouter.post(
  "/upload",
  upload.single("file"),
  (req: Request, ...args) =>
    uploadHandler(req as AuthenticatedRequest, ...args)
);

filesRouter.get("/", (req: Request, ...args) =>
  listHandler(req as AuthenticatedRequest, ...args)
);

filesRouter.get("/:id/download", (req: Request, ...args) =>
  downloadHandler(req as AuthenticatedRequest, ...args)
);

filesRouter.delete("/:id", (req: Request, ...args) =>
  deleteHandler(req as AuthenticatedRequest, ...args)
);
