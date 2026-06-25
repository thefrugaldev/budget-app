/** 3px rod at the top of the active tab — the "you are here" signal. */
export function ActiveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-foreground"
    />
  );
}
