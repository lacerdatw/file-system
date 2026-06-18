import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { upload, listFiles, getDownloadUrl, remove } from "./files.service";

export async function uploadHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  try {
    const file = await upload({
      userId: req.userId,
      filename: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = await listFiles(req.userId);
    res.status(200).json(files);
  } catch (err) {
    next(err);
  }
}

export async function downloadHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const url = await getDownloadUrl(req.params["id"] as string, req.userId);
    res.status(200).json({ url });
  } catch (err) {
    if (err instanceof Error && err.message === "File not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function deleteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await remove(req.params["id"] as string, req.userId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === "File not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
}
