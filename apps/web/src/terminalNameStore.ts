/**
 * Lightweight Zustand store for user-assigned terminal names.
 *
 * Kept separate from terminalStateStore to avoid widening its
 * ThreadTerminalState shape (which is referenced across many
 * normalization / equality helpers).
 *
 * Key structure: `${threadId}:${terminalId}` → custom name.
 */

import type { ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const STORAGE_KEY = "t3code:terminal-names:v1";

function nameKey(threadId: ThreadId, terminalId: string): string {
  return `${threadId}:${terminalId}`;
}

interface TerminalNameStoreState {
  names: Record<string, string>;
  getTerminalName: (threadId: ThreadId, terminalId: string) => string | undefined;
  renameTerminal: (threadId: ThreadId, terminalId: string, name: string) => void;
  clearTerminalName: (threadId: ThreadId, terminalId: string) => void;
  removeOrphanedNames: (activeThreadIds: Set<ThreadId>) => void;
}

export const useTerminalNameStore = create<TerminalNameStoreState>()(
  persist(
    (set, get) => ({
      names: {},
      getTerminalName: (threadId, terminalId) => get().names[nameKey(threadId, terminalId)],
      renameTerminal: (threadId, terminalId, name) => {
        const trimmed = name.trim();
        set((state) => {
          const key = nameKey(threadId, terminalId);
          if (trimmed.length === 0) {
            if (!(key in state.names)) return state;
            const { [key]: _removed, ...rest } = state.names;
            return { names: rest };
          }
          if (state.names[key] === trimmed) return state;
          return { names: { ...state.names, [key]: trimmed } };
        });
      },
      clearTerminalName: (threadId, terminalId) => {
        set((state) => {
          const key = nameKey(threadId, terminalId);
          if (!(key in state.names)) return state;
          const { [key]: _removed, ...rest } = state.names;
          return { names: rest };
        });
      },
      removeOrphanedNames: (activeThreadIds) => {
        set((state) => {
          const entries = Object.entries(state.names);
          const filtered = entries.filter(([key]) => {
            const colonIndex = key.indexOf(":");
            if (colonIndex < 0) return false;
            const tid = key.slice(0, colonIndex) as ThreadId;
            return activeThreadIds.has(tid);
          });
          if (filtered.length === entries.length) return state;
          return { names: Object.fromEntries(filtered) };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ names: state.names }),
    },
  ),
);

/**
 * Hook to get a map of terminalId → display label for a thread.
 * Custom names take priority over the default "Terminal N" labels.
 */
export function useTerminalLabels(threadId: ThreadId, terminalIds: string[]): Map<string, string> {
  const names = useTerminalNameStore((state) => state.names);
  const labelMap = new Map<string, string>();
  for (let i = 0; i < terminalIds.length; i++) {
    const terminalId = terminalIds[i]!;
    const key = nameKey(threadId, terminalId);
    labelMap.set(terminalId, names[key] ?? `Terminal ${i + 1}`);
  }
  return labelMap;
}
