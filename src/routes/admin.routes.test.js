jest.mock("../models/User");
jest.mock("../models/Flora");
jest.mock("../models/Report");
jest.mock("../models/AdminLog");

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Flora = require("../models/Flora");
const Report = require("../models/Report");
const AdminLog = require("../models/AdminLog");
const {
  DEFAULT_USER_ID,
  OTHER_USER_ID,
  adminToken,
  cultivatorToken,
  activeUserDoc,
} = require("../test-utils/authFixtures");

describe("Admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AdminLog.create.mockResolvedValue({});
  });

  it("returns 403 for non-admin users", async () => {
    User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "cultivator"));

    const res = await request(app)
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${cultivatorToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });

  describe("GET /api/admin/metrics", () => {
    beforeEach(() => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      User.countDocuments.mockResolvedValue(10);
      Flora.countDocuments.mockResolvedValue(5);
      Report.countDocuments.mockResolvedValue(2);
      Report.distinct.mockResolvedValue(["f1", "f2"]);
    });

    it("returns aggregated platform metrics", async () => {
      const res = await request(app)
        .get("/api/admin/metrics")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        users: { total: 10, active: 10 },
        floras: {
          total: 5,
          blossoming: 5,
          sealed: 5,
          hidden: 5,
        },
        reports: { total: 2, pending: 2 },
        flaggedContent: 2,
      });
    });
  });

  describe("GET /api/admin/users", () => {
    it("returns users with flora counts", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      User.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  { _id: OTHER_USER_ID, username: "cultivator", role: "cultivator" },
                ]),
              }),
            }),
          }),
        }),
      });
      Flora.countDocuments.mockResolvedValue(3);

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        expect.objectContaining({ username: "cultivator", florasCount: 3 }),
      ]);
    });
  });

  describe("PATCH /api/admin/users/:id/role", () => {
    it("returns 400 when role is missing", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));

      const res = await request(app)
        .patch(`/api/admin/users/${OTHER_USER_ID}/role`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ reason: "Promotion" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing role/i);
    });

    it("updates user role and logs admin action", async () => {
      const targetUser = activeUserDoc(OTHER_USER_ID, "cultivator");
      User.findById
        .mockResolvedValueOnce(activeUserDoc(DEFAULT_USER_ID, "admin"))
        .mockResolvedValueOnce(targetUser);

      const res = await request(app)
        .patch(`/api/admin/users/${OTHER_USER_ID}/role`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ role: "admin", reason: "Promotion" });

      expect(res.status).toBe(200);
      expect(targetUser.save).toHaveBeenCalled();
      expect(AdminLog.create).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/reports/signal", () => {
    it("returns pending report signal", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Report.countDocuments.mockResolvedValue(4);
      Report.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ createdAt: "2026-01-01T00:00:00.000Z" }),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/reports/signal")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        pendingCount: 4,
        latestPendingAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("PATCH /api/admin/reports/:id", () => {
    it("returns 400 for invalid report id", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));

      const res = await request(app)
        .patch("/api/admin/reports/not-an-object-id")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: "resolved" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid report id/i);
    });

    it("updates report when id is valid", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const reportId = "507f1f77bcf86cd799439088";
      const updatedReport = {
        _id: reportId,
        reason: "spam",
        category: "spam",
        toObject: () => ({ _id: reportId, reason: "spam", category: "spam" }),
      };
      Report.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(updatedReport),
          }),
        }),
      });

      const res = await request(app)
        .patch(`/api/admin/reports/${reportId}`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: "resolved", action: "none" });

      expect(res.status).toBe(200);
      expect(AdminLog.create).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/usage", () => {
    it("returns usage aggregates", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Flora.aggregate.mockResolvedValue([{ _id: "2026-01-01", count: 2 }]);
      User.aggregate.mockResolvedValue([{ _id: "2026-01", count: 1 }]);

      const res = await request(app)
        .get("/api/admin/usage")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("florasByDay");
      expect(res.body).toHaveProperty("newUsersByWeek");
    });
  });

  describe("GET /api/admin/usage/charts", () => {
    it("returns chart series", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Flora.countDocuments.mockResolvedValue(1);
      User.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/admin/usage/charts")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.florasByDay)).toBe(true);
      expect(Array.isArray(res.body.newUsersByWeek)).toBe(true);
    });
  });

  describe("PATCH /api/admin/users/:id/status", () => {
    it("updates account status", async () => {
      const targetUser = activeUserDoc(OTHER_USER_ID, "cultivator");
      User.findById
        .mockResolvedValueOnce(activeUserDoc(DEFAULT_USER_ID, "admin"))
        .mockResolvedValueOnce(targetUser);

      const res = await request(app)
        .patch(`/api/admin/users/${OTHER_USER_ID}/status`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: "suspended", reason: "TOS" });

      expect(res.status).toBe(200);
      expect(targetUser.save).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/admin/users/:id", () => {
    it("soft deletes user and anonymizes floras", async () => {
      const targetUser = activeUserDoc(OTHER_USER_ID, "cultivator");
      User.findById
        .mockResolvedValueOnce(activeUserDoc(DEFAULT_USER_ID, "admin"))
        .mockResolvedValueOnce(targetUser);
      Flora.updateMany.mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/admin/users/${OTHER_USER_ID}`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ reason: "GDPR" });

      expect(res.status).toBe(204);
      expect(Flora.updateMany).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/reports", () => {
    it("lists reports", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Report.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  skip: jest.fn().mockResolvedValue([
                    {
                      _id: "r1",
                      reason: "spam",
                      category: "spam",
                      toObject: () => ({ _id: "r1", reason: "spam", category: "spam" }),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/reports")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/admin/flagged", () => {
    it("returns flagged floras with report counts", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Report.distinct.mockResolvedValue([OTHER_USER_ID]);
      Flora.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  { _id: OTHER_USER_ID, title: "Flagged", authorId: { username: "u" } },
                ]),
              }),
            }),
          }),
        }),
      });
      Report.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .get("/api/admin/flagged")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ reportCount: 2 });
    });
  });

  describe("GET /api/admin/floras", () => {
    it("lists floras for admin review", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      Flora.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    _id: OTHER_USER_ID,
                    title: "Admin Flora",
                    authorId: { username: "cultivator" },
                    isAuthorAnonymized: false,
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/floras")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body[0].authorUsername).toMatch(/@?cultivator/);
    });
  });

  describe("PATCH /api/admin/floras/:id/status", () => {
    it("updates flora moderation status", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const flora = {
        _id: OTHER_USER_ID,
        title: "Hidden bloom",
        save: jest.fn().mockResolvedValue(undefined),
      };
      Flora.findById.mockResolvedValue(flora);

      const res = await request(app)
        .patch(`/api/admin/floras/${OTHER_USER_ID}/status`)
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ isHidden: true, reason: "Policy" });

      expect(res.status).toBe(200);
      expect(flora.save).toHaveBeenCalled();
    });
  });

  describe("PATCH /api/admin/floras/batch", () => {
    it("returns 400 when ids missing", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const res = await request(app)
        .patch("/api/admin/floras/batch")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ action: "hide" });
      expect(res.status).toBe(400);
    });

    it("hides floras in batch", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const flora = {
        _id: OTHER_USER_ID,
        title: "Batch",
        isDeleted: false,
        save: jest.fn().mockResolvedValue(undefined),
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      Flora.findById.mockResolvedValue(flora);

      const res = await request(app)
        .patch("/api/admin/floras/batch")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ids: [OTHER_USER_ID], action: "hide" });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);
    });
  });

  describe("PATCH /api/admin/reports/batch", () => {
    it("dismisses reports in batch", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const reportId = "507f1f77bcf86cd799439088";
      Report.findByIdAndUpdate.mockResolvedValue({
        _id: reportId,
        reason: "spam",
        category: "spam",
      });

      const res = await request(app)
        .patch("/api/admin/reports/batch")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ids: [reportId], action: "dismiss" });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);
    });
  });

  describe("PATCH /api/admin/users/batch", () => {
    it("suspends users in batch", async () => {
      User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
      const targetUser = activeUserDoc(OTHER_USER_ID, "cultivator");
      User.findById.mockImplementation((id) => {
        if (String(id) === String(DEFAULT_USER_ID)) {
          return Promise.resolve(activeUserDoc(DEFAULT_USER_ID, "admin"));
        }
        return Promise.resolve(targetUser);
      });

      const res = await request(app)
        .patch("/api/admin/users/batch")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ids: [OTHER_USER_ID], action: "suspend" });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);
      expect(targetUser.save).toHaveBeenCalled();
    });
  });
});
