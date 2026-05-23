jest.mock("../models/User");
jest.mock("../models/Report");
jest.mock("../services/emailService", () => ({
  sendAdminNewReportEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Report = require("../models/Report");
const { sendAdminNewReportEmail } = require("../services/emailService");
const {
  DEFAULT_USER_ID,
  cultivatorToken,
  activeUserDoc,
} = require("../test-utils/authFixtures");

function mockAuthUserFindById(user = activeUserDoc()) {
  User.findById.mockImplementation(() => {
    const chain = {
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ username: user.username }),
      }),
      then(onFulfilled, onRejected) {
        return Promise.resolve(user).then(onFulfilled, onRejected);
      },
    };
    return chain;
  });
}

const FLORA_ID = "507f1f77bcf86cd799439099";
const REPORT_ID = "507f1f77bcf86cd799439088";

describe("POST /api/reports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUserFindById();
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/reports").send({});
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ reason: "spam" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing fields/i);
  });

  it("creates report and notifies admins", async () => {
    mockAuthUserFindById();
    Report.create.mockResolvedValue({
      _id: REPORT_ID,
      reportedFloraId: FLORA_ID,
      category: "spam",
      reason: "Automated",
    });
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ email: "admin@spora.dev" }]),
      }),
    });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({
        reportedFloraId: FLORA_ID,
        category: "spam",
        reason: "Automated",
        description: "Looks spammy",
      });

    expect(res.status).toBe(201);
    expect(sendAdminNewReportEmail).toHaveBeenCalled();
  });
});
