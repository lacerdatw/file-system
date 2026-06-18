import request from "supertest";
import express from "express";
import { authRouter } from "./auth.router";
import * as authService from "./auth.service";

jest.mock("./auth.service");
jest.mock("../../config/env", () => ({ env: { jwtSecret: "test_secret" } }));

const mockedService = jest.mocked(authService);

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

describe("POST /auth/register", () => {
  it("returns 201 with user on success", async () => {
    mockedService.register.mockResolvedValue({
      id: "uuid-1",
      email: "a@b.com",
      created_at: new Date(),
    });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: "uuid-1", email: "a@b.com" });
  });

  it("returns 409 when email already in use", async () => {
    mockedService.register.mockRejectedValue(new Error("Email already in use"));

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(409);
  });

  it("returns 400 when body is invalid", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("returns 200 with token on success", async () => {
    mockedService.login.mockResolvedValue("jwt.token.here");

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ token: "jwt.token.here" });
  });

  it("returns 401 on invalid credentials", async () => {
    mockedService.login.mockRejectedValue(new Error("Invalid credentials"));

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "wrong" });

    expect(res.status).toBe(401);
  });
});
