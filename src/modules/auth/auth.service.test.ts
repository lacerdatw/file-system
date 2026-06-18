import * as authRepository from "./auth.repository";
import * as authService from "./auth.service";

jest.mock("./auth.repository");
jest.mock("../../config/env", () => ({
  env: { jwtSecret: "test_secret" },
}));

const mockedRepo = jest.mocked(authRepository);

describe("AuthService.register", () => {
  it("hashes the password and persists the user", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue(null);
    mockedRepo.createUser.mockResolvedValue({
      id: "uuid-1",
      email: "a@b.com",
      password_hash: "hashed",
      created_at: new Date(),
    });

    const user = await authService.register("a@b.com", "password123");

    expect(mockedRepo.createUser).toHaveBeenCalledWith(
      "a@b.com",
      expect.stringMatching(/^\$2/)
    );
    expect(user).toMatchObject({ id: "uuid-1", email: "a@b.com" });
  });

  it("throws when email already exists", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue({
      id: "uuid-1",
      email: "a@b.com",
      password_hash: "hashed",
      created_at: new Date(),
    });

    await expect(authService.register("a@b.com", "password123")).rejects.toThrow(
      "Email already in use"
    );
  });
});

describe("AuthService.login", () => {
  it("returns a JWT when credentials are valid", async () => {
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("password123", 10);

    mockedRepo.findUserByEmail.mockResolvedValue({
      id: "uuid-1",
      email: "a@b.com",
      password_hash: hash,
      created_at: new Date(),
    });

    const token = await authService.login("a@b.com", "password123");

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("throws when user is not found", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue(null);

    await expect(authService.login("x@y.com", "pass")).rejects.toThrow(
      "Invalid credentials"
    );
  });

  it("throws when password is wrong", async () => {
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("correct", 10);

    mockedRepo.findUserByEmail.mockResolvedValue({
      id: "uuid-1",
      email: "a@b.com",
      password_hash: hash,
      created_at: new Date(),
    });

    await expect(authService.login("a@b.com", "wrong")).rejects.toThrow(
      "Invalid credentials"
    );
  });
});
