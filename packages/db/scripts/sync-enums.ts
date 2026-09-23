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
 * Changing a value here still requires a real migration afterwards — this
 * script only edits the schema file, it does not touch the database.
 */
import fs from "node:fs";
import path from "node:path";
import { InterviewSessionStatus, QuestionDifficulty } from "@repo/enums";

const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

// Every @repo/enums export that has a matching `enum` block in
// schema.prisma. Adding a new shared enum? Add it to
// @repo/enums/src/index.ts, add its `enum Name { ... }` block to
// schema.prisma once (with whatever doc comment you want), list it here,
// then this script keeps its members in sync.
const SYNCED_ENUMS: Record<string, Record<string, string>> = {
  InterviewSessionStatus,
  QuestionDifficulty,
};

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
    console.log("sync-enums: schema.prisma already matches @repo/enums.");
  }
}

syncSchema();
