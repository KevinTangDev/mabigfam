import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/globalSetup.ts"],
    env: {
      // config.ts fails closed without these, by design.
      FAMILY_PASSWORD: "test-password",
      SESSION_SECRET: "test-session-secret-at-least-32-chars-long",
      CALENDAR_FEED_TOKEN: "test-calendar-token",
    },
    // The integration tests share one SQLite file, so they must not race.
    fileParallelism: false,
  },
});
