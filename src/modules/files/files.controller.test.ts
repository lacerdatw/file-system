import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { filesRouter } from "./files.router";
import * as filesService from "./files.service";

jest.mock("./files.service");
jest.mock("../../config/env", () => ({
  env: { jwtSecret: "test_secret" },
}));

const mockedService = jest.mocked(filesService);

const app = express();
app.use(express.json());
app.use("/files", filesRouter);

const validToken = jwt.sign(
  { sub: "user-uuid", email: "a@b.com" },
  "test_secret"
);

const authHeader = { Authorization: `Bearer ${validToken}` };

describe("POST /files/upload", () => {
  it("returns 201 on successful upload", async () => {
    mockedService.upload.mockResolvedValue({
      id: "file-uuid",
      user_id: "user-uuid",
      filename: "test.png",
      s3_key: "user-uuid/test.png",
      size: 10,
      mime_type: "image/png",
      created_at: new Date(),
    });

    const res = await request(app)
      .post("/files/upload")
      .set(authHeader)
      .attach("file", Buffer.from("data"), "test.png");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: "file-uuid" });
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app)
      .post("/files/upload")
      .set(authHeader);

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth token", async () => {
    const res = await request(app)
      .post("/files/upload")
      .attach("file", Buffer.from("data"), "test.png");

    expect(res.status).toBe(401);
  });
});

describe("GET /files", () => {
  it("returns 200 with file list", async () => {
    mockedService.listFiles.mockResolvedValue([
      {
        id: "file-uuid",
        user_id: "user-uuid",
        filename: "test.png",
        s3_key: "user-uuid/test.png",
        size: 10,
        mime_type: "image/png",
        created_at: new Date(),
      },
    ]);

    const res = await request(app).get("/files").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /files/:id/download", () => {
  it("returns 200 with presigned URL", async () => {
    mockedService.getDownloadUrl.mockResolvedValue("https://s3.example.com/presigned");

    const res = await request(app)
      .get("/files/file-uuid/download")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ url: "https://s3.example.com/presigned" });
  });

  it("returns 404 when file not found", async () => {
    mockedService.getDownloadUrl.mockRejectedValue(new Error("File not found"));

    const res = await request(app)
      .get("/files/bad-id/download")
      .set(authHeader);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /files/:id", () => {
  it("returns 204 on success", async () => {
    mockedService.remove.mockResolvedValue();

    const res = await request(app)
      .delete("/files/file-uuid")
      .set(authHeader);

    expect(res.status).toBe(204);
  });

  it("returns 404 when file not found", async () => {
    mockedService.remove.mockRejectedValue(new Error("File not found"));

    const res = await request(app)
      .delete("/files/bad-id")
      .set(authHeader);

    expect(res.status).toBe(404);
  });
});
