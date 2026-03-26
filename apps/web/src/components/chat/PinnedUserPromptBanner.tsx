import { ChevronUpIcon } from "lucide-react";
import { memo } from "react";

interface PinnedUserPromptBannerProps {
  text: string;
  onClick: () => void;
}

export const PinnedUserPromptBanner = memo(function PinnedUserPromptBanner({
  text,
  onClick,
}: PinnedUserPromptBannerProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-1">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto flex max-w-3xl items-center gap-2 rounded-b-lg border border-t-0 border-border/60 bg-card/95 px-4 py-1.5 text-left text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:cursor-pointer hover:border-border hover:text-foreground"
      >
        <ChevronUpIcon className="size-3.5 shrink-0" />
        <span className="truncate">
          <span className="font-medium text-foreground/70">You asked:</span> {text}
        </span>
      </button>
    </div>
  );
});
