import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { createUser, findUserByEmail, UserRow } from "./auth.repository";

const SALT_ROUNDS = 10;

export async function register(
  email: string,
  password: string
): Promise<Omit<UserRow, "password_hash">> {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser(email, passwordHash);

  const { password_hash: _, ...safeUser } = user;
  return safeUser;
}

export async function login(email: string, password: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: "7d",
  });
}
