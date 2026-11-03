import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { zh } from "../src/i18n/zh";
import { createI18n } from "../src/i18n/config";
import type { Lang } from "../src/i18n/config";

const DICTS: Record<Exclude<Lang, "en">, Record<string, string>> = { fr, zh };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
const hasEm = (s: string) => /<em>.*<\/em>/.test(s);

describe("translation catalogs", () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    describe(lang, () => {
      it("has exactly the English keys (nothing missing, nothing stray)", () => {
        expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
      });

      it("never leaves a value empty", () => {
        expect(Object.entries(dict).filter(([, v]) => v.trim() === "")).toEqual([]);
      });

      it("uses the same {placeholders} and <em> markup as English for every key", () => {
        const mismatched = Object.keys(en).filter(
          (key) =>
            placeholders(dict[key]!).join() !== placeholders(en[key as keyof typeof en]).join() ||
            hasEm(dict[key]!) !== hasEm(en[key as keyof typeof en]),
        );
        expect(mismatched).toEqual([]);
      });
    });
  }

  it("French is actually translated: it only repeats English for brand/technical/cognate strings", () => {
    // Words that are legitimately identical in French. Anything else equal to
    // English is an untranslated string.
    const SAME = new Set([
      "nav.contacts", "contacts.title", "detail.message", "contacts.message", "detail.note", "memberForm.note",
      "cal.google", "cal.ics", "lang.en", "lang.fr", "lang.zh", "common.open", "dash.stat.couples_one",
      "dash.stat.couples_other", "status.assumed", "contacts.viewCards", "tree.generation",
      "detail.parents", "eventForm.notes",
    ]);
    const untranslated = Object.keys(en).filter(
      (key) => fr[key as keyof typeof fr] === en[key as keyof typeof en] && !SAME.has(key),
    );
    expect(untranslated).toEqual([]);
  });

  it("Chinese is actually translated, apart from brand names and file extensions", () => {
    const SAME = new Set(["cal.google", "cal.ics", "lang.en", "lang.fr", "lang.zh"]);
    const untranslated = Object.keys(en).filter(
      (key) => zh[key as keyof typeof zh] === en[key as keyof typeof en] && !SAME.has(key),
    );
    expect(untranslated).toEqual([]);
    // Chinese UI text should contain Han characters (except the few technical strings).
    const noHan = Object.entries(zh).filter(([k, v]) => !SAME.has(k) && !/\p{Script=Han}/u.test(v));
    expect(noHan.map(([k]) => k)).toEqual([]);
  });
});

describe("createI18n", () => {
  it("interpolates variables and leaves unknown placeholders visible", () => {
    const { t } = createI18n("en");
    expect(t("contacts.callAria", { name: "Kevin" })).toBe("Call Kevin");
    expect(t("rel.childOf", {})).toBe("Child of {names}");
  });

  it("falls back to the key itself rather than rendering nothing", () => {
    // @ts-expect-error — deliberately not a real key
    expect(createI18n("fr").t("no.such.key")).toBe("no.such.key");
  });

  it("picks plural forms with each language's own rules", () => {
    expect(createI18n("en").t("rel.children", { count: 1 })).toBe("1 child");
    expect(createI18n("en").t("rel.children", { count: 3 })).toBe("3 children");
    // French treats 0 and 1 as singular.
    expect(createI18n("fr").t("rel.children", { count: 0 })).toBe("0 enfant");
    expect(createI18n("fr").t("rel.children", { count: 2 })).toBe("2 enfants");
    // Chinese has no plural.
    expect(createI18n("zh").t("rel.children", { count: 1 })).toBe("1个孩子");
  });

  it("formats dates in each language's locale (en / fr-FR / zh-CN)", () => {
    const opts = { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } as const;
    const d = "2026-03-05T00:00:00.000Z";
    expect(createI18n("en").date(d, opts)).toBe("March 5, 2026");
    expect(createI18n("fr").date(d, opts)).toBe("5 mars 2026");
    expect(createI18n("zh").date(d, opts)).toBe("2026年3月5日");
    expect(createI18n("fr").locale).toBe("fr-FR");
    expect(createI18n("zh").locale).toBe("zh-CN");
  });

  it("formats numbers per locale", () => {
    expect(createI18n("en").number(1234.5)).toBe("1,234.5");
    expect(createI18n("fr").number(1234.5).replace(/\s/g, " ")).toBe("1 234,5");
    expect(createI18n("zh").number(0.55, { style: "percent" })).toBe("55%");
  });

  it("applies French typography (no-break space before ? ! : ;)", () => {
    expect(createI18n("fr").t("dash.shortcut.gameHint")).toBe("Qui est-ce ?");
    expect(createI18n("fr").t("game.correct")).toBe("Bravo !");
  });

  describe("errorText", () => {
    it("translates the server's known messages", () => {
      const err = new Error("Incorrect password");
      expect(createI18n("en").errorText(err, "login.failed")).toBe("Incorrect password");
      expect(createI18n("fr").errorText(err, "login.failed")).toBe("Mot de passe incorrect");
      expect(createI18n("zh").errorText(err, "login.failed")).toBe("密码错误");
    });

    it("handles the parameterised and prefix messages", () => {
      expect(createI18n("fr").errorText(new Error("Photo is too large (limit 8MB)"), "photo.uploadFailed")).toContain("8 Mo");
      expect(createI18n("zh").errorText(new Error("Request failed: 500"), "photo.uploadFailed")).toBe("请求失败（500）");
      expect(createI18n("fr").errorText(new Error("Rate limit exceeded, retry in 1 minute"), "login.failed")).toMatch(/Trop de tentatives/);
      expect(createI18n("zh").errorText(new TypeError("Failed to fetch"), "login.failed")).toContain("无法连接");
    });

    it("passes unrecognised messages through and uses the fallback for non-errors", () => {
      expect(createI18n("fr").errorText(new Error("some validation detail"), "login.failed")).toBe("some validation detail");
      expect(createI18n("fr").errorText("nope", "login.failed")).toBe("Connexion impossible");
    });
  });
});
