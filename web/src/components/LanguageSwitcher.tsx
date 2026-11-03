import { useI18n } from "../i18n/context";
import { LANGS, LANG_META } from "../i18n/config";

/**
 * EN / FR / 中文, as a segmented control so the active language is obvious and
 * every option is one tap away. Each button carries its own `lang` so a
 * Chinese label is drawn with a Chinese font whatever the page language is.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={`inline-flex shrink-0 rounded-xl border border-ctp-surface1 bg-ctp-mantle p-0.5 ${className}`}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          lang={LANG_META[code].htmlLang}
          aria-pressed={lang === code}
          title={t(`lang.${code}`)}
          onClick={() => setLang(code)}
          className={
            "inline-flex min-h-8 min-w-9 cursor-pointer items-center justify-center rounded-[10px] px-2 text-xs font-bold " +
            "transition pointer-coarse:min-h-10 pointer-coarse:min-w-10 sm:px-2.5 sm:text-sm " +
            (lang === code
              ? "bg-brand text-on-brand shadow-sm"
              : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text")
          }
        >
          {LANG_META[code].short}
        </button>
      ))}
    </div>
  );
}
