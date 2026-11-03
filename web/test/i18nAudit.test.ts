import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the translation work: parses every component and page
 * and fails if user-facing English has crept back in as a literal — JSX text,
 * the attributes a person reads or hears (aria-label, title, placeholder, alt),
 * or the messages passed to confirm()/setError(). Everything visible must go
 * through t().
 */

const SRC = path.resolve(import.meta.dirname, "../src");
const SKIP_DIRS = new Set(["i18n"]); // the dictionaries themselves
const SKIP_FILES = new Set(["icons.tsx"]); // SVG path data
const READABLE_ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label", "heading", "emptyText", "subtitle"]);
const MESSAGE_CALLS = new Set(["confirm", "alert", "setError"]);
// The product name is a brand, not a translatable string.
const ALLOWED = new Set(["MaBigFam"]);

const hasWords = (s: string) => /[A-Za-z]{3,}/.test(s) && !ALLOWED.has(s.trim());

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : files(path.join(dir, e.name));
    return /\.tsx$/.test(e.name) && !SKIP_FILES.has(e.name) ? [path.join(dir, e.name)] : [];
  });
}

function findHardcoded(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const where = (n: ts.Node) => `${path.relative(SRC, file)}:${source.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

  const literalText = (n: ts.Node | undefined): string | null => {
    if (!n) return null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
    if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => s.literal.text).join("");
    if (ts.isJsxExpression(n)) return literalText(n.expression);
    return null;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasWords(node.text)) hits.push(`${where(node)}  text: ${node.text.trim()}`);

    if (ts.isJsxAttribute(node) && READABLE_ATTRS.has(node.name.getText())) {
      const text = literalText(node.initializer);
      if (text !== null && hasWords(text)) hits.push(`${where(node)}  ${node.name.getText()}="${text}"`);
    }

    if (ts.isCallExpression(node) && MESSAGE_CALLS.has(node.expression.getText())) {
      for (const arg of node.arguments) {
        const text = literalText(arg);
        if (text !== null && hasWords(text)) hits.push(`${where(node)}  ${node.expression.getText()}("${text}")`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe("i18n source audit", () => {
  it("finds no hardcoded user-facing English in components or pages", () => {
    const hits = files(SRC).flatMap(findHardcoded);
    expect(hits).toEqual([]);
  });

  it("actually scans the app (guards against the audit silently checking nothing)", () => {
    expect(files(SRC).length).toBeGreaterThan(20);
    // Prove the detector works on a known-bad snippet.
    const bad = ts.createSourceFile("x.tsx", `const a = <button title="Save it">Click me</button>;`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const texts: string[] = [];
    const walk = (n: ts.Node) => {
      if (ts.isJsxText(n) && hasWords(n.text)) texts.push(n.text);
      ts.forEachChild(n, walk);
    };
    walk(bad);
    expect(texts).toEqual(["Click me"]);
  });
});
