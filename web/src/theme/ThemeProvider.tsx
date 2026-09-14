import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Flavor = "light" | "dark";

const STORAGE_KEY = "mabigfam-theme";

interface ThemeState {
  flavor: Flavor;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function initialFlavor(): Flavor {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private mode / blocked storage — fall through to the OS preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [flavor, setFlavor] = useState<Flavor>(initialFlavor);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", flavor);
    try {
      localStorage.setItem(STORAGE_KEY, flavor);
    } catch {
      // Not persisting is survivable; the theme still applies this session.
    }
  }, [flavor]);

  const toggle = useCallback(() => {
    setFlavor((f) => (f === "dark" ? "light" : "dark"));
  }, []);

  return <ThemeContext.Provider value={{ flavor, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
