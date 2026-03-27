import { memo, useCallback } from "react";
import type { MessageId } from "@codeforge/contracts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import ChatMarkdown from "./ChatMarkdown";
import { PanelRightCloseIcon, XIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Pin } from "../pinStore";

interface PinsSidebarProps {
  pins: Pin[];
  markdownCwd: string | undefined;
  onClose: () => void;
  onRemovePin: (pinId: string) => void;
  onScrollToMessage: (messageId: MessageId) => void;
}

const PinsSidebar = memo(function PinsSidebar({
  pins,
  markdownCwd,
  onClose,
  onRemovePin,
  onScrollToMessage,
}: PinsSidebarProps) {
  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-border/70 bg-card/50">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-md bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold tracking-wide text-amber-400 uppercase"
          >
            Pins
          </Badge>
          {pins.length > 0 && (
            <span className="text-[11px] text-muted-foreground/60">{pins.length} pinned</span>
          )}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          aria-label="Close pins sidebar"
          className="text-muted-foreground/50 hover:text-foreground/70"
        >
          <PanelRightCloseIcon className="size-3.5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {pins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-muted-foreground/40">No pinned messages.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/30">
                Select text and press ⌘⇧P to pin, or use the pin button on messages.
              </p>
            </div>
          ) : (
            pins.map((pin) => <PinItem key={pin.id} pin={pin} markdownCwd={markdownCwd} onRemove={onRemovePin} onScrollTo={onScrollToMessage} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

const PinItem = memo(function PinItem({
  pin,
  markdownCwd,
  onRemove,
  onScrollTo,
}: {
  pin: Pin;
  markdownCwd: string | undefined;
  onRemove: (pinId: string) => void;
  onScrollTo: (messageId: MessageId) => void;
}) {
  const handleClick = useCallback(() => {
    onScrollTo(pin.messageId);
  }, [onScrollTo, pin.messageId]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(pin.id);
    },
    [onRemove, pin.id],
  );

  const displayText = pin.selectedText ?? pin.fullMessageText;
  const isSelection = pin.selectedText !== null;

  return (
    <button
      type="button"
      className={cn(
        "group relative w-full cursor-pointer rounded-lg border border-border/50 bg-background/50 p-3 text-left transition-colors duration-150",
        "hover:border-border/80 hover:bg-background/80",
      )}
      onClick={handleClick}
      title="Click to scroll to message"
    >
      {/* Header badges */}
      <div className="mb-2 flex items-center gap-1.5">
        <Badge
          variant="secondary"
          className={cn(
            "rounded px-1 py-0 text-[9px] font-medium uppercase",
            pin.messageRole === "assistant"
              ? "bg-blue-500/10 text-blue-400"
              : "bg-zinc-500/10 text-zinc-400",
          )}
        >
          {pin.messageRole === "assistant" ? "Assistant" : "You"}
        </Badge>
        {isSelection && (
          <Badge
            variant="secondary"
            className="rounded bg-amber-500/10 px-1 py-0 text-[9px] font-medium text-amber-400 uppercase"
          >
            Selection
          </Badge>
        )}
      </div>

      {/* Content preview */}
      <div className="max-h-[200px] overflow-hidden text-sm">
        {pin.messageRole === "assistant" ? (
          <div className="line-clamp-[8] [&_.chat-markdown]:text-xs [&_.chat-markdown]:leading-relaxed">
            <ChatMarkdown text={displayText} cwd={markdownCwd} isStreaming={false} />
          </div>
        ) : (
          <pre className="line-clamp-[8] whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
            {displayText}
          </pre>
        )}
      </div>

      {/* Remove button */}
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleRemove}
        aria-label="Unpin"
        className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 text-muted-foreground/50 hover:text-foreground/70"
      >
        <XIcon className="size-3" />
      </Button>
    </button>
  );
});

export default PinsSidebar;
export type { PinsSidebarProps };
