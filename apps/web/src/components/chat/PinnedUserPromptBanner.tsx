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
      // Mount immediately, then trigger the CSS transition on the next frame.
      setMounted(true);
      const frame = requestAnimationFrame(() => setAnimateIn(true));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return () => cancelAnimationFrame(frame);
    }
    // Start exit animation, then unmount after transition completes.
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
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-1 rounded-b-xl border border-t-0 border-border/50 bg-card/95 py-1.5 pr-1.5 pl-3.5 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={onScrollToMessage}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronUpIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            <span className="font-medium text-foreground/70">You asked:</span> {text}
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss pinned prompt"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  );
});
