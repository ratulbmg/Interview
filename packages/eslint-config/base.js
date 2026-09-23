const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettierConfig = require("eslint-config-prettier");
const globals = require("globals");

/**
 * Shared flat-config base for every non-React workspace (apps/api,
 * apps/email-worker, packages/db, packages/email, packages/enums,
 * packages/shared-schemas). React workspaces extend this further — see
 * react-internal.js (packages/ui, apps/dashboard).
 */
module.exports = [
  {
    ignores: [
      "dist/**",
      "build/**",
      ".turbo/**",
      "node_modules/**",
      "coverage/**",
      "**/*.config.js",
      "generated/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2020,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Base ESLint's no-undef loses track of `React` when it's referenced
      // only in type position — tsc's own type-checking (already run as
      // part of `yarn build`) already catches real undefined identifiers.
      // https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-missing-globals
      "no-undef": "off",
      "no-redeclare": "off",
      "no-debugger": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "object-shorthand": "error",
      "no-duplicate-imports": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-empty-function": "warn",
    },
  },
  prettierConfig,
];
