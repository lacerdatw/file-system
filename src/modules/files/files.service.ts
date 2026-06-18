import { randomUUID } from "crypto";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../config/s3";
import { env } from "../../config/env";
import {
  createFile,
  findFilesByUser,
  findFileById,
  deleteFile,
  FileRow,
} from "./files.repository";

const PRESIGNED_URL_EXPIRES = 900; // 15 minutes

export async function upload(params: {
  userId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}): Promise<FileRow> {
  const s3Key = `${params.userId}/${randomUUID()}-${params.filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.s3BucketName,
      Key: s3Key,
      Body: params.buffer,
      ContentType: params.mimeType,
    })
  );

  return createFile({
    userId: params.userId,
    filename: params.filename,
    s3Key,
    size: params.size,
    mimeType: params.mimeType,
  });
}

export async function listFiles(userId: string): Promise<FileRow[]> {
  return findFilesByUser(userId);
}

export async function getDownloadUrl(
  fileId: string,
  userId: string
): Promise<string> {
  const file = await findFileById(fileId, userId);
  if (!file) throw new Error("File not found");

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.s3BucketName, Key: file.s3_key }),
    { expiresIn: PRESIGNED_URL_EXPIRES }
  );
}

export async function remove(fileId: string, userId: string): Promise<void> {
  const file = await findFileById(fileId, userId);
  if (!file) throw new Error("File not found");

  await s3Client.send(
    new DeleteObjectCommand({ Bucket: env.s3BucketName, Key: file.s3_key })
  );

  await deleteFile(fileId, userId);
}
