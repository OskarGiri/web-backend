module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["**/tests/**/*.test.(js|ts)"],
};
