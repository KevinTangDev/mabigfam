import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the dependency invariant that broke the Tree view.
 *
 * react-family-tree and react-router declare open-ended peers (react >=16),
 * so npm is free to satisfy them with a newer hoisted copy than the pinned
 * one. When that happens react-family-tree creates elements with React X
 * while the app renders with React Y, React throws "A React Element from an
 * older version of React was rendered", and the whole app unmounts — a blank
 * page with no hint as to why.
 *
 * Root package.json pins both via `overrides`; these tests fail loudly if
 * that protection ever stops working.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Finds every installed copy of `pkg`, walking only node_modules trees. */
function findInstalledCopies(pkg: string): { dir: string; version: string }[] {
  const found: { dir: string; version: string }[] = [];

  function scanModulesDir(modulesDir: string, depth: number) {
    if (depth > 6 || !fs.existsSync(modulesDir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Scoped packages (@scope/name) nest one level deeper.
      const names = entry.name.startsWith("@")
        ? fs
            .readdirSync(path.join(modulesDir, entry.name), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(entry.name, e.name))
        : [entry.name];

      for (const name of names) {
        const packageDir = path.join(modulesDir, name);

        if (name === pkg) {
          const manifest = path.join(packageDir, "package.json");
          if (fs.existsSync(manifest)) {
            const { version } = JSON.parse(fs.readFileSync(manifest, "utf8"));
            found.push({ dir: path.relative(repoRoot, packageDir), version });
          }
        }

        scanModulesDir(path.join(packageDir, "node_modules"), depth + 1);
      }
    }
  }

  scanModulesDir(path.join(repoRoot, "node_modules"), 0);
  for (const workspace of ["web", "server"]) {
    scanModulesDir(path.join(repoRoot, workspace, "node_modules"), 0);
  }

  return found;
}

describe("single React copy", () => {
  it("has exactly one react installed", () => {
    const copies = findInstalledCopies("react");
    const describeCopies = copies.map((c) => `${c.version} at ${c.dir}`).join("; ");

    expect(copies.length, `expected one react, found: ${describeCopies}`).toBe(1);
  });

  it("has exactly one react-dom installed", () => {
    const copies = findInstalledCopies("react-dom");
    const describeCopies = copies.map((c) => `${c.version} at ${c.dir}`).join("; ");

    expect(copies.length, `expected one react-dom, found: ${describeCopies}`).toBe(1);
  });

  it("keeps react and react-dom on matching versions", () => {
    const [react] = findInstalledCopies("react");
    const [reactDom] = findInstalledCopies("react-dom");

    expect(react?.version).toBe(reactDom?.version);
  });

  it("pins react and react-dom in the root overrides", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

    expect(pkg.overrides?.react, "root package.json must pin react").toBeDefined();
    expect(pkg.overrides?.["react-dom"], "root package.json must pin react-dom").toBeDefined();
  });
});
