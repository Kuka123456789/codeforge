import { Fragment, type ReactNode, createElement, useEffect } from "react";
import {
  type ProviderKind,
  ThreadId,
  type OrchestrationReadModel,
  type OrchestrationSessionStatus,
  type OrchestrationThreadActivity,
} from "@codeforge/contracts";
import { resolveModelSlugForProvider } from "@codeforge/shared/model";
import { create } from "zustand";
import { type ChatMessage, type Project, type Thread } from "./types";
import { Debouncer } from "@tanstack/react-pacer";

// ── State ────────────────────────────────────────────────────────────

export interface AppState {
  projects: Project[];
  threads: Thread[];
  threadsHydrated: boolean;
}

const PERSISTED_STATE_KEY = "codeforge:renderer-state:v8";
const LEGACY_PERSISTED_STATE_KEYS = [
  "codeforge:renderer-state:v7",
  "codeforge:renderer-state:v6",
  "codeforge:renderer-state:v5",
  "codeforge:renderer-state:v4",
  "codeforge:renderer-state:v3",
  "codething:renderer-state:v4",
  "codething:renderer-state:v3",
  "codething:renderer-state:v2",
  "codething:renderer-state:v1",
] as const;

const initialState: AppState = {
  projects: [],
  threads: [],
  threadsHydrated: false,
};
const persistedExpandedProjectCwds = new Set<string>();
const persistedProjectOrderCwds: string[] = [];
const persistedThreadOrderByProject = new Map<string, string[]>();

// ── Persist helpers ──────────────────────────────────────────────────

function readPersistedState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(PERSISTED_STATE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as {
      expandedProjectCwds?: string[];
      projectOrderCwds?: string[];
      threadOrderByProject?: Record<string, string[]>;
    };
    persistedExpandedProjectCwds.clear();
    persistedProjectOrderCwds.length = 0;
    persistedThreadOrderByProject.clear();
    for (const cwd of parsed.expandedProjectCwds ?? []) {
      if (typeof cwd === "string" && cwd.length > 0) {
        persistedExpandedProjectCwds.add(cwd);
      }
    }
    for (const cwd of parsed.projectOrderCwds ?? []) {
      if (typeof cwd === "string" && cwd.length > 0 && !persistedProjectOrderCwds.includes(cwd)) {
        persistedProjectOrderCwds.push(cwd);
      }
    }
    for (const [projectId, threadIds] of Object.entries(parsed.threadOrderByProject ?? {})) {
      if (typeof projectId === "string" && Array.isArray(threadIds)) {
        persistedThreadOrderByProject.set(
          projectId,
          threadIds.filter((id): id is string => typeof id === "string" && id.length > 0),
        );
      }
    }
    return { ...initialState };
  } catch {
    return initialState;
  }
}

let legacyKeysCleanedUp = false;

function persistState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PERSISTED_STATE_KEY,
      JSON.stringify({
        expandedProjectCwds: state.projects
          .filter((project) => project.expanded)
          .map((project) => project.cwd),
        projectOrderCwds: state.projects.map((project) => project.cwd),
        threadOrderByProject: Object.fromEntries(
          state.threads.reduce((acc, thread) => {
            const list = acc.get(thread.projectId) ?? [];
            list.push(thread.id);
            acc.set(thread.projectId, list);
            return acc;
          }, new Map<string, string[]>()),
        ),
      }),
    );
    if (!legacyKeysCleanedUp) {
      legacyKeysCleanedUp = true;
      for (const legacyKey of LEGACY_PERSISTED_STATE_KEYS) {
        window.localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    // Ignore quota/storage errors to avoid breaking chat UX.
  }
}
const debouncedPersistState = new Debouncer(persistState, { wait: 500 });

// ── Pure helpers ──────────────────────────────────────────────────────

function updateThread(
  threads: Thread[],
  threadId: ThreadId,
  updater: (t: Thread) => Thread,
): Thread[] {
  let changed = false;
  const next = threads.map((t) => {
    if (t.id !== threadId) return t;
    const updated = updater(t);
    if (updated !== t) changed = true;
    return updated;
  });
  return changed ? next : threads;
}

function mapProjectsFromReadModel(
  incoming: OrchestrationReadModel["projects"],
  previous: Project[],
): Project[] {
  const previousById = new Map(previous.map((project) => [project.id, project] as const));
  const previousByCwd = new Map(previous.map((project) => [project.cwd, project] as const));
  const previousOrderById = new Map(previous.map((project, index) => [project.id, index] as const));
  const previousOrderByCwd = new Map(
    previous.map((project, index) => [project.cwd, index] as const),
  );
  const persistedOrderByCwd = new Map(
    persistedProjectOrderCwds.map((cwd, index) => [cwd, index] as const),
  );
  const usePersistedOrder = previous.length === 0;

  const mappedProjects = incoming.map((project) => {
    const existing = previousById.get(project.id) ?? previousByCwd.get(project.workspaceRoot);
    return {
      id: project.id,
      name: project.title,
      cwd: project.workspaceRoot,
      defaultModelSelection:
        existing?.defaultModelSelection ??
        (project.defaultModelSelection
          ? {
              ...project.defaultModelSelection,
              model: resolveModelSlugForProvider(
                project.defaultModelSelection.provider,
                project.defaultModelSelection.model,
              ),
            }
          : null),
      expanded:
        existing?.expanded ??
        (persistedExpandedProjectCwds.size > 0
          ? persistedExpandedProjectCwds.has(project.workspaceRoot)
          : true),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      archivedAt: project.archivedAt ?? null,
      scripts: project.scripts.map((script) => ({ ...script })),
    } satisfies Project;
  });

  return mappedProjects
    .map((project, incomingIndex) => {
      const previousIndex =
        previousOrderById.get(project.id) ?? previousOrderByCwd.get(project.cwd);
      const persistedIndex = usePersistedOrder ? persistedOrderByCwd.get(project.cwd) : undefined;
      const orderIndex =
        previousIndex ??
        persistedIndex ??
        (usePersistedOrder ? persistedProjectOrderCwds.length : previous.length) + incomingIndex;
      return { project, incomingIndex, orderIndex };
    })
    .toSorted((a, b) => {
      const byOrder = a.orderIndex - b.orderIndex;
      if (byOrder !== 0) return byOrder;
      return a.incomingIndex - b.incomingIndex;
    })
    .map((entry) => entry.project);
}

function toLegacySessionStatus(
  status: OrchestrationSessionStatus,
): "connecting" | "ready" | "running" | "error" | "closed" {
  switch (status) {
    case "starting":
      return "connecting";
    case "running":
      return "running";
    case "error":
      return "error";
    case "ready":
    case "interrupted":
      return "ready";
    case "idle":
    case "stopped":
      return "closed";
  }
}

function toLegacyProvider(providerName: string | null): ProviderKind {
  if (providerName === "codex" || providerName === "claudeAgent") {
    return providerName;
  }
  return "codex";
}

function resolveWsHttpOrigin(): string {
  if (typeof window === "undefined") return "";
  const bridgeWsUrl = window.desktopBridge?.getWsUrl?.();
  const envWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const wsCandidate =
    typeof bridgeWsUrl === "string" && bridgeWsUrl.length > 0
      ? bridgeWsUrl
      : typeof envWsUrl === "string" && envWsUrl.length > 0
        ? envWsUrl
        : null;
  if (!wsCandidate) return window.location.origin;
  try {
    const wsUrl = new URL(wsCandidate);
    const protocol =
      wsUrl.protocol === "wss:" ? "https:" : wsUrl.protocol === "ws:" ? "http:" : wsUrl.protocol;
    return `${protocol}//${wsUrl.host}`;
  } catch {
    return window.location.origin;
  }
}

function toAttachmentPreviewUrl(rawUrl: string): string {
  if (rawUrl.startsWith("/")) {
    return `${resolveWsHttpOrigin()}${rawUrl}`;
  }
  return rawUrl;
}

function attachmentPreviewRoutePath(attachmentId: string): string {
  return `/attachments/${encodeURIComponent(attachmentId)}`;
}

// ── Pure state transition functions ────────────────────────────────────

export function syncServerReadModel(state: AppState, readModel: OrchestrationReadModel): AppState {
  const activeProjects = readModel.projects.filter((project) => project.deletedAt === null);
  console.log("[syncServerReadModel]", { total: readModel.projects.length, afterFilter: activeProjects.length, allArchivedAt: readModel.projects.map(p => ({ title: p.title, archivedAt: p.archivedAt, deletedAt: p.deletedAt })) });
  const projects = mapProjectsFromReadModel(
    activeProjects,
    state.projects,
  );
  console.log("[syncServerReadModel] mapped projects:", projects.length, "threads:", readModel.threads.filter((t) => t.deletedAt === null).length);
  const existingThreadById = new Map(state.threads.map((thread) => [thread.id, thread] as const));
  const threads = readModel.threads
    .filter((thread) => thread.deletedAt === null)
    .map((thread) => {
      const existing = existingThreadById.get(thread.id);
      return {
        id: thread.id,
        codexThreadId: null,
        projectId: thread.projectId,
        title: thread.title,
        titleSource: thread.titleSource,
        modelSelection: {
          ...thread.modelSelection,
          model: resolveModelSlugForProvider(
            thread.modelSelection.provider,
            thread.modelSelection.model,
          ),
        },
        runtimeMode: thread.runtimeMode,
        interactionMode: thread.interactionMode,
        session: thread.session
          ? {
              provider: toLegacyProvider(thread.session.providerName),
              status: toLegacySessionStatus(thread.session.status),
              orchestrationStatus: thread.session.status,
              activeTurnId: thread.session.activeTurnId ?? undefined,
              createdAt: thread.session.updatedAt,
              updatedAt: thread.session.updatedAt,
              ...(thread.session.lastError ? { lastError: thread.session.lastError } : {}),
            }
          : null,
        messages: thread.messages.map((message) => {
          const attachments = message.attachments?.map((attachment) => ({
            type: "image" as const,
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            previewUrl: toAttachmentPreviewUrl(attachmentPreviewRoutePath(attachment.id)),
          }));
          const normalizedMessage: ChatMessage = {
            id: message.id,
            role: message.role,
            text: message.text,
            createdAt: message.createdAt,
            streaming: message.streaming,
            ...(message.streaming ? {} : { completedAt: message.updatedAt }),
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          };
          // Prevent text "rewinding" during streaming: if the client has
          // accumulated more text via direct delta application than the
          // snapshot contains, keep the longer client-side text.
          const existingMsg = existing?.messages.find((m) => m.id === message.id);
          if (
            existingMsg &&
            existingMsg.streaming &&
            message.streaming &&
            existingMsg.text.length > normalizedMessage.text.length
          ) {
            return { ...normalizedMessage, text: existingMsg.text };
          }
          return normalizedMessage;
        }),
        proposedPlans: thread.proposedPlans.map((proposedPlan) => ({
          id: proposedPlan.id,
          turnId: proposedPlan.turnId,
          planMarkdown: proposedPlan.planMarkdown,
          implementedAt: proposedPlan.implementedAt,
          implementationThreadId: proposedPlan.implementationThreadId,
          createdAt: proposedPlan.createdAt,
          updatedAt: proposedPlan.updatedAt,
        })),
        error: thread.session?.lastError ?? null,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        archivedAt: thread.archivedAt ?? null,
        latestTurn: thread.latestTurn,
        lastVisitedAt: existing?.lastVisitedAt ?? thread.updatedAt,
        branch: thread.branch,
        worktreePath: thread.worktreePath,
        turnDiffSummaries: thread.checkpoints.map((checkpoint) => ({
          turnId: checkpoint.turnId,
          completedAt: checkpoint.completedAt,
          status: checkpoint.status,
          assistantMessageId: checkpoint.assistantMessageId ?? undefined,
          checkpointTurnCount: checkpoint.checkpointTurnCount,
          checkpointRef: checkpoint.checkpointRef,
          files: checkpoint.files.map((file) => ({ ...file })),
        })),
        activities: thread.activities.map((activity) => ({ ...activity })),
      };
    });

  // Preserve manual thread order across server syncs
  const previousThreadOrder = new Map(state.threads.map((t, i) => [t.id, i] as const));
  const usePersistedThreadOrder = state.threads.length === 0;

  threads.sort((a, b) => {
    if (a.projectId !== b.projectId) return 0;
    const aPrev = previousThreadOrder.get(a.id);
    const bPrev = previousThreadOrder.get(b.id);
    if (aPrev !== undefined && bPrev !== undefined) return aPrev - bPrev;
    if (usePersistedThreadOrder) {
      const projectOrder = persistedThreadOrderByProject.get(a.projectId);
      if (projectOrder) {
        const aIdx = projectOrder.indexOf(a.id);
        const bIdx = projectOrder.indexOf(b.id);
        if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
        if (aIdx >= 0) return -1;
        if (bIdx >= 0) return 1;
      }
    }
    return 0;
  });

  return {
    ...state,
    projects,
    threads,
    threadsHydrated: true,
  };
}

// ── Streaming delta payload ─────────────────────────────────────────
// Mirrors the fields from ThreadMessageSentPayload that the client needs
// for direct delta application without a full snapshot fetch.

export interface StreamingDeltaPayload {
  readonly threadId: ThreadId;
  readonly messageId: string;
  readonly role: "user" | "assistant" | "system";
  readonly text: string;
  readonly attachments?:
    | ReadonlyArray<{
        readonly type: "image";
        readonly id: string;
        readonly name: string;
        readonly mimeType: string;
        readonly sizeBytes: number;
      }>
    | undefined;
  readonly turnId: string | null;
  readonly streaming: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Apply a streaming text delta directly to client state, avoiding a full
 * snapshot round-trip. Mirrors the server projector logic in
 * `apps/server/src/orchestration/projector.ts` (lines 426-446).
 */
export function applyStreamingDelta(state: AppState, payload: StreamingDeltaPayload): AppState {
  const threadIndex = state.threads.findIndex((t) => t.id === payload.threadId);
  if (threadIndex === -1) {
    // Thread not yet in client state — the next snapshot sync will pick it up.
    return state;
  }

  const thread = state.threads[threadIndex]!;
  const existingMessage = thread.messages.find((m) => m.id === payload.messageId);

  let nextMessages: ChatMessage[];

  if (existingMessage) {
    // Mirror server projector: append delta when streaming, replace on finalize.
    nextMessages = thread.messages.map((m) => {
      if (m.id !== payload.messageId) return m;
      return {
        ...m,
        text: payload.streaming
          ? `${m.text}${payload.text}`
          : payload.text.length > 0
            ? payload.text
            : m.text,
        streaming: payload.streaming,
        ...(payload.streaming ? {} : { completedAt: payload.updatedAt }),
      };
    });
  } else {
    // New message — create entry (mirrors projector's append path).
    const attachments = payload.attachments?.map((a) => ({
      ...a,
      previewUrl: toAttachmentPreviewUrl(attachmentPreviewRoutePath(a.id)),
    }));
    const newMessage: ChatMessage = {
      id: payload.messageId as ChatMessage["id"],
      role: payload.role,
      text: payload.text,
      createdAt: payload.createdAt,
      streaming: payload.streaming,
      ...(payload.streaming ? {} : { completedAt: payload.updatedAt }),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
    nextMessages = [...thread.messages, newMessage];
  }

  const nextThreads = [...state.threads];
  nextThreads[threadIndex] = {
    ...thread,
    messages: nextMessages,
  };

  return { ...state, threads: nextThreads };
}

/**
 * Apply an activity event directly to client state during streaming,
 * keeping the activity feed live without a full snapshot fetch.
 */
export function applyActivityDelta(
  state: AppState,
  payload: { threadId: ThreadId; activity: OrchestrationThreadActivity },
): AppState {
  const threadIndex = state.threads.findIndex((t) => t.id === payload.threadId);
  if (threadIndex === -1) return state;

  const thread = state.threads[threadIndex]!;
  const nextThreads = [...state.threads];
  nextThreads[threadIndex] = {
    ...thread,
    activities: [...thread.activities, payload.activity],
  };
  return { ...state, threads: nextThreads };
}

export function markThreadVisited(
  state: AppState,
  threadId: ThreadId,
  visitedAt?: string,
): AppState {
  const at = visitedAt ?? new Date().toISOString();
  const visitedAtMs = Date.parse(at);
  const threads = updateThread(state.threads, threadId, (thread) => {
    const previousVisitedAtMs = thread.lastVisitedAt ? Date.parse(thread.lastVisitedAt) : NaN;
    if (
      Number.isFinite(previousVisitedAtMs) &&
      Number.isFinite(visitedAtMs) &&
      previousVisitedAtMs >= visitedAtMs
    ) {
      return thread;
    }
    return { ...thread, lastVisitedAt: at };
  });
  return threads === state.threads ? state : { ...state, threads };
}

export function markThreadUnread(state: AppState, threadId: ThreadId): AppState {
  const threads = updateThread(state.threads, threadId, (thread) => {
    if (!thread.latestTurn?.completedAt) return thread;
    const latestTurnCompletedAtMs = Date.parse(thread.latestTurn.completedAt);
    if (Number.isNaN(latestTurnCompletedAtMs)) return thread;
    const unreadVisitedAt = new Date(latestTurnCompletedAtMs - 1).toISOString();
    if (thread.lastVisitedAt === unreadVisitedAt) return thread;
    return { ...thread, lastVisitedAt: unreadVisitedAt };
  });
  return threads === state.threads ? state : { ...state, threads };
}

export function toggleProject(state: AppState, projectId: Project["id"]): AppState {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === projectId ? { ...p, expanded: !p.expanded } : p)),
  };
}

export function setProjectExpanded(
  state: AppState,
  projectId: Project["id"],
  expanded: boolean,
): AppState {
  let changed = false;
  const projects = state.projects.map((p) => {
    if (p.id !== projectId || p.expanded === expanded) return p;
    changed = true;
    return { ...p, expanded };
  });
  return changed ? { ...state, projects } : state;
}

export function reorderProjects(
  state: AppState,
  draggedProjectId: Project["id"],
  targetProjectId: Project["id"],
): AppState {
  if (draggedProjectId === targetProjectId) return state;
  const draggedIndex = state.projects.findIndex((project) => project.id === draggedProjectId);
  const targetIndex = state.projects.findIndex((project) => project.id === targetProjectId);
  if (draggedIndex < 0 || targetIndex < 0) return state;
  const projects = [...state.projects];
  const [draggedProject] = projects.splice(draggedIndex, 1);
  if (!draggedProject) return state;
  projects.splice(targetIndex, 0, draggedProject);
  return { ...state, projects };
}

export function reorderThreads(
  state: AppState,
  projectId: string,
  draggedThreadId: ThreadId,
  targetThreadId: ThreadId,
): AppState {
  if (draggedThreadId === targetThreadId) return state;
  const projectThreads = state.threads.filter((t) => t.projectId === projectId);
  const draggedIndex = projectThreads.findIndex((t) => t.id === draggedThreadId);
  const targetIndex = projectThreads.findIndex((t) => t.id === targetThreadId);
  if (draggedIndex < 0 || targetIndex < 0) return state;
  const reordered = [...projectThreads];
  const [dragged] = reordered.splice(draggedIndex, 1);
  if (!dragged) return state;
  reordered.splice(targetIndex, 0, dragged);
  // Rebuild the flat array preserving relative position of other projects' threads
  const threads: Thread[] = [];
  let reorderedIdx = 0;
  for (const t of state.threads) {
    if (t.projectId === projectId) {
      threads.push(reordered[reorderedIdx]!);
      reorderedIdx++;
    } else {
      threads.push(t);
    }
  }
  return { ...state, threads };
}

export function setError(state: AppState, threadId: ThreadId, error: string | null): AppState {
  const threads = updateThread(state.threads, threadId, (t) => {
    if (t.error === error) return t;
    return { ...t, error };
  });
  return threads === state.threads ? state : { ...state, threads };
}

export function setThreadBranch(
  state: AppState,
  threadId: ThreadId,
  branch: string | null,
  worktreePath: string | null,
): AppState {
  const threads = updateThread(state.threads, threadId, (t) => {
    if (t.branch === branch && t.worktreePath === worktreePath) return t;
    const cwdChanged = t.worktreePath !== worktreePath;
    return {
      ...t,
      branch,
      worktreePath,
      ...(cwdChanged ? { session: null } : {}),
    };
  });
  return threads === state.threads ? state : { ...state, threads };
}

// ── Zustand store ────────────────────────────────────────────────────

interface AppStore extends AppState {
  syncServerReadModel: (readModel: OrchestrationReadModel) => void;
  applyStreamingDelta: (payload: StreamingDeltaPayload) => void;
  applyActivityDelta: (payload: {
    threadId: ThreadId;
    activity: OrchestrationThreadActivity;
  }) => void;
  markThreadVisited: (threadId: ThreadId, visitedAt?: string) => void;
  markThreadUnread: (threadId: ThreadId) => void;
  toggleProject: (projectId: Project["id"]) => void;
  setProjectExpanded: (projectId: Project["id"], expanded: boolean) => void;
  reorderProjects: (draggedProjectId: Project["id"], targetProjectId: Project["id"]) => void;
  reorderThreads: (projectId: string, draggedThreadId: ThreadId, targetThreadId: ThreadId) => void;
  setError: (threadId: ThreadId, error: string | null) => void;
  setThreadBranch: (threadId: ThreadId, branch: string | null, worktreePath: string | null) => void;
}

export const useStore = create<AppStore>((set) => ({
  ...readPersistedState(),
  syncServerReadModel: (readModel) => set((state) => syncServerReadModel(state, readModel)),
  applyStreamingDelta: (payload) => set((state) => applyStreamingDelta(state, payload)),
  applyActivityDelta: (payload) => set((state) => applyActivityDelta(state, payload)),
  markThreadVisited: (threadId, visitedAt) =>
    set((state) => markThreadVisited(state, threadId, visitedAt)),
  markThreadUnread: (threadId) => set((state) => markThreadUnread(state, threadId)),
  toggleProject: (projectId) => set((state) => toggleProject(state, projectId)),
  setProjectExpanded: (projectId, expanded) =>
    set((state) => setProjectExpanded(state, projectId, expanded)),
  reorderProjects: (draggedProjectId, targetProjectId) =>
    set((state) => reorderProjects(state, draggedProjectId, targetProjectId)),
  reorderThreads: (projectId, draggedThreadId, targetThreadId) =>
    set((state) => reorderThreads(state, projectId, draggedThreadId, targetThreadId)),
  setError: (threadId, error) => set((state) => setError(state, threadId, error)),
  setThreadBranch: (threadId, branch, worktreePath) =>
    set((state) => setThreadBranch(state, threadId, branch, worktreePath)),
}));

// Persist state changes with debouncing to avoid localStorage thrashing
useStore.subscribe((state) => debouncedPersistState.maybeExecute(state));

// Flush pending writes synchronously before page unload to prevent data loss.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    debouncedPersistState.flush();
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    persistState(useStore.getState());
  }, []);
  return createElement(Fragment, null, children);
}
