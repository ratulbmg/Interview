const baseConfig = require("@repo/eslint-config/base");
const {
  config: reactInternalConfig,
} = require("@repo/eslint-config/react-internal");

/**
 * Root-level config, used only by tooling that runs `eslint` from the repo
 * root instead of from inside a workspace — currently just lint-staged
 * (husky's pre-commit hook runs bare `eslint <file>` at the root, and ESLint
 * 9+ flat config refuses to run at all without a config file at its cwd,
 * regardless of any config files that exist in subdirectories).
 *
 * `turbo run lint` (i.e. `yarn lint:check`, and each workspace's own IDE
 * linting) still uses each workspace's own eslint.config.js directly — flat
 * config doesn't cascade/merge across directories the way .eslintrc used to,
 * so this file has to recompose the same building blocks itself rather than
 * relying on the per-workspace files.
 *
 * `baseConfig` (apps/api, apps/email-worker, packages/db, packages/enums,
 * packages/email, packages/shared-schemas' entire config) is shared by
 * reactInternalConfig too, so it's applied once, globally, instead of
 * twice. Only the extra layers specific to non-Node React (apps/dashboard,
 * packages/ui) are scoped to those directories, so their plugin rules don't
 * apply to workspaces that don't use them.
 */
const reactInternalOnlyLayers = reactInternalConfig
  .slice(baseConfig.length)
  .map((layer) => ({
    ...layer,
    files: [
      "apps/dashboard/**/*.{js,jsx,ts,tsx}",
      "packages/ui/**/*.{js,jsx,ts,tsx}",
    ],
  }));

module.exports = [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/generated/**",
      "apps/interview-agent/**",
      // Pure CJS tooling, consumed via require() by every workspace's own
      // eslint.config.js — it has no lint script of its own and isn't part
      // of `turbo run lint` either, so `no-require-imports` (which assumes
      // ESM) has no business flagging it.
      "packages/eslint-config/**",
    ],
  },
  ...baseConfig,
  ...reactInternalOnlyLayers,
];
