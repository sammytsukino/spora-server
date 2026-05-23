jest.mock("../models/User");
jest.mock("../services/emailService", () => ({
  sendAdminContactEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { sendAdminContactEmail } = require("../services/emailService");

describe("POST /api/contact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/contact").send({ name: "Ada" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
    expect(sendAdminContactEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when subject exceeds max length", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Ada",
      email: "ada@example.com",
      subject: "x".repeat(161),
      message: "Hello",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject is too long/i);
  });

  it("returns 503 when no active admin recipients exist", async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app).post("/api/contact").send({
      name: "Ada",
      email: "ada@example.com",
      subject: "Hello",
      message: "I would like to collaborate.",
    });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/no admin recipients/i);
    expect(sendAdminContactEmail).not.toHaveBeenCalled();
  });

  it("sends contact email to active admins and returns ok", async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ email: "admin@spora.dev" }]),
      }),
    });

    const payload = {
      name: "Ada",
      email: "ada@example.com",
      subject: "Collaboration",
      message: "I would like to collaborate.",
    };

    const res = await request(app).post("/api/contact").send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sendAdminContactEmail).toHaveBeenCalledWith({
      recipients: ["admin@spora.dev"],
      ...payload,
    });
  });
});
