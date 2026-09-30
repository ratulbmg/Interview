import { readFileSync } from "fs";
import path from "path";
import { apiError } from "../utils/apiError";
import { ParsedCostFile } from "./usageTypes";

// Fixed, hardcoded location — never derived from request input (see
// usageController.ts, which takes no parameters at all). `process.cwd()`
// is the apps/api workspace root, same assumption uploadMiddleware.ts's
// UPLOAD_DIR already relies on; apps/engine is its sibling under apps/.
const COST_FILE_PATH = path.resolve(process.cwd(), "../engine/cost.txt");

const SECTION_PATTERN = /^\[(.+)\]$/;
const KEY_VALUE_PATTERN = /^([^=]+)=(.*)$/;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

function coerceValue(raw: string): string | number {
  const trimmed = raw.trim();
  return NUMERIC_PATTERN.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * Parses the dummy INI-style cost.txt format: `[section]` headers,
 * `key=value` pairs, blank lines and `#` comments ignored. A numeric-
 * looking value becomes a number; everything else stays a string. Any
 * other line — a `key=value` before the first section, or a line that's
 * neither form — means the file is malformed.
 */
export function parseCostFile(contents: string): ParsedCostFile {
  const sections: ParsedCostFile = {};
  let currentSection: string | null = null;

  contents.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return;
    }

    const sectionMatch = trimmed.match(SECTION_PATTERN);
    if (sectionMatch) {
      const section = sectionMatch[1]!.trim();
      currentSection = section;
      sections[section] ??= {};
      return;
    }

    const kvMatch = trimmed.match(KEY_VALUE_PATTERN);
    if (kvMatch && currentSection) {
      const key = kvMatch[1]!.trim();
      const value = kvMatch[2]!;
      sections[currentSection]![key] = coerceValue(value);
      return;
    }

    throw new apiError(
      "Cost data file is malformed",
      500,
      `Unexpected content on line ${index + 1}`,
    );
  });

  return sections;
}

/**
 * Reads and parses the temporary dummy cost file. This is the one
 * function a future DatabaseUsageDataSource replaces — see
 * usageService.ts's doc comment for how that swap stays isolated from
 * the controller and the Dashboard.
 */
export function readCostFile(): ParsedCostFile {
  let contents: string;
  try {
    contents = readFileSync(COST_FILE_PATH, "utf-8");
  } catch (error) {
    console.error("Failed to read the usage cost file:", error);
    throw new apiError("Cost data file not found", 404);
  }

  return parseCostFile(contents);
}
