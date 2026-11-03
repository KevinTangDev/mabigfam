import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/icons";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useI18n } from "../i18n/context";
import Logo from "../components/Logo";
import { Button, cardClass, inputClass } from "../components/ui";

export default function LoginScreen() {
  const { login } = useAuth();
  const { t, errorText } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(errorText(err, "login.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* Soft colour washes behind the card. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-brand/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-24 size-96 rounded-full bg-ctp-pink/15 blur-3xl" />

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="page-enter relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="size-16 rounded-2xl" />
          <h1 className="mt-4 text-4xl font-semibold text-ctp-text">MaBigFam</h1>
          <p className="mt-1.5 text-sm text-ctp-subtext0">{t("login.tagline")}</p>
        </div>

        <form onSubmit={handleSubmit} className={`${cardClass} p-6 shadow-pop sm:p-7`}>
          <label htmlFor="family-password" className="text-sm font-semibold text-ctp-text">
            {t("login.label")}
          </label>
          <p className="mt-0.5 text-xs text-ctp-subtext0">{t("login.hint")}</p>

          <div className="relative mt-3">
            <Icon
              name="lock"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ctp-overlay1"
            />
            <input
              id="family-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.placeholder")}
              autoFocus
              autoComplete="current-password"
              className={`${inputClass} pl-10`}
            />
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-ctp-red">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy || !password} className="mt-4 w-full py-2.5">
            {busy ? t("login.signingIn") : t("login.signIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}
