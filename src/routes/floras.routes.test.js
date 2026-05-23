jest.mock("../models/Flora");
jest.mock("../models/Follow");
jest.mock("../models/Report");
jest.mock("../models/User");
jest.mock("../services/languageScreenReport", () => ({
  syncLanguageScreenReport: jest.fn().mockResolvedValue({}),
}));

const request = require("supertest");
const app = require("../app");
const Flora = require("../models/Flora");
const Follow = require("../models/Follow");
const Report = require("../models/Report");
const User = require("../models/User");
const { syncLanguageScreenReport } = require("../services/languageScreenReport");
const {
  DEFAULT_USER_ID,
  OTHER_USER_ID,
  cultivatorToken,
  adminToken,
  activeUserDoc,
} = require("../test-utils/authFixtures");

const FLORA_ID = "507f1f77bcf86cd799439099";

function mockFloraFindChain(result = []) {
  Flora.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(result),
    }),
  });
}

function blossomingFlora(overrides = {}) {
  return {
    _id: FLORA_ID,
    title: "Bloom",
    text: "Petals unfold.",
    authorId: DEFAULT_USER_ID,
    status: "blossoming",
    isHidden: false,
    isDeleted: false,
    lineage: { generation: 0, childrenCount: 0 },
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    toObject() {
      return { ...this, save: undefined, deleteOne: undefined, toObject: undefined };
    },
    ...overrides,
  };
}

describe("GET /api/floras", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFloraFindChain([]);
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

  it("returns empty array when user follows nobody", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    Follow.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get("/api/floras?followingOnly=true")
      .set("Authorization", `Bearer ${cultivatorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filters by followed authors when followingOnly is true", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    Follow.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ followingId: OTHER_USER_ID }]),
      }),
    });
    mockFloraFindChain([{ _id: FLORA_ID, title: "F" }]);

    const res = await request(app)
      .get("/api/floras?followingOnly=true")
      .set("Authorization", `Bearer ${cultivatorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/floras/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when flora does not exist", async () => {
    Flora.findById.mockResolvedValue(null);
    const res = await request(app).get(`/api/floras/${FLORA_ID}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for deleted flora", async () => {
    Flora.findById.mockResolvedValue(blossomingFlora({ isDeleted: true }));
    const res = await request(app).get(`/api/floras/${FLORA_ID}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for hidden flora on public GET", async () => {
    Flora.findById.mockResolvedValue(
      blossomingFlora({ isHidden: true, authorId: DEFAULT_USER_ID })
    );
    const res = await request(app).get(`/api/floras/${FLORA_ID}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/floras/screen-preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(activeUserDoc());
  });

  it("returns 400 when title or text missing", async () => {
    const res = await request(app)
      .post("/api/floras/screen-preview")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ title: "Only title" });

    expect(res.status).toBe(400);
  });

  it("returns screening result for clean text", async () => {
    const res = await request(app)
      .post("/api/floras/screen-preview")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ title: "Hello", text: "World" });

    expect(res.status).toBe(200);
    expect(res.body.contentScreening.flagged).toBe(false);
  });
});

describe("POST /api/floras", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(activeUserDoc());
  });

  it("returns 400 when title or text missing", async () => {
    const res = await request(app)
      .post("/api/floras")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ title: "Only" });

    expect(res.status).toBe(400);
  });

  it("creates flora and syncs language screening", async () => {
    const created = blossomingFlora();
    Flora.create.mockResolvedValue(created);

    const res = await request(app)
      .post("/api/floras")
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({
        title: "New Bloom",
        text: "Fresh petals.",
        status: "blossoming",
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Bloom");
    expect(syncLanguageScreenReport).toHaveBeenCalled();
  });
});

describe("PATCH /api/floras/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when non-owner tries to edit", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    Flora.findById.mockResolvedValue(
      blossomingFlora({ authorId: OTHER_USER_ID })
    );

    const res = await request(app)
      .patch(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("returns 400 when changing text after publish", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    Flora.findById.mockResolvedValue(
      blossomingFlora({ publishedAt: new Date(), text: "Original" })
    );

    const res = await request(app)
      .patch(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ text: "Changed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/immutable/i);
  });

  it("updates flora for owner", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    const flora = blossomingFlora();
    Flora.findById.mockResolvedValue(flora);

    const res = await request(app)
      .patch(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${cultivatorToken()}`)
      .send({ title: "Updated Bloom" });

    expect(res.status).toBe(200);
    expect(flora.save).toHaveBeenCalled();
    expect(syncLanguageScreenReport).toHaveBeenCalled();
  });

  it("allows admin to edit sealed flora", async () => {
    User.findById.mockResolvedValue(activeUserDoc(DEFAULT_USER_ID, "admin"));
    const flora = blossomingFlora({ status: "sealed", authorId: OTHER_USER_ID });
    Flora.findById.mockResolvedValue(flora);

    const res = await request(app)
      .patch(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ title: "Admin edit" });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/floras/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when flora missing", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    Flora.findById.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${cultivatorToken()}`);

    expect(res.status).toBe(404);
  });

  it("deletes blossoming flora for owner", async () => {
    User.findById.mockResolvedValue(activeUserDoc());
    const flora = blossomingFlora();
    Flora.findById.mockResolvedValue(flora);
    Report.deleteMany.mockResolvedValue({});

    const res = await request(app)
      .delete(`/api/floras/${FLORA_ID}`)
      .set("Authorization", `Bearer ${cultivatorToken()}`);

    expect(res.status).toBe(204);
    expect(Report.deleteMany).toHaveBeenCalled();
    expect(flora.deleteOne).toHaveBeenCalled();
  });
});
