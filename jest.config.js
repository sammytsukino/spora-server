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
    "src/controllers/**/*.js",
    "src/lib/parseCorsOrigin.js",
    "src/lib/trustProxy.js",
    "src/middleware/**/*.js",
    "src/routes/**/*.js",
    "!src/**/*.test.js",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 60,
      functions: 80,
      lines: 80,
    },
    "src/routes/**/*.js": {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    "src/middleware/**/*.js": {
      statements: 79,
      branches: 70,
      functions: 75,
      lines: 79,
    },
    "src/app.js": {
      statements: 100,
      lines: 100,
    },
    "src/controllers/contactController.js": {
      statements: 90,
      lines: 90,
    },
    "src/controllers/followController.js": {
      statements: 95,
      lines: 95,
    },
    "src/controllers/readerController.js": {
      statements: 60,
      lines: 60,
    },
    "src/controllers/floraController.js": {
      statements: 70,
      lines: 70,
    },
    "src/controllers/adminController.js": {
      statements: 75,
      lines: 75,
    },
    "src/controllers/authController.js": {
      statements: 80,
      lines: 80,
    },
    "src/controllers/reportController.js": {
      statements: 90,
      lines: 90,
    },
    "src/controllers/userController.js": {
      statements: 95,
      lines: 95,
    },
  },
  coveragePathIgnorePatterns: ["/node_modules/", "<rootDir>/index.js"],
};
