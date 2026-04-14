/**
 * Tests target `src/app.js` (modular Express app).
 * Production `npm start` runs root `index.js`, which duplicates some routes with
 * different behavior (e.g. signup edge cases). See route tests here as the
 * contract for the modular API only.
 *
 * @type {import("jest").Config}
 */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.js"],
  clearMocks: true,
  resetMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/app.js",
    "src/lib/parseCorsOrigin.js",
    "src/lib/trustProxy.js",
    "src/middleware/**/*.js",
    "src/routes/**/*.js",
    "!src/**/*.test.js",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 75,
      lines: 80,
    },
  },
  coveragePathIgnorePatterns: ["/node_modules/", "<rootDir>/index.js"],
};
