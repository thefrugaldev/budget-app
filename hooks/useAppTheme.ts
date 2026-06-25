"use client";

import { useEffect, useState } from "react";

import { Theme } from "emoji-picker-react";

// The app uses Tailwind's class-based dark mode (`.dark` on the html element)
// rather than `prefers-color-scheme`. Some third-party widgets (e.g.
// `emoji-picker-react`) default to following the system preference, which
// mismatches the app's class strategy. Watch the html element for class
// changes and resolve an explicit theme that tracks the app's `.dark` toggle.
export function useAppTheme(): Theme {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark ? Theme.DARK : Theme.LIGHT;
}
