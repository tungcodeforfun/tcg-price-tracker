// PROTOTYPE (UI redesign): floating bar to flip between design variants. Never rendered in production.
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { VARIANTS, VARIANT_NAMES, type Variant } from "./types";

export function VariantSwitcher({ current }: { current: Variant }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const index = VARIANTS.indexOf(current);
  const go = (step: number) => {
    const next = new URLSearchParams(params);
    next.set("design", VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!);
    navigate({ search: `?${next}` }, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1 font-sans text-sm text-white shadow-2xl ring-2 ring-white">
      <button type="button" onClick={() => go(-1)} className="rounded-full px-2 py-1 hover:bg-white/20" aria-label="Previous variant">
        ←
      </button>
      <span className="px-2 font-medium">
        {current} · {VARIANT_NAMES[current]}
      </span>
      <button type="button" onClick={() => go(1)} className="rounded-full px-2 py-1 hover:bg-white/20" aria-label="Next variant">
        →
      </button>
    </div>
  );
}
