/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    // Run test files serially: they share one Postgres test database and
    // reset it in beforeAll, so parallel workers would race/clobber each other.
    maxWorkers: 1,
    verbose: true,
};
