const { hashVerificationToken, findUserForVerificationToken } = require("./verificationToken");

describe("verificationToken", () => {
  it("hashVerificationToken is deterministic hex", () => {
    const h = hashVerificationToken("abc");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashVerificationToken("abc")).toBe(h);
  });

  it("findUserForVerificationToken matches hash first then legacy plain", async () => {
    const hash = hashVerificationToken("secret");
    const User = {
      findOne: jest.fn().mockImplementation((q) => {
        if (q.emailVerificationToken === hash) {
          return Promise.resolve({ id: "1", email: "a@b.com" });
        }
        if (q.emailVerificationToken === "legacy-plain") {
          return Promise.resolve({ id: "2", email: "c@d.com" });
        }
        return Promise.resolve(null);
      }),
    };
    const u1 = await findUserForVerificationToken("secret", User);
    expect(u1.id).toBe("1");
    User.findOne.mockClear();
    User.findOne.mockImplementation((q) => {
      if (q.emailVerificationToken === hash) return Promise.resolve(null);
      if (q.emailVerificationToken === "legacy-plain") {
        return Promise.resolve({ id: "2" });
      }
      return Promise.resolve(null);
    });
    const u2 = await findUserForVerificationToken("legacy-plain", User);
    expect(u2.id).toBe("2");
  });
});
