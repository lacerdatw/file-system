import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as filesRepository from "./files.repository";
import * as filesService from "./files.service";

jest.mock("./files.repository");
jest.mock("../../config/env", () => ({
  env: {
    s3BucketName: "test-bucket",
    awsRegion: "us-east-1",
    awsAccessKeyId: "key",
    awsSecretAccessKey: "secret",
  },
}));
jest.mock("@aws-sdk/s3-request-presigner");

const s3Mock = mockClient(S3Client);
const mockedRepo = jest.mocked(filesRepository);
const mockedGetSignedUrl = jest.mocked(getSignedUrl);

beforeEach(() => {
  s3Mock.reset();
});

describe("FilesService.upload", () => {
  it("uploads to S3 and saves metadata", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    mockedRepo.createFile.mockResolvedValue({
      id: "file-uuid",
      user_id: "user-uuid",
      filename: "test.png",
      s3_key: expect.any(String) as string,
      size: 1024,
      mime_type: "image/png",
      created_at: new Date(),
    });

    const buffer = Buffer.from("fake image data");
    const file = await filesService.upload({
      userId: "user-uuid",
      filename: "test.png",
      buffer,
      mimeType: "image/png",
      size: buffer.length,
    });

    expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
      Bucket: "test-bucket",
      ContentType: "image/png",
    });
    expect(mockedRepo.createFile).toHaveBeenCalled();
    expect(file).toMatchObject({ filename: "test.png" });
  });
});

describe("FilesService.getDownloadUrl", () => {
  it("returns a presigned URL for an owned file", async () => {
    mockedRepo.findFileById.mockResolvedValue({
      id: "file-uuid",
      user_id: "user-uuid",
      filename: "test.png",
      s3_key: "user-uuid/test.png",
      size: 1024,
      mime_type: "image/png",
      created_at: new Date(),
    });
    mockedGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

    const url = await filesService.getDownloadUrl("file-uuid", "user-uuid");

    expect(url).toBe("https://s3.example.com/presigned");
  });

  it("throws when file is not found", async () => {
    mockedRepo.findFileById.mockResolvedValue(null);

    await expect(
      filesService.getDownloadUrl("bad-id", "user-uuid")
    ).rejects.toThrow("File not found");
  });
});

describe("FilesService.remove", () => {
  it("deletes from S3 and DB", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    mockedRepo.findFileById.mockResolvedValue({
      id: "file-uuid",
      user_id: "user-uuid",
      filename: "test.png",
      s3_key: "user-uuid/test.png",
      size: 1024,
      mime_type: "image/png",
      created_at: new Date(),
    });
    mockedRepo.deleteFile.mockResolvedValue(true);

    await filesService.remove("file-uuid", "user-uuid");

    expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
      Bucket: "test-bucket",
      Key: "user-uuid/test.png",
    });
    expect(mockedRepo.deleteFile).toHaveBeenCalledWith("file-uuid", "user-uuid");
  });

  it("throws when file is not found", async () => {
    mockedRepo.findFileById.mockResolvedValue(null);

    await expect(
      filesService.remove("bad-id", "user-uuid")
    ).rejects.toThrow("File not found");
  });
});
