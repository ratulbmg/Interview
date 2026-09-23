const baseConfig = require("./base");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");

// This package's CJS build puts its real content under `.default` (a common
// ESM-transpiled-package quirk) — requiring it directly gives an object with
// an empty `.rules`, which ESLint silently accepts and then can't find the
// rule by name at config-validation time.
const reactRefreshModule = require("eslint-plugin-react-refresh");
const reactRefresh = reactRefreshModule.default ?? reactRefreshModule;

/**
 * For React workspaces — packages/ui (a component library) and
 * apps/dashboard (a Vite SPA).
 *
 * Named export (not default) so both packages/ui/eslint.config.mjs and
 * apps/dashboard/eslint.config.js can import it the same way:
 *   import { config } from "@repo/eslint-config/react-internal";
 */
const config = [
  ...baseConfig,
  {
    // Not scoped to .jsx/.tsx only — plain .ts files (hooks, utils) use
    // browser globals just as often as component files do, and the
    // react-hooks/react-refresh rules are harmless no-ops on files that
    // don't match their patterns.
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];

module.exports = { config };
