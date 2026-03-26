import type { ThreadId } from "@t3tools/contracts";
import { create } from "zustand";

interface SendStatusState {
  sendingThreadIds: Set<ThreadId>;
  markSending: (threadId: ThreadId) => void;
  clearSending: (threadId: ThreadId) => void;
}

export const useSendStatusStore = create<SendStatusState>((set) => ({
  sendingThreadIds: new Set(),
  markSending: (threadId) =>
    set((state) => {
      const next = new Set(state.sendingThreadIds);
      next.add(threadId);
      return { sendingThreadIds: next };
    }),
  clearSending: (threadId) =>
    set((state) => {
      const next = new Set(state.sendingThreadIds);
      next.delete(threadId);
      return { sendingThreadIds: next };
    }),
}));
