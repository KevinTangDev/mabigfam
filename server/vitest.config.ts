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
      // Guaranteed not to exist, so the SPA-serving branch in app.ts never
      // activates here regardless of whether web/dist happens to be built —
      // the 404 tests assume the plain JSON not-found handler.
      WEB_DIST_DIR: "/nonexistent-in-tests",
    },
    // The integration tests share one SQLite file, so they must not race.
    fileParallelism: false,
  },
});
