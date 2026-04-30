const { hashVerificationToken, findUserForVerificationToken } = require("./verificationToken");

describe("verificationToken", () => {
  it("hashVerificationToken is deterministic hex", () => {
    const tokenHash = hashVerificationToken("abc");
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashVerificationToken("abc")).toBe(tokenHash);
  });

  it("findUserForVerificationToken matches hash first then legacy plain", async () => {
    const hash = hashVerificationToken("secret");
    const User = {
      findOne: jest.fn().mockImplementation((query) => {
        if (query.emailVerificationToken === hash) {
          return Promise.resolve({ id: "1", email: "a@b.com" });
        }
        if (query.emailVerificationToken === "legacy-plain") {
          return Promise.resolve({ id: "2", email: "c@d.com" });
        }
        return Promise.resolve(null);
      }),
    };
    const hashedTokenMatch = await findUserForVerificationToken("secret", User);
    expect(hashedTokenMatch.id).toBe("1");
    User.findOne.mockClear();
    User.findOne.mockImplementation((query) => {
      if (query.emailVerificationToken === hash) return Promise.resolve(null);
      if (query.emailVerificationToken === "legacy-plain") {
        return Promise.resolve({ id: "2" });
      }
      return Promise.resolve(null);
    });
    const legacyTokenMatch = await findUserForVerificationToken("legacy-plain", User);
    expect(legacyTokenMatch.id).toBe("2");
  });
});
