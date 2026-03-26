import { ChevronUpIcon, XIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

interface PinnedUserPromptBannerProps {
  /** Whether the banner should be visible. Drives the enter/exit animation. */
  visible: boolean;
  text: string;
  onScrollToMessage: () => void;
  onDismiss: () => void;
}

/**
 * Floating banner pinned to the top of the messages area that shows the user's
 * last prompt when it has scrolled above the viewport. Clicking the main area
 * scrolls back to the message; the X button dismisses until the next prompt.
 */
export const PinnedUserPromptBanner = memo(function PinnedUserPromptBanner({
  visible,
  text,
  onScrollToMessage,
  onDismiss,
}: PinnedUserPromptBannerProps) {
  // Keep the component mounted briefly after `visible` becomes false so the
  // exit animation can play before unmounting.
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setAnimateIn(true));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return () => cancelAnimationFrame(frame);
    }
    setAnimateIn(false);
    timerRef.current = setTimeout(() => setMounted(false), 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-3 sm:px-5"
      style={{
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? "translateY(0)" : "translateY(-100%)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      }}
    >
      <div className="pointer-events-auto flex w-full max-w-3xl items-start gap-1.5 rounded-b-xl border border-t-0 border-primary/20 bg-primary/10 py-2 pr-1.5 pl-3.5 shadow-md backdrop-blur-sm dark:border-primary/25 dark:bg-primary/15">
        <button
          type="button"
          onClick={onScrollToMessage}
          className="flex min-w-0 flex-1 items-start gap-2 text-left transition-colors hover:opacity-80"
        >
          <ChevronUpIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="line-clamp-4 text-sm text-foreground">
            <span className="font-semibold text-primary">You asked:</span> {text}
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss pinned prompt"
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-primary/50 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
