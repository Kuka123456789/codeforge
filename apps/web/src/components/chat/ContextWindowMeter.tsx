import { cn } from "~/lib/utils";
import { type ContextWindowSnapshot, formatContextWindowTokens } from "~/lib/contextWindow";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

function formatPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

type UrgencyLevel = "normal" | "warning" | "critical";

function getUrgencyLevel(percentage: number | null): UrgencyLevel {
  if (percentage === null) return "normal";
  if (percentage >= 90) return "critical";
  if (percentage >= 75) return "warning";
  return "normal";
}

const urgencyStrokeColors: Record<UrgencyLevel, string> = {
  normal: "var(--color-muted-foreground)",
  warning: "oklch(0.75 0.18 70)",
  critical: "oklch(0.65 0.22 25)",
};

const urgencyTrackColors: Record<UrgencyLevel, string> = {
  normal: "color-mix(in oklab, var(--color-muted) 70%, transparent)",
  warning: "oklch(0.75 0.18 70 / 0.2)",
  critical: "oklch(0.65 0.22 25 / 0.2)",
};

const urgencyTextClasses: Record<UrgencyLevel, string> = {
  normal: "text-muted-foreground",
  warning: "text-amber-500 dark:text-amber-400",
  critical: "text-red-500 dark:text-red-400",
};

export function ContextWindowMeter(props: { usage: ContextWindowSnapshot }) {
  const { usage } = props;
  const usedPercentage = formatPercentage(usage.usedPercentage);
  const normalizedPercentage = Math.max(0, Math.min(100, usage.usedPercentage ?? 0));
  const radius = 9.75;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalizedPercentage / 100) * circumference;
  const urgency = getUrgencyLevel(usage.usedPercentage);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <button
            type="button"
            className={cn(
              "group inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-85",
              urgency === "critical" && "animate-pulse motion-reduce:animate-none",
            )}
            aria-label={
              usage.maxTokens !== null && usedPercentage
                ? `Context window ${usedPercentage} used`
                : `Context window ${formatContextWindowTokens(usage.usedTokens)} tokens used`
            }
          >
            <span
              className={cn(
                "relative flex h-6 w-6 items-center justify-center",
                urgency === "warning" && "h-7 w-7",
                urgency === "critical" && "h-8 w-8",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className="-rotate-90 absolute inset-0 h-full w-full transform-gpu"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke={urgencyTrackColors[urgency]}
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke={urgencyStrokeColors[urgency]}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
                />
              </svg>
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-full bg-background font-medium",
                  urgency === "normal" && "h-[15px] w-[15px] text-[8px]",
                  urgency === "warning" && "h-[18px] w-[18px] text-[9px]",
                  urgency === "critical" && "h-[21px] w-[21px] text-[10px] font-semibold",
                  urgencyTextClasses[urgency],
                )}
              >
                {usage.usedPercentage !== null
                  ? Math.round(usage.usedPercentage)
                  : formatContextWindowTokens(usage.usedTokens)}
              </span>
            </span>
          </button>
        }
      />
      <PopoverPopup tooltipStyle side="top" align="end" className="w-max max-w-none px-3 py-2">
        <div className="space-y-1.5 leading-tight">
          <div
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.08em]",
              urgencyTextClasses[urgency] || "text-muted-foreground",
            )}
          >
            Context window
            {urgency === "critical" && " — nearly full"}
            {urgency === "warning" && " — filling up"}
          </div>
          {usage.maxTokens !== null && usedPercentage ? (
            <div className="whitespace-nowrap text-xs font-medium text-foreground">
              <span>{usedPercentage}</span>
              <span className="mx-1">⋅</span>
              <span>{formatContextWindowTokens(usage.usedTokens)}</span>
              <span>/</span>
              <span>{formatContextWindowTokens(usage.maxTokens ?? null)} context used</span>
            </div>
          ) : (
            <div className="text-sm text-foreground">
              {formatContextWindowTokens(usage.usedTokens)} tokens used so far
            </div>
          )}
          {(usage.totalProcessedTokens ?? null) !== null &&
          (usage.totalProcessedTokens ?? 0) > usage.usedTokens ? (
            <div className="text-xs text-muted-foreground">
              Total processed: {formatContextWindowTokens(usage.totalProcessedTokens ?? null)}{" "}
              tokens
            </div>
          ) : null}
          {usage.compactsAutomatically ? (
            <div className="text-xs text-muted-foreground">
              Automatically compacts its context when needed.
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
