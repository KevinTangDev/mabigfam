import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    /*
     * Insurance against the bug that blanked the Tree view: react-family-tree
     * and react-router declare open-ended peers (react >=16), so a second,
     * newer React can get hoisted alongside the pinned one. When that
     * happens react-family-tree builds elements with a different React than
     * the app renders with, React throws, and the app unmounts.
     *
     * `dedupe` keeps every importer on one copy. The root package.json also
     * pins react/react-dom via `overrides`, and test/singleReact.test.ts
     * fails loudly if a duplicate ever reappears.
     */
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Pure logic tests run in node; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
});
