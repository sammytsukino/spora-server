jest.mock("../models/Flora");

const request = require("supertest");
const app = require("../app");
const Flora = require("../models/Flora");

describe("POST /api/reader/tts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when floraId is missing", async () => {
    const res = await request(app).post("/api/reader/tts").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing flora id/i);
  });

  it("returns 404 when flora is not found", async () => {
    Flora.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .post("/api/reader/tts")
      .send({ floraId: "507f1f77bcf86cd799439099" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/flora not found/i);
  });

  it("returns 400 when flora has no readable text", async () => {
    Flora.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439099", title: "", text: "" }),
    });

    const res = await request(app)
      .post("/api/reader/tts")
      .send({ floraId: "507f1f77bcf86cd799439099" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no text to read/i);
  });

  it("returns 502 when the voice engine is unavailable in the test runtime", async () => {
    Flora.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439099",
        title: "Bloom",
        text: "Petals unfold in silence.",
      }),
    });

    const res = await request(app)
      .post("/api/reader/tts")
      .send({ floraId: "507f1f77bcf86cd799439099", speed: 0.9 });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/voice generation failed/i);
  });
});
