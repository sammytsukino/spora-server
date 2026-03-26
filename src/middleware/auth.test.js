jest.mock("../models/User");

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth, optionalAuth, requireRole } = require("./auth");

describe("auth middleware", () => {
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("returns 401 without authorization header", async () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 for refresh token type", async () => {
      const token = jwt.sign(
        { sub: userId, role: "cultivator", type: "refresh" },
        process.env.JWT_SECRET
      );
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next and sets req.user for valid access token", async () => {
      const user = {
        _id: userId,
        accountStatus: "active",
        role: "cultivator",
      };
      User.findById.mockResolvedValue(user);
      const token = jwt.sign(
        { sub: userId, role: "cultivator", type: "access" },
        process.env.JWT_SECRET
      );
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBe(user);
    });
  });

  describe("optionalAuth", () => {
    it("calls next when no bearer token", async () => {
      const req = { headers: {} };
      const res = {};
      const next = jest.fn();
      await optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("calls next when bearer token is invalid", async () => {
      const req = { headers: { authorization: "Bearer not-a-jwt" } };
      const res = {};
      const next = jest.fn();
      await optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe("requireRole", () => {
    it("returns 403 when role missing", () => {
      const req = { user: { role: "cultivator" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireRole("admin")(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next when role matches", () => {
      const req = { user: { role: "admin" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireRole("admin")(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
