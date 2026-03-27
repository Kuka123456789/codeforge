import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ThreadSearchResultItem } from "@codeforge/contracts";
import { MessageSquareIcon } from "lucide-react";

import { ensureNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { formatRelativeTimeString } from "~/timestampFormat";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "./ui/command";
import { isMacPlatform } from "~/lib/utils";

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_RESULT_LIMIT = 20;

interface ThreadSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThreadSearchDialog({ open, onOpenChange }: ThreadSearchDialogProps) {
  const navigate = useNavigate();
  const threads = useStore((s) => s.threads);
  const projects = useStore((s) => s.projects);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThreadSearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build lookup maps for enriching results with client-side data
  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const api = ensureNativeApi();
      const response = await api.threads.search({
        query: trimmed,
        limit: SEARCH_RESULT_LIMIT,
      });
      setResults([...response.results]);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      void executeSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, executeSearch]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }, [open]);

  const handleSelect = useCallback(
    (threadId: string) => {
      onOpenChange(false);
      void navigate({ to: "/$threadId", params: { threadId } });
    },
    [navigate, onOpenChange],
  );

  const modKey = isMacPlatform(navigator.platform) ? "\u2318" : "Ctrl";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup>
        <Command>
          <CommandInput
            placeholder="Search threads..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CommandPanel>
            <CommandList>
              {query.trim().length > 0 && results.length === 0 && !isSearching ? (
                <CommandEmpty>
                  <p className="text-center text-sm text-muted-foreground">No threads found.</p>
                </CommandEmpty>
              ) : null}
              {results.map((result) => {
                const thread = threadMap.get(result.threadId);
                const project = thread ? projectMap.get(thread.projectId) : undefined;

                return (
                  <CommandItem
                    key={result.threadId}
                    value={result.threadId}
                    onSelect={() => handleSelect(result.threadId)}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className="truncate text-sm font-medium"
                            dangerouslySetInnerHTML={{
                              __html:
                                result.titleSnippet ??
                                escapeHtml(thread?.title ?? "Untitled thread"),
                            }}
                          />
                          {project && (
                            <span className="shrink-0 text-xs text-muted-foreground/60">
                              {project.name}
                            </span>
                          )}
                        </div>
                        {result.messageSnippet && (
                          <p
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: result.messageSnippet }}
                          />
                        )}
                        {thread?.createdAt && (
                          <span className="text-[10px] text-muted-foreground/50">
                            {formatRelativeTimeString(thread.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">&uarr;&darr;</kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">&crarr;</kbd> Open
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">{modKey}K</kbd>{" "}
              Toggle
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
