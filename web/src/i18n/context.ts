import { Fragment, createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LANG, createI18n } from "./config";
import type { BaseKey, I18n, Lang, Vars } from "./config";

export interface I18nContextValue extends I18n {
  setLang: (lang: Lang) => void;
  /** Like `t`, but renders `<em>…</em>` in the message as real emphasis. */
  rich: (key: BaseKey, vars?: Vars) => ReactNode;
}

export function withReact(base: I18n, setLang: (lang: Lang) => void): I18nContextValue {
  return {
    ...base,
    setLang,
    rich: (key, vars) =>
      base
        .t(key, vars)
        .split(/(<em>.*?<\/em>)/g)
        .map((part, i) =>
          part.startsWith("<em>") ? (
            createElement("em", { key: i }, part.slice(4, -5))
          ) : (
            createElement(Fragment, { key: i }, part)
          ),
        ),
  };
}

/**
 * Defaults to English with no provider, so a component renders (and is
 * testable) on its own; the real app always sits under <I18nProvider>.
 */
export const I18nContext = createContext<I18nContextValue>(withReact(createI18n(DEFAULT_LANG), () => {}));

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
