/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          esModuleInterop: true,
          isolatedModules: true,
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
        },
      },
    ],
  },
  testMatch: ["**/*.test.ts"],
};
