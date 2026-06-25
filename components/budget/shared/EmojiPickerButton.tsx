"use client";

import { Popover } from "@base-ui/react/popover";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { useAppTheme } from "@/hooks/useAppTheme";
import { cn } from "@/lib/utils";
import { EmojiStyle, type EmojiClickData } from "emoji-picker-react";

// Picker is heavy (~150KB gz) and most page loads never open it, so load it
// only when the popover first opens. `ssr: false` keeps the dynamic import
// client-only — the picker references `window` during init.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-[320px] items-center justify-center text-xs text-muted-foreground">
      Loading…
    </div>
  ),
});

// Name-hint suggestions: each row maps a keyword to one or more emoji that
// should appear at the top of the picker when the parent's name field
// contains the keyword. Lower-cased, substring match. Kept small — common
// budget categories only; users can still search inside the picker.
const NAME_HINTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["coffee", ["☕"]],
  ["grocer", ["🛒", "🥦"]],
  ["dining", ["🍽️", "🍴"]],
  ["restaurant", ["🍽️"]],
  ["food", ["🍔", "🍕"]],
  ["gas", ["⛽"]],
  ["fuel", ["⛽"]],
  ["car", ["🚗"]],
  ["transport", ["🚆"]],
  ["uber", ["🚕"]],
  ["lyft", ["🚕"]],
  ["rent", ["🏠"]],
  ["mortgage", ["🏡"]],
  ["home", ["🏠"]],
  ["utility", ["💡"]],
  ["electric", ["💡"]],
  ["water", ["💧"]],
  ["internet", ["🌐"]],
  ["phone", ["📱"]],
  ["gym", ["🏋️"]],
  ["fitness", ["🏋️"]],
  ["health", ["🩺"]],
  ["medical", ["🩺"]],
  ["doctor", ["🩺"]],
  ["pharmacy", ["💊"]],
  ["travel", ["✈️"]],
  ["vacation", ["🌴", "🏖️"]],
  ["flight", ["✈️"]],
  ["hotel", ["🏨"]],
  ["entertain", ["🎬"]],
  ["movie", ["🎬"]],
  ["music", ["🎵"]],
  ["gaming", ["🎮"]],
  ["game", ["🎮"]],
  ["subscription", ["📺"]],
  ["streaming", ["📺"]],
  ["gift", ["🎁"]],
  ["charity", ["💝"]],
  ["education", ["🎓"]],
  ["school", ["🎓"]],
  ["book", ["📚"]],
  ["pet", ["🐾"]],
  ["dog", ["🐶"]],
  ["cat", ["🐱"]],
  ["salary", ["💼"]],
  ["paycheck", ["💵"]],
  ["bonus", ["🎉"]],
  ["rsu", ["📈"]],
  ["dividend", ["📈"]],
  ["interest", ["💰"]],
  ["side", ["💼"]],
  ["gig", ["💼"]],
  ["savings", ["💰"]],
  ["emergency", ["🚨"]],
  ["retirement", ["🏖️"]],
  ["brokerage", ["📈"]],
  ["hysa", ["🏦"]],
  ["bank", ["🏦"]],
  ["house", ["🏡"]],
  ["clothes", ["👕"]],
  ["clothing", ["👕"]],
  ["beer", ["🍺"]],
  ["bar", ["🍺"]],
  ["wine", ["🍷"]],
] as const;

function suggestionsFor(nameHint: string | undefined): readonly string[] {
  if (!nameHint) return [];
  const lower = nameHint.toLowerCase().trim();
  if (!lower) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [keyword, emojis] of NAME_HINTS) {
    if (lower.includes(keyword)) {
      for (const e of emojis) {
        if (!seen.has(e)) {
          seen.add(e);
          out.push(e);
        }
      }
    }
  }
  return out.slice(0, 6);
}

export type EmojiPickerButtonProps = {
  /** Controlled value. Pair with `onChange`. */
  value?: string;
  onChange?: (next: string) => void;
  /** Uncontrolled initial value. Ignored when `value` is provided. */
  defaultValue?: string;
  /** Name for the hidden form input that carries the value. Default `emoji`. */
  inputName?: string;
  /**
   * Free-text name the user is typing (e.g. category name). Used to surface
   * a row of suggested emoji at the top of the picker. Optional.
   */
  nameHint?: string;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Extra classes for the trigger button. */
  className?: string;
};

export function EmojiPickerButton({
  value,
  onChange,
  defaultValue,
  inputName = "emoji",
  nameHint,
  ariaLabel = "Choose emoji",
  className,
}: EmojiPickerButtonProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  function set(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => suggestionsFor(nameHint), [nameHint]);
  const theme = useAppTheme();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={inputName} value={current} />
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          "cursor-pointer rounded-md bg-background px-2 py-1.5 text-center text-lg ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {current || "🙂"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            aria-label="Emoji picker"
            className="rounded-xl bg-card p-2 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity"
          >
            {suggestions.length > 0 && (
              <div className="mb-2 space-y-1 px-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested
                </span>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        set(e);
                        setOpen(false);
                      }}
                      className="cursor-pointer rounded-md bg-background px-2 py-1 text-lg ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <EmojiPicker
              onEmojiClick={(data: EmojiClickData) => {
                set(data.emoji);
                setOpen(false);
              }}
              emojiStyle={EmojiStyle.NATIVE}
              theme={theme}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              searchPlaceholder="Search emoji…"
              height={360}
              width={320}
            />
            <div className="mt-2 border-t border-border px-1 pt-2">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium">Or paste:</span>
                <input
                  type="text"
                  value={current}
                  onChange={(e) => set(e.target.value)}
                  maxLength={8}
                  aria-label="Paste emoji"
                  placeholder="🙂"
                  className="w-20 rounded-md bg-background px-2 py-1 text-center text-base ring-1 ring-border outline-none focus:ring-ring"
                />
              </label>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
