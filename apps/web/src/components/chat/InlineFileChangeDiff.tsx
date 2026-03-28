import { memo, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "~/lib/utils";

/** Maximum number of diff lines to show before collapsing by default. */
const AUTO_COLLAPSE_THRESHOLD = 25;
/** Maximum number of content lines to render (for large Write payloads). */
const MAX_RENDERED_LINES = 150;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffLine {
  readonly type: "add" | "remove" | "context";
  readonly text: string;
  /** 1-indexed line number in the old file (for removals/context). */
  readonly oldLineNo?: number;
  /** 1-indexed line number in the new file (for additions/context). */
  readonly newLineNo?: number;
}

interface ParsedFileChange {
  readonly filePath: string;
  readonly fileName: string;
  readonly operation: string;
  readonly lines: readonly DiffLine[];
  readonly additions: number;
  readonly deletions: number;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function lastPathSegment(filePath: string): string {
  const segments = filePath.split("/");
  return segments.at(-1) ?? filePath;
}

function parentPath(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  if (idx <= 0) return "";
  return filePath.slice(0, idx + 1);
}

function parseEditChange(filePath: string, oldString: string, newString: string): ParsedFileChange {
  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");
  const diffLines: DiffLine[] = [];

  let oldLineNo = 1;
  for (const line of oldLines) {
    diffLines.push({ type: "remove", text: line, oldLineNo: oldLineNo++ });
  }

  let newLineNo = 1;
  for (const line of newLines) {
    diffLines.push({ type: "add", text: line, newLineNo: newLineNo++ });
  }

  return {
    filePath,
    fileName: lastPathSegment(filePath),
    operation: "Update",
    lines: diffLines,
    additions: newLines.length,
    deletions: oldLines.length,
  };
}

function parseWriteChange(filePath: string, content: string): ParsedFileChange {
  const rawLines = content.split("\n");
  const truncated = rawLines.length > MAX_RENDERED_LINES;
  const visibleLines = truncated ? rawLines.slice(0, MAX_RENDERED_LINES) : rawLines;
  const diffLines: DiffLine[] = visibleLines.map((line, i) => ({
    type: "add" as const,
    text: line,
    newLineNo: i + 1,
  }));

  return {
    filePath,
    fileName: lastPathSegment(filePath),
    operation: "Write",
    lines: diffLines,
    additions: rawLines.length,
    deletions: 0,
  };
}

function parseToolInput(
  toolName: string,
  toolInput: Record<string, unknown>,
): ParsedFileChange | null {
  const filePath =
    typeof toolInput.file_path === "string"
      ? toolInput.file_path
      : typeof toolInput.path === "string"
        ? toolInput.path
        : null;

  if (!filePath) return null;

  const oldString = typeof toolInput.old_string === "string" ? toolInput.old_string : null;
  const newString = typeof toolInput.new_string === "string" ? toolInput.new_string : null;
  const content = typeof toolInput.content === "string" ? toolInput.content : null;

  if (oldString !== null && newString !== null) {
    return parseEditChange(filePath, oldString, newString);
  }

  if (content !== null) {
    return parseWriteChange(filePath, content);
  }

  // Fallback: show only the file path with no diff lines
  return {
    filePath,
    fileName: lastPathSegment(filePath),
    operation: toolName,
    lines: [],
    additions: 0,
    deletions: 0,
  };
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

function changeSummary(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) {
    parts.push(`Added ${additions} line${additions === 1 ? "" : "s"}`);
  }
  if (deletions > 0) {
    parts.push(`removed ${deletions} line${deletions === 1 ? "" : "s"}`);
  }
  // Capitalize first letter of result
  const result = parts.join(", ");
  return result.length > 0 ? result.charAt(0).toUpperCase() + result.slice(1) : "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InlineFileChangeDiff = memo(function InlineFileChangeDiff(props: {
  toolName: string;
  toolInput: Record<string, unknown>;
}) {
  const { toolName, toolInput } = props;

  const parsed = useMemo(() => parseToolInput(toolName, toolInput), [toolName, toolInput]);

  if (!parsed) return null;

  const totalLines = parsed.lines.length;
  const defaultOpen = totalLines > 0 && totalLines <= AUTO_COLLAPSE_THRESHOLD;

  return <DiffBlock change={parsed} defaultOpen={defaultOpen} />;
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DiffBlock = memo(function DiffBlock(props: {
  change: ParsedFileChange;
  defaultOpen: boolean;
}) {
  const { change, defaultOpen } = props;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasLines = change.lines.length > 0;
  const summary = changeSummary(change.additions, change.deletions);
  const parent = parentPath(change.filePath);

  return (
    <div className="mt-1.5 overflow-hidden rounded-md border border-border/40 bg-card/30">
      {/* Header */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left font-mono text-[11px]",
          hasLines && "cursor-pointer hover:bg-accent/40",
          !hasLines && "cursor-default",
        )}
        onClick={() => hasLines && setIsOpen((prev) => !prev)}
        title={change.filePath}
      >
        {hasLines && (
          <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/60">
            {isOpen ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
          </span>
        )}
        <span className="text-success-foreground">{change.operation}</span>
        <span className="text-muted-foreground/50">(</span>
        {parent && <span className="text-muted-foreground/40">{parent}</span>}
        <span className="text-foreground/80">{change.fileName}</span>
        <span className="text-muted-foreground/50">)</span>
        {summary && (
          <>
            <span className="mx-1 text-muted-foreground/30">|</span>
            <span className="text-muted-foreground/55">{summary}</span>
          </>
        )}
      </button>

      {/* Diff lines */}
      {hasLines && isOpen && (
        <div className="overflow-x-auto border-t border-border/30 font-mono text-[11px] leading-[18px]">
          {change.lines.map((line) => (
            <DiffLineRow
              key={`${line.type}:${line.oldLineNo ?? ""}:${line.newLineNo ?? ""}`}
              line={line}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const DiffLineRow = memo(function DiffLineRow(props: { line: DiffLine }) {
  const { line } = props;
  const lineNo = line.type === "remove" ? line.oldLineNo : line.newLineNo;
  const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

  return (
    <div
      className={cn(
        "flex whitespace-pre",
        line.type === "remove" && "bg-red-500/10 text-red-400",
        line.type === "add" && "bg-emerald-500/10 text-emerald-400",
        line.type === "context" && "text-muted-foreground/50",
      )}
    >
      <span className="inline-block w-8 shrink-0 select-none pr-1 text-right text-muted-foreground/30">
        {lineNo ?? ""}
      </span>
      <span className="inline-block w-4 shrink-0 select-none text-center">{prefix}</span>
      <span className="min-w-0">{line.text}</span>
    </div>
  );
});
