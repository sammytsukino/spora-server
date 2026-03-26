jest.mock("../models/Flora");
jest.mock("../models/Follow");

const request = require("supertest");
const app = require("../app");
const Flora = require("../models/Flora");

describe("GET /api/floras", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Flora.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  it("returns 200 with array", async () => {
    const res = await request(app).get("/api/floras");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 401 for followingOnly without auth", async () => {
    const res = await request(app).get("/api/floras?followingOnly=true");
    expect(res.status).toBe(401);
  });
});
