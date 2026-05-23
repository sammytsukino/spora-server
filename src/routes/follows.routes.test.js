jest.mock("../models/User");
jest.mock("../models/Follow");

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Follow = require("../models/Follow");
const {
  DEFAULT_USER_ID,
  OTHER_USER_ID,
  cultivatorToken,
  activeUserDoc,
} = require("../test-utils/authFixtures");

describe("Follow routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(activeUserDoc());
  });

  describe("POST /api/follows/:userId", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).post(`/api/follows/${OTHER_USER_ID}`);
      expect(res.status).toBe(401);
    });

    it("returns 400 when following yourself", async () => {
      const res = await request(app)
        .post(`/api/follows/${DEFAULT_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot follow yourself/i);
    });

    it("returns 404 when target user is missing or inactive", async () => {
      User.findById
        .mockResolvedValueOnce(activeUserDoc())
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/follows/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    it("returns 400 when already following", async () => {
      User.findById
        .mockResolvedValueOnce(activeUserDoc())
        .mockResolvedValueOnce(activeUserDoc(OTHER_USER_ID));
      Follow.findOne.mockResolvedValue({ _id: "f1" });

      const res = await request(app)
        .post(`/api/follows/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already following/i);
    });

    it("creates follow relationship and increments counters", async () => {
      User.findById
        .mockResolvedValueOnce(activeUserDoc())
        .mockResolvedValueOnce(activeUserDoc(OTHER_USER_ID));
      Follow.findOne.mockResolvedValue(null);
      Follow.create.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});

      const res = await request(app)
        .post(`/api/follows/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(Follow.create).toHaveBeenCalledWith({
        followerId: DEFAULT_USER_ID,
        followingId: OTHER_USER_ID,
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("DELETE /api/follows/:userId", () => {
    it("returns 404 when not following", async () => {
      Follow.findOneAndDelete.mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/follows/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not following/i);
    });

    it("removes follow relationship and decrements counters", async () => {
      Follow.findOneAndDelete.mockResolvedValue({ _id: "f1" });
      User.findByIdAndUpdate.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/follows/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(204);
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("GET /api/follows/me/following", () => {
    it("returns following ids for authenticated user", async () => {
      Follow.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ followingId: OTHER_USER_ID }]),
        }),
      });

      const res = await request(app)
        .get("/api/follows/me/following")
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.followingIds).toEqual([OTHER_USER_ID]);
    });
  });

  describe("GET /api/follows/:userId/status", () => {
    it("returns following status", async () => {
      Follow.exists.mockResolvedValue({ _id: "f1" });

      const res = await request(app)
        .get(`/api/follows/${OTHER_USER_ID}/status`)
        .set("Authorization", `Bearer ${cultivatorToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ following: true });
    });
  });
});
