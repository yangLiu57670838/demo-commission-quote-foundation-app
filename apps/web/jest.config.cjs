/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          isolatedModules: true,
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
          types: ["jest", "node", "@testing-library/jest-dom"],
        },
      },
    ],
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  transformIgnorePatterns: ["node_modules/(?!@commission-quote/contracts)"],
};
