jest.mock("../models/User");
jest.mock("../models/Follow");

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Follow = require("../models/Follow");
const { OTHER_USER_ID } = require("../test-utils/authFixtures");

describe("User routes", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/users/by-username/:username", () => {
    it("returns 404 for empty username", async () => {
      const res = await request(app).get("/api/users/by-username/%20");
      expect(res.status).toBe(404);
    });

    it("returns 404 when user not found", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const res = await request(app).get("/api/users/by-username/nobody");
      expect(res.status).toBe(404);
    });

    it("returns public profile by username", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: OTHER_USER_ID,
            username: "cultivator",
            displayName: "Cultivator",
            avatar: null,
            bio: "Hello",
            followersCount: 2,
            followingCount: 1,
            stats: { florasCreated: 3 },
          }),
        }),
      });

      const res = await request(app).get("/api/users/by-username/@cultivator");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        username: "cultivator",
        displayName: "Cultivator",
        followersCount: 2,
      });
    });
  });

  describe("GET /api/users/:id/followers", () => {
    it("returns follower list", async () => {
      Follow.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    followerId: {
                      _id: OTHER_USER_ID,
                      username: "fan",
                      displayName: "Fan",
                      avatar: null,
                    },
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const res = await request(app).get(`/api/users/${OTHER_USER_ID}/followers`);
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ username: "fan" });
    });
  });

  describe("GET /api/users/:id/following", () => {
    it("returns following list", async () => {
      Follow.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    followingId: {
                      _id: OTHER_USER_ID,
                      username: "star",
                      displayName: "Star",
                      avatar: null,
                    },
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const res = await request(app).get(`/api/users/${OTHER_USER_ID}/following`);
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ username: "star" });
    });
  });
});
