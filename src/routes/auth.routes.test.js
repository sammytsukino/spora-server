jest.mock("../models/User");
jest.mock("../services/emailService", () => ({
  generateVerificationToken: jest.fn(() => "verify-token-abc"),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const bcrypt = require("bcryptjs");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");

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
      refreshToken: expect.any(String),
      user: {
        id: expect.anything(),
        username: "u",
        email: "u@e.com",
        role: "cultivator",
      },
    });
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
