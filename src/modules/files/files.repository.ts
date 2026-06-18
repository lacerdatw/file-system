import { pool } from "../../config/database";

export interface FileRow {
  id: string;
  user_id: string;
  filename: string;
  s3_key: string;
  size: number | null;
  mime_type: string | null;
  created_at: Date;
}

export async function createFile(params: {
  userId: string;
  filename: string;
  s3Key: string;
  size?: number;
  mimeType?: string;
}): Promise<FileRow> {
  const { rows } = await pool.query<FileRow>(
    `INSERT INTO files (user_id, filename, s3_key, size, mime_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [params.userId, params.filename, params.s3Key, params.size ?? null, params.mimeType ?? null]
  );
  return rows[0]!;
}

export async function findFilesByUser(userId: string): Promise<FileRow[]> {
  const { rows } = await pool.query<FileRow>(
    "SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows;
}

export async function findFileById(id: string, userId: string): Promise<FileRow | null> {
  const { rows } = await pool.query<FileRow>(
    "SELECT * FROM files WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function deleteFile(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM files WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
