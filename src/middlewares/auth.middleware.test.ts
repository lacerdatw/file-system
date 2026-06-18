import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./auth.middleware";

jest.mock("../config/env", () => ({
  env: { jwtSecret: "test_secret" },
}));

const app = express();
app.use(authMiddleware);
app.get("/protected", (_req, res) => res.json({ ok: true }));

describe("authMiddleware", () => {
  it("allows requests with a valid JWT", async () => {
    const token = jwt.sign({ sub: "uuid-1", email: "a@b.com" }, "test_secret");

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer bad.token.here");

    expect(res.status).toBe(401);
  });
});
