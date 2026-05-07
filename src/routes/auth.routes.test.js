jest.mock("../models/User");
jest.mock("../services/emailService", () => ({
  generateVerificationToken: jest.fn(() => "verify-token-abc"),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  isEmailConfigured: jest.fn(() => true),
  buildVerifyUrl: jest.fn((token) => `http://localhost:5173/verify-email?token=${token}`),
}));

const bcrypt = require("bcryptjs");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const emailService = require("../services/emailService");

beforeEach(() => {
  emailService.generateVerificationToken.mockReturnValue("verify-token-abc");
  emailService.sendVerificationEmail.mockResolvedValue(true);
  emailService.isEmailConfigured.mockReturnValue(true);
  emailService.buildVerifyUrl.mockImplementation(
    (token) => `http://localhost:5173/verify-email?token=${token}`
  );
});

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("returns 201 and does not include password", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: "n1",
      username: "u",
      email: "u@e.com",
    });

    const res = await request(app).post("/api/auth/signup").send({
      username: "newuser",
      displayName: "New",
      email: "new@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message: expect.any(String),
      emailSent: true,
    });
    expect(res.body).not.toHaveProperty("password");
  });

  it("returns 409 when user exists", async () => {
    User.findOne.mockResolvedValue({ emailVerified: true });

    const res = await request(app).post("/api/auth/signup").send({
      username: "x",
      displayName: "X",
      email: "x@e.com",
      password: "password123",
    });

    expect(res.status).toBe(409);
  });

  it("returns 502 and deletes user when SMTP send throws", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: "n2", username: "u", email: "u@e.com" });
    User.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);
    emailService.sendVerificationEmail.mockRejectedValueOnce(new Error("smtp boom"));

    const res = await request(app).post("/api/auth/signup").send({
      username: "newuser",
      displayName: "New",
      email: "new@example.com",
      password: "password123",
    });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: "EMAIL_DELIVERY_FAILED" });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith("n2");
  });

  it("returns 201 with emailSent:false in dev when SMTP not configured", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: "n3", username: "u", email: "u@e.com" });
    emailService.sendVerificationEmail.mockResolvedValueOnce(false);

    const res = await request(app).post("/api/auth/signup").send({
      username: "devuser",
      displayName: "Dev",
      email: "dev@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ emailSent: false });
  });

  it("returns 503 in production when SMTP not configured", async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: "n4", username: "u", email: "u@e.com" });
    User.findByIdAndDelete = jest.fn().mockResolvedValue(undefined);
    emailService.sendVerificationEmail.mockResolvedValueOnce(false);

    const res = await request(app).post("/api/auth/signup").send({
      username: "produser",
      displayName: "Prod",
      email: "prod@example.com",
      password: "password123",
    });

    process.env.NODE_ENV = prevEnv;
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: "SMTP_NOT_CONFIGURED" });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith("n4");
  });
});

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app).post("/api/auth/resend-verification").send({});
    expect(res.status).toBe(400);
  });

  it("returns generic 200 when no matching unverified user (privacy-safe)", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ghost@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if that email/i);
  });

  it("returns 409 when user is already verified", async () => {
    User.findOne.mockResolvedValue({ emailVerified: true });
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "verified@example.com" });
    expect(res.status).toBe(409);
  });

  it("sends a new verification email when user exists and is unverified", async () => {
    const save = jest.fn().mockResolvedValue();
    User.findOne.mockResolvedValue({
      _id: "u9",
      email: "wait@example.com",
      emailVerified: false,
      save,
    });

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "wait@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ emailSent: true });
    expect(save).toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      "wait@example.com",
      "verify-token-abc"
    );
  });
});

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for bad password", async () => {
    const hash = await bcrypt.hash("right", 4);
    User.findOne.mockResolvedValue({
      username: "u",
      password: hash,
      accountStatus: "active",
      emailVerified: true,
      role: "cultivator",
      save: jest.fn().mockResolvedValue(),
    });

    const res = await request(app).post("/api/auth/signin").send({
      username: "u",
      password: "wrong",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("returns 200 with user shape and no password", async () => {
    const hash = await bcrypt.hash("secretpass", 4);
    User.findOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      username: "u",
      password: hash,
      accountStatus: "active",
      emailVerified: true,
      role: "cultivator",
      displayName: "U",
      avatar: null,
      email: "u@e.com",
      save: jest.fn().mockResolvedValue(),
    });

    const res = await request(app).post("/api/auth/signin").send({
      username: "u",
      password: "secretpass",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      token: expect.any(String),
      user: {
        id: expect.anything(),
        username: "u",
        email: "u@e.com",
        role: "cultivator",
      },
    });
    expect(res.body).not.toHaveProperty("refreshToken");
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/spora_refresh=/)]),
    );
    expect(res.body.user).not.toHaveProperty("password");
  });
});

describe("GET /api/auth/me", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user without password when authenticated", async () => {
    User.findById.mockResolvedValue({
      _id: userId,
      username: "me",
      displayName: "Me",
      avatar: null,
      bio: "",
      followersCount: 0,
      followingCount: 0,
      email: "m@e.com",
      role: "cultivator",
      accountStatus: "active",
      stats: null,
    });

    const token = jwt.sign(
      { sub: userId, role: "cultivator", type: "access" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: "me",
      email: "m@e.com",
      role: "cultivator",
    });
    expect(res.body).not.toHaveProperty("password");
  });
});
