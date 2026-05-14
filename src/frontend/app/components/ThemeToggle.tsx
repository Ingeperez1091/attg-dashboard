"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "attg-theme";

function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const sessionValue = window.sessionStorage.getItem(THEME_STORAGE_KEY);
  if (sessionValue === "light" || sessionValue === "dark") {
    return sessionValue;
  }

  const localValue = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (localValue === "light" || localValue === "dark") {
    return localValue;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persistTheme(theme: ThemeMode): void {
  window.sessionStorage.setItem(THEME_STORAGE_KEY, theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = readInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    persistTheme(initialTheme);
    setMounted(true);
  }, []);

  function toggleTheme(): void {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  }

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? "is-on" : "is-off"}`}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="theme-toggle__label">Theme</span>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__state">{mounted ? (isDark ? "Dark" : "Light") : "Light"}</span>
    </button>
  );
}
