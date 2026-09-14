import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button, cardClass, inputClass } from "../components/ui";

export default function LoginScreen() {
  const { login } = useAuth();
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
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className={`${cardClass} w-full max-w-sm p-7 shadow-sm`}>
        <h1 className="text-2xl font-semibold tracking-tight text-ctp-mauve">MaBigFam</h1>
        <p className="mt-1 text-sm text-ctp-subtext0">Enter the family password to continue.</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Family password"
          autoFocus
          autoComplete="current-password"
          className={`${inputClass} mt-5`}
        />

        {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

        <Button type="submit" variant="primary" disabled={busy || !password} className="mt-4 w-full">
          {busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
