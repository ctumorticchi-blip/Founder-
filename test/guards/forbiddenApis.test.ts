import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou explicite (au-delà de la config ESLint) : le moteur doit rester
 * déterministe. Aucune source d'aléatoire ou d'horloge système ne doit
 * s'y glisser — voir docs/ARCHITECTURE.md §5. Les commentaires/JSDoc qui
 * MENTIONNENT ces API en prose (pour expliquer l'interdiction) ne doivent
 * pas faire échouer ce test : on ne scanne que le code après avoir retiré
 * les commentaires.
 */

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(CURRENT_DIR, "..", "..", "src");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: "Math.random(", pattern: /Math\.random\s*\(/ },
  { label: "new Date(", pattern: /\bnew Date\s*\(/ },
  { label: "Date.now(", pattern: /Date\.now\s*\(/ },
];

describe("aucune source d'aléatoire ou d'horloge système hors du moteur seedé", () => {
  const files = listTsFiles(SRC_ROOT);

  it("trouve bien des fichiers source à analyser (le test n'est pas vide)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const relativePath = file.slice(SRC_ROOT.length + 1);
    it(`${relativePath} n'utilise ni Math.random ni Date`, () => {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        expect(pattern.test(code), `${relativePath} utilise ${label}, interdit dans le moteur.`).toBe(false);
      }
    });
  }
});
