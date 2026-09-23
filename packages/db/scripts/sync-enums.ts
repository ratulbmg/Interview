/**
 * Regenerates the `enum` blocks in prisma/schema.prisma from @repo/enums.
 *
 * schema.prisma is parsed by Prisma's own Rust/WASM engine, completely outside
 * Node's module system — it has no way to `import` a value from a TypeScript
 * package. This script is the practical substitute: @repo/enums stays the one
 * place a human edits enum values, and this rewrites schema.prisma's matching
 * `enum Name { ... }` blocks to agree with it, leaving everything else in the
 * file untouched.
 *
 * Run via `yarn sync-enums`, and automatically before `db-generate` /
 * `db-migrate` (see package.json) so schema.prisma can never drift silently.
 *
 * SYNCED_ENUMS is empty until Phase 1 adds real enums to @repo/enums and
 * their matching `enum Name { ... }` blocks to schema.prisma — see the
 * build plan in README.md.
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

const SYNCED_ENUMS: Record<string, Record<string, string>> = {};

function buildEnumBlock(name: string, values: Record<string, string>): string {
  const members = Object.values(values)
    .map((value) => `  ${value}`)
    .join("\n");
  return `enum ${name} {\n${members}\n}`;
}

function syncSchema(): void {
  let schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  let changed = false;

  for (const [name, values] of Object.entries(SYNCED_ENUMS)) {
    const blockRegex = new RegExp(`enum ${name}\\b\\s*\\{[^}]*\\}`, "m");
    const match = schema.match(blockRegex);

    if (!match) {
      throw new Error(
        `sync-enums: could not find "enum ${name} { ... }" in schema.prisma. ` +
          `Add the enum block by hand once, then re-run this script.`,
      );
    }

    const newBlock = buildEnumBlock(name, values);
    if (match[0] !== newBlock) {
      schema = schema.replace(blockRegex, newBlock);
      changed = true;
      console.log(`sync-enums: updated "enum ${name}" to match @repo/enums.`);
    }
  }

  if (changed) {
    fs.writeFileSync(SCHEMA_PATH, schema);
    console.log("sync-enums: schema.prisma written.");
  } else {
    console.log("sync-enums: nothing to sync yet.");
  }
}

syncSchema();
