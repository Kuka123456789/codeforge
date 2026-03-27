import type { MessageId, ThreadId } from "@codeforge/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { createDebouncedStorage, createMemoryStorage } from "./lib/storage";

export interface Pin {
  id: string;
  threadId: ThreadId;
  messageId: MessageId;
  messageRole: "user" | "assistant";
  selectedText: string | null;
  fullMessageText: string;
  createdAt: string;
}

interface PinState {
  pins: Pin[];
  addPin: (pin: Omit<Pin, "id" | "createdAt">) => void;
  removePin: (pinId: string) => void;
  togglePin: (pin: Omit<Pin, "id" | "createdAt">) => string | null;
  clearPinsForThread: (threadId: ThreadId) => void;
}

const PIN_STORAGE_KEY = "codeforge:pins:v1";
const PIN_PERSIST_DEBOUNCE_MS = 300;

const pinDebouncedStorage = createDebouncedStorage(
  typeof localStorage !== "undefined" ? localStorage : createMemoryStorage(),
  PIN_PERSIST_DEBOUNCE_MS,
);

// Flush pending pin writes before page unload to prevent data loss.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    pinDebouncedStorage.flush();
  });
}

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      pins: [],
      addPin: (pin) =>
        set((state) => ({
          pins: [
            ...state.pins,
            {
              ...pin,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      removePin: (pinId) =>
        set((state) => ({
          pins: state.pins.filter((p) => p.id !== pinId),
        })),
      togglePin: (pin) => {
        const existing = get().pins.find(
          (p) =>
            p.threadId === pin.threadId &&
            p.messageId === pin.messageId &&
            p.selectedText === null &&
            pin.selectedText === null,
        );
        if (existing) {
          set((state) => ({
            pins: state.pins.filter((p) => p.id !== existing.id),
          }));
          return existing.id;
        }
        const id = crypto.randomUUID();
        set((state) => ({
          pins: [
            ...state.pins,
            {
              ...pin,
              id,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        return null;
      },
      clearPinsForThread: (threadId) =>
        set((state) => ({
          pins: state.pins.filter((p) => p.threadId !== threadId),
        })),
    }),
    {
      name: PIN_STORAGE_KEY,
      storage: createJSONStorage(() => pinDebouncedStorage),
      partialize: (state) => ({ pins: state.pins }),
    },
  ),
);

export function usePinsForThread(threadId: ThreadId | undefined): Pin[] {
  return usePinStore(
    useShallow((state) => (threadId ? state.pins.filter((p) => p.threadId === threadId) : [])),
  );
}

export function isMessagePinned(pins: Pin[], messageId: MessageId): boolean {
  return pins.some((p) => p.messageId === messageId && p.selectedText === null);
}
