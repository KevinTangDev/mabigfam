import { en } from "./en";
import type { MessageKey } from "./en";
import { fr } from "./fr";
import { zh } from "./zh";
import { translateServerMessage } from "./serverErrors";

export type Lang = "en" | "fr" | "zh";

export const LANGS: readonly Lang[] = ["en", "fr", "zh"];
export const DEFAULT_LANG: Lang = "en";
export const STORAGE_KEY = "mabigfam-lang";

/** Per-language settings: the Intl locale, the <html lang>, and the switcher's short label. */
export const LANG_META: Record<Lang, { locale: string; htmlLang: string; short: string }> = {
  en: { locale: "en", htmlLang: "en", short: "EN" },
  fr: { locale: "fr-FR", htmlLang: "fr", short: "FR" },
  zh: { locale: "zh-CN", htmlLang: "zh-CN", short: "中文" },
};

const DICTIONARIES: Record<Lang, Record<string, string>> = { en, fr, zh };

type PluralSuffix = "_one" | "_other";
/** A message key as callers write it: plural variants collapse to their base name. */
export type BaseKey = MessageKey extends infer K
  ? K extends `${infer B}${PluralSuffix}`
    ? B
    : K
  : never;

export type Vars = Record<string, string | number>;
export type TFn = (key: BaseKey, vars?: Vars) => string;

export interface I18n {
  lang: Lang;
  locale: string;
  t: TFn;
  /** Format a date/time in the active locale. Pass `timeZone: "UTC"` for stored all-day dates. */
  date: (value: Date | string, options: Intl.DateTimeFormatOptions) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Turn a caught error into user-facing text, translating the server's known messages. */
  errorText: (err: unknown, fallback: BaseKey) => string;
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** Pure factory (no React) so formatting and plurals are unit-testable on their own. */
export function createI18n(lang: Lang): I18n {
  const { locale } = LANG_META[lang];
  const messages = DICTIONARIES[lang];
  const plurals = new Intl.PluralRules(locale);

  const t: TFn = (key, vars) => {
    const count = vars?.count;
    const message =
      typeof count === "number"
        ? (messages[`${key}_${plurals.select(count)}`] ?? messages[`${key}_other`] ?? messages[key])
        : messages[key];

    // A missing key shows the key itself — loud in review, never blank.
    if (message === undefined) return key;
    return vars ? message.replace(/\{(\w+)\}/g, (whole, name) => String(vars[name] ?? whole)) : message;
  };

  const errorText: I18n["errorText"] = (err, fallback) => {
    if (!(err instanceof Error)) return t(fallback);
    return translateServerMessage(err.message, t) ?? (err.message || t(fallback));
  };

  return {
    lang,
    locale,
    t,
    date: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    number: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    errorText,
  };
}
