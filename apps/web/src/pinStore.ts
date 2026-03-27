import type { MessageId, ThreadId } from "@codeforge/contracts";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

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
  clearPinsForThread: (threadId: ThreadId) => void;
}

export const usePinStore = create<PinState>((set) => ({
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
  clearPinsForThread: (threadId) =>
    set((state) => ({
      pins: state.pins.filter((p) => p.threadId !== threadId),
    })),
}));

export function usePinsForThread(threadId: ThreadId | undefined): Pin[] {
  return usePinStore(
    useShallow((state) =>
      threadId ? state.pins.filter((p) => p.threadId === threadId) : [],
    ),
  );
}

export function isMessagePinned(pins: Pin[], messageId: MessageId): boolean {
  return pins.some((p) => p.messageId === messageId && p.selectedText === null);
}
