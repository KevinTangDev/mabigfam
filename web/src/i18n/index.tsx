import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LANG, LANG_META, STORAGE_KEY, createI18n, isLang } from "./config";
import type { Lang } from "./config";
import { I18nContext, withReact } from "./context";

function storedLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? storedLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the choice still applies this session.
    }
  }, []);

  // Keeps screen readers, hyphenation and the browser's CJK font choice in step.
  useEffect(() => {
    document.documentElement.lang = LANG_META[lang].htmlLang;
  }, [lang]);

  const value = useMemo(() => withReact(createI18n(lang), setLang), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
