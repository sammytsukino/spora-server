jest.mock("../models/User");

const bcrypt = require("bcryptjs");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const {
  STRONG_FIXTURE,
  TOO_SHORT_FIXTURE,
  SIMPLE_LOGIN_FIXTURE,
  SIMPLE_WRONG_FIXTURE,
} = require("../test-utils/passwordFixtures");

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("returns 400 with WEAK_PASSWORD code when password is too weak", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/signup").send({
      username: "newuser",
      displayName: "New",
      email: "new@example.com",
      password: TOO_SHORT_FIXTURE,
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "WEAK_PASSWORD" });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("creates user and returns a session token without any captcha", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: "n1",
      username: "newuser",
      displayName: "New",
      email: "new@example.com",
      role: "cultivator",
    });

    const res = await request(app).post("/api/auth/signup").send({
      username: "newuser",
      displayName: "New",
      email: "new@example.com",
      password: STRONG_FIXTURE,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      token: expect.any(String),
      user: { username: "newuser", role: "cultivator" },
    });
    expect(res.body).not.toHaveProperty("password");
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/spora_refresh=/)])
    );
  });

  it("returns 409 when user exists", async () => {
    User.findOne.mockResolvedValue({ _id: "x", username: "x" });

    const res = await request(app).post("/api/auth/signup").send({
      username: "x",
      displayName: "X",
      email: "x@e.com",
      password: STRONG_FIXTURE,
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for bad password", async () => {
    const hash = await bcrypt.hash(SIMPLE_LOGIN_FIXTURE, 4);
    User.findOne.mockResolvedValue({
      username: "u",
      password: hash,
      accountStatus: "active",
      role: "cultivator",
      save: jest.fn().mockResolvedValue(),
    });

    const res = await request(app).post("/api/auth/signin").send({
      username: "u",
      password: SIMPLE_WRONG_FIXTURE,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("signs in regardless of legacy emailVerified flag", async () => {
    const hash = await bcrypt.hash(SIMPLE_LOGIN_FIXTURE, 4);
    User.findOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      username: "u",
      password: hash,
      accountStatus: "active",
      emailVerified: false,
      role: "cultivator",
      displayName: "U",
      avatar: null,
      email: "u@e.com",
      save: jest.fn().mockResolvedValue(),
    });

    const res = await request(app).post("/api/auth/signin").send({
      username: "u",
      password: SIMPLE_LOGIN_FIXTURE,
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
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/spora_refresh=/)])
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

describe("POST /api/auth/signin validation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/auth/signin").send({ username: "u" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/signup honeypot", () => {
  it("returns fake success for bot website field", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "bot",
      email: "bot@e.com",
      password: "Password123!",
      website: "http://spam.com",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBe("fake-bot-token");
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/refresh", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when refresh token missing", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not-a-valid-token" });
    expect(res.status).toBe(401);
  });

  it("issues new access token for valid refresh token", async () => {
    User.findById.mockResolvedValue({
      _id: userId,
      username: "u",
      displayName: "U",
      avatar: null,
      email: "u@e.com",
      role: "cultivator",
      accountStatus: "active",
    });
    const refreshToken = jwt.sign(
      { sub: userId, role: "cultivator", type: "refresh" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.username).toBe("u");
  });
});

describe("POST /api/auth/logout", () => {
  it("returns ok and clears session cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("PATCH /api/auth/me", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without token", async () => {
    const res = await request(app).patch("/api/auth/me").send({ displayName: "X" });
    expect(res.status).toBe(401);
  });

  it("updates profile for authenticated user", async () => {
    const user = {
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
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(user);

    const token = jwt.sign(
      { sub: userId, role: "cultivator", type: "access" },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "New Me", bio: "Updated bio" });

    expect(res.status).toBe(200);
    expect(user.save).toHaveBeenCalled();
    expect(res.body.displayName).toBe("New Me");
  });
});
