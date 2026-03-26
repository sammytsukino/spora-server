const { notFound, errorHandler } = require("./error");

describe("error middleware", () => {
  it("notFound sends 404 json", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    notFound({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("errorHandler uses err.status and message", () => {
    const err = Object.assign(new Error("bad"), { status: 418 });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: "bad" });
  });

  it("errorHandler defaults status 500", () => {
    const err = new Error("fail");
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
