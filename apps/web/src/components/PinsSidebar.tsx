import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MessageId } from "@codeforge/contracts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import ChatMarkdown from "./ChatMarkdown";
import { PanelRightCloseIcon, XIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Pin } from "../pinStore";

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 340;

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}

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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const widthRef = useRef(width);
  widthRef.current = width;

  const resizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: widthRef.current,
    };
  }, []);

  const handleResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Dragging left increases width (sidebar is on the right)
    const nextWidth = clampWidth(state.startWidth + (state.startX - event.clientX));
    if (nextWidth !== widthRef.current) {
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    }
  }, []);

  const handleResizePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    resizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-border/70 bg-card/50"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
      />

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
            pins.map((pin) => (
              <PinItem
                key={pin.id}
                pin={pin}
                markdownCwd={markdownCwd}
                onRemove={onRemovePin}
                onScrollTo={onScrollToMessage}
              />
            ))
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
  const [expanded, setExpanded] = useState(false);

  const handleScrollTo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onScrollTo(pin.messageId);
    },
    [onScrollTo, pin.messageId],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(pin.id);
    },
    [onRemove, pin.id],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const displayText = pin.selectedText ?? pin.fullMessageText;
  const isSelection = pin.selectedText !== null;

  return (
    <div
      className={cn(
        "group relative w-full rounded-lg border border-border/50 bg-background/50 transition-colors duration-150",
        "hover:border-border/80 hover:bg-background/80",
      )}
    >
      {/* Header badges */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
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

      {/* Content — click scrolls to source message */}
      <div
        className="cursor-pointer px-3"
        onClick={handleScrollTo}
        title="Click to scroll to message"
      >
        <div className={cn("text-sm", !expanded && "max-h-[120px] overflow-hidden")}>
          {pin.messageRole === "assistant" ? (
            <div
              className={cn(
                "[&_.chat-markdown]:text-xs [&_.chat-markdown]:leading-relaxed",
                !expanded && "line-clamp-[5]",
              )}
            >
              <ChatMarkdown text={displayText} cwd={markdownCwd} isStreaming={false} />
            </div>
          ) : (
            <pre
              className={cn(
                "whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80",
                !expanded && "line-clamp-[5]",
              )}
            >
              {displayText}
            </pre>
          )}
        </div>
        {/* Fade-out gradient when collapsed */}
        {!expanded && (
          <div className="pointer-events-none relative -mt-6 h-6 bg-gradient-to-t from-background/80 to-transparent" />
        )}
      </div>

      {/* Show more / Show less toggle — sticky when expanded so it's always reachable */}
      <div
        className={cn(
          "px-3 pb-2 pt-0.5",
          expanded && "sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/30",
        )}
      >
        <button
          type="button"
          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          onClick={toggleExpanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>

      {/* Unpin button — top right */}
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleRemove}
        aria-label="Unpin"
        className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 text-muted-foreground/50 hover:text-foreground/70"
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
});

export default PinsSidebar;
export type { PinsSidebarProps };
