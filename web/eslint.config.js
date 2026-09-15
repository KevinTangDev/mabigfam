import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      // .vite() (rather than .recommended()) allows the constant-export and
      // compound-component patterns this app's own components use — plain
      // hooks/context exports alongside a component in the same file.
      reactRefresh.configs.vite(),
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

      // AuthContext.tsx and ThemeProvider.tsx each export a hook (useAuth,
      // useTheme) alongside their Provider component — the standard React
      // context+hook pairing. .vite()'s defaults don't cover that shape.
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowCompoundComponents: true, allowExportNames: ["useAuth", "useTheme"] },
      ],

      /*
       * eslint-plugin-react-hooks 6/7 folded in the React Compiler's static
       * analysis rules under "recommended", which are considerably stricter
       * than the classic rules-of-hooks + exhaustive-deps this app was
       * written against. Two of them actively conflict with patterns used
       * deliberately throughout this codebase, not accidentally:
       *
       * - set-state-in-effect flags the ordinary "fetch on mount" pattern
       *   (`useEffect(() => { load() }, [...])` calling a setState-based
       *   loader) used in every list/detail page. Adopting the Compiler's
       *   preferred alternative (a data-fetching library, or Suspense) is a
       *   real, separate refactor — not something to force silently as a
       *   side effect of turning lint on.
       * - purity flags `Date.now()` inside a useMemo (CalendarView's
       *   upcoming/past split). Correct per the Compiler's idempotency
       *   rule, but low-value here: the memo isn't relied on to be
       *   stable across time, only across re-renders with the same data.
       *
       * Worth revisiting together if this app is ever migrated toward the
       * React Compiler; until then these would just be noise.
       */
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
);
