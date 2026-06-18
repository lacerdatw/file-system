import { pool } from "../../config/database";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export async function createUser(email: string, passwordHash: string): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    [email, passwordHash]
  );
  return rows[0]!;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return rows[0] ?? null;
}
