"use client";

// PROTOTYPE — throwaway. The floating variant switcher for the identity
// exploration. Cycles the `?variant=` search param (reload-stable / shareable)
// via arrow buttons or ← / → keys, and is hidden in production builds so a
// stray merge can't ship it. Delete with the rest of the prototype.

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type VariantMeta = { key: string; name: string };

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: VariantMeta[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = useCallback(
    (dir: 1 | -1) => {
      const i = variants.findIndex((v) => v.key === current);
      const next = variants[(i + dir + variants.length) % variants.length];
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next.key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [variants, current, searchParams, router, pathname],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  const active = variants.find((v) => v.key === current) ?? variants[0];

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: ".25rem",
        background: "#0a0a0a",
        color: "#fff",
        border: "1px solid #333",
        borderRadius: "999px",
        padding: ".35rem .4rem",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <button onClick={() => go(-1)} aria-label="Previous variant" style={btn}>
        <ChevronLeft size={18} />
      </button>
      <span style={{ padding: "0 .6rem", fontSize: ".82rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <b style={{ textTransform: "uppercase" }}>{active.key}</b>
        <span style={{ opacity: 0.6 }}> — {active.name}</span>
      </span>
      <button onClick={() => go(1)} aria-label="Next variant" style={btn}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: "2rem",
  height: "2rem",
  borderRadius: "999px",
  background: "transparent",
  color: "inherit",
  border: "none",
  cursor: "pointer",
};
