import "../index.css";

import {
  ORCHESTRATION_WS_METHODS,
  type MessageId,
  type OrchestrationReadModel,
  type ProjectId,
  type ServerConfig,
  type ThreadId,
  type WsWelcomePayload,
  WS_CHANNELS,
  WS_METHODS,
} from "@codeforge/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { ws, http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useComposerDraftStore } from "../composerDraftStore";
import { getRouter } from "../router";
import { useStore } from "../store";

// ── Constants ──────────────────────────────────────────────────────────

const THREAD_ID = "thread-skill-manager-test" as ThreadId;
const PROJECT_ID = "project-1" as ProjectId;
const NOW_ISO = "2026-03-04T12:00:00.000Z";
const PROJECT_CWD = "/repo/project";

// ── Fixtures ───────────────────────────────────────────────────────────

interface TestFixture {
  snapshot: OrchestrationReadModel;
  serverConfig: ServerConfig;
  welcome: WsWelcomePayload;
}

interface WsRequestEnvelope {
  id: string;
  body: { _tag: string; [key: string]: unknown };
}

let fixture: TestFixture;
const wsRequests: WsRequestEnvelope["body"][] = [];
const wsLink = ws.link(/ws(s)?:\/\/.*/);

/** Skills returned by the mock skills.list handler. */
let mockSkillsList: Array<{
  name: string;
  source: "project" | "user";
  description: string;
  content: string;
}> = [];

/** Track skills.save calls. */
let skillsSaveCalls: Array<{ name: string; source: string; content: string }> = [];

/** Track skills.delete calls. */
let skillsDeleteCalls: Array<{ name: string; source: string }> = [];

/** Track server.refreshProviders calls. */
let refreshProvidersCalls = 0;

/** Whether skills.list should error. */
let skillsListShouldFail = false;
/** Whether skills.save should error. */
let skillsSaveShouldFail = false;
/** Whether skills.delete should error. */
let skillsDeleteShouldFail = false;

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: PROJECT_CWD,
    keybindingsConfigPath: `${PROJECT_CWD}/.codeforge-keybindings.json`,
    keybindings: [],
    issues: [],
    providers: [
      {
        provider: "codex",
        enabled: true,
        installed: true,
        version: "0.116.0",
        status: "ready",
        authStatus: "authenticated",
        checkedAt: NOW_ISO,
        models: [],
        slashCommands: [
          { name: "compact", description: "Compact context window", argumentHint: "" },
          { name: "bug", description: "Report a bug", argumentHint: "<description>" },
        ],
      },
    ],
    availableEditors: [],
    settings: {
      enableAssistantStreaming: false,
      defaultThreadEnvMode: "local" as const,
      textGenerationModelSelection: { provider: "codex" as const, model: "gpt-5.4-mini" },
      providers: {
        codex: { enabled: true, binaryPath: "", homePath: "", customModels: [] },
        claudeAgent: { enabled: true, binaryPath: "", customModels: [] },
      },
    },
  };
}

function createMinimalSnapshot(): OrchestrationReadModel {
  return {
    snapshotSequence: 1,
    projects: [
      {
        id: PROJECT_ID,
        title: "Project",
        workspaceRoot: PROJECT_CWD,
        defaultModelSelection: { provider: "codex", model: "gpt-5" },
        scripts: [],
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        deletedAt: null,
        archivedAt: null,
      },
    ],
    threads: [
      {
        id: THREAD_ID,
        projectId: PROJECT_ID,
        title: "Test thread",
        titleSource: "auto",
        modelSelection: { provider: "codex", model: "gpt-5" },
        interactionMode: "default",
        runtimeMode: "full-access",
        branch: "main",
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        deletedAt: null,
        archivedAt: null,
        messages: [
          {
            id: "msg-1" as MessageId,
            role: "user",
            text: "hello",
            turnId: null,
            streaming: false,
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
        ],
        activities: [],
        proposedPlans: [],
        checkpoints: [],
        session: {
          threadId: THREAD_ID,
          status: "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: NOW_ISO,
        },
      },
    ],
    updatedAt: NOW_ISO,
  };
}

function buildFixture(): TestFixture {
  return {
    snapshot: createMinimalSnapshot(),
    serverConfig: createBaseServerConfig(),
    welcome: {
      cwd: PROJECT_CWD,
      projectName: "Project",
      bootstrapProjectId: PROJECT_ID,
      bootstrapThreadId: THREAD_ID,
    },
  };
}

function resolveWsRpc(body: WsRequestEnvelope["body"]): unknown {
  const tag = body._tag;
  if (tag === ORCHESTRATION_WS_METHODS.getSnapshot) return fixture.snapshot;
  if (tag === WS_METHODS.serverGetConfig) return fixture.serverConfig;
  if (tag === WS_METHODS.gitListBranches) {
    return {
      isRepo: true,
      hasOriginRemote: true,
      branches: [{ name: "main", current: true, isDefault: true, worktreePath: null }],
    };
  }
  if (tag === WS_METHODS.gitStatus) {
    return {
      branch: "main",
      hasWorkingTreeChanges: false,
      workingTree: { files: [], insertions: 0, deletions: 0 },
      hasUpstream: true,
      aheadCount: 0,
      behindCount: 0,
      pr: null,
    };
  }
  if (tag === WS_METHODS.projectsSearchEntries) return { entries: [], truncated: false };
  if (tag === WS_METHODS.skillsList) {
    if (skillsListShouldFail) throw new Error("skills.list failed");
    return { skills: mockSkillsList };
  }
  if (tag === WS_METHODS.skillsSave) {
    if (skillsSaveShouldFail) throw new Error("skills.save failed");
    skillsSaveCalls.push({
      name: body.name as string,
      source: body.source as string,
      content: body.content as string,
    });
    return { name: body.name };
  }
  if (tag === WS_METHODS.skillsDelete) {
    if (skillsDeleteShouldFail) throw new Error("skills.delete failed");
    skillsDeleteCalls.push({ name: body.name as string, source: body.source as string });
    return { name: body.name };
  }
  if (tag === WS_METHODS.serverRefreshProviders) {
    refreshProvidersCalls++;
    return {};
  }
  return {};
}

const worker = setupWorker(
  wsLink.addEventListener("connection", ({ client }) => {
    client.send(
      JSON.stringify({
        type: "push",
        sequence: 1,
        channel: WS_CHANNELS.serverWelcome,
        data: fixture.welcome,
      }),
    );
    client.addEventListener("message", (event) => {
      const rawData = event.data;
      if (typeof rawData !== "string") return;
      let request: WsRequestEnvelope;
      try {
        request = JSON.parse(rawData) as WsRequestEnvelope;
      } catch {
        return;
      }
      const method = request.body?._tag;
      if (typeof method !== "string") return;
      wsRequests.push(request.body);
      try {
        const result = resolveWsRpc(request.body);
        client.send(JSON.stringify({ id: request.id, result }));
      } catch (err) {
        client.send(
          JSON.stringify({
            id: request.id,
            error: { message: (err as Error).message },
          }),
        );
      }
    });
  }),
  http.get("*/attachments/:attachmentId", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/project-favicon", () => new HttpResponse(null, { status: 204 })),
);

// ── Helpers ────────────────────────────────────────────────────────────

async function waitForElement<T extends Element>(
  query: () => T | null,
  errorMessage: string,
  timeout = 8_000,
): Promise<T> {
  let element: T | null = null;
  await vi.waitFor(
    () => {
      element = query();
      expect(element, errorMessage).toBeTruthy();
    },
    { timeout, interval: 16 },
  );
  return element!;
}

async function waitForNoElement(query: () => Element | null, timeout = 2_000): Promise<void> {
  await vi.waitFor(
    () => {
      expect(query()).toBeNull();
    },
    { timeout, interval: 16 },
  );
}

async function waitForTextContent(text: string, timeout = 8_000): Promise<Element> {
  return waitForElement(
    () =>
      Array.from(document.querySelectorAll("*")).find(
        (el) => el.textContent?.includes(text) && el.children.length === 0,
      ) ?? null,
    `Expected text "${text}" to appear`,
    timeout,
  );
}

function queryToastTitles(): string[] {
  return Array.from(document.querySelectorAll('[data-slot="toast-title"]')).map(
    (el) => el.textContent ?? "",
  );
}

async function waitForToast(title: string, timeout = 4_000): Promise<void> {
  await vi.waitFor(
    () => {
      expect(
        queryToastTitles().some((t) => t.includes(title)),
        `Expected toast "${title}"`,
      ).toBe(true);
    },
    { timeout, interval: 16 },
  );
}

async function waitForComposerEditor(): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>('[contenteditable="true"]'),
    "Composer editor should render",
  );
}

async function mountApp(): Promise<{ cleanup: () => Promise<void> }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.display = "grid";
  host.style.overflow = "hidden";
  document.body.append(host);

  const router = getRouter(createMemoryHistory({ initialEntries: [`/${THREAD_ID}`] }));
  const screen = await render(<RouterProvider router={router} />, { container: host });
  await waitForComposerEditor();

  return {
    cleanup: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

async function openSkillManager(): Promise<void> {
  const skillsButton = await waitForElement(
    () =>
      Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Skills",
      ) ?? null,
    "Skills button should exist in sidebar",
  );
  skillsButton.click();
  await waitForElement(
    () => document.querySelector('[role="dialog"]'),
    "Skill Manager dialog should open",
  );
}

async function clickSkillRow(name: string): Promise<void> {
  const row = await waitForElement(
    () =>
      Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === `/${name}`,
      ) ?? null,
    `Skill row "/${name}" should exist`,
  );
  row.click();
  // Wait for the right panel to update
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function clickNewSkillButton(source: "project" | "user"): Promise<void> {
  const button = await waitForElement(
    () =>
      Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === `New ${source} skill`,
      ) ?? null,
    `"New ${source} skill" button should exist`,
  );
  button.click();
}

async function typeInInput(placeholder: string, text: string): Promise<HTMLInputElement> {
  const input = await waitForElement(
    () => document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`),
    `Input with placeholder "${placeholder}" should exist`,
  );
  // Simulate typing by setting value and dispatching input event
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeInputValueSetter.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return input;
}

async function pressEnter(element: HTMLElement): Promise<void> {
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

async function pressEscape(element: HTMLElement): Promise<void> {
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("SkillManagerDialog", () => {
  beforeAll(async () => {
    fixture = buildFixture();
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      serviceWorker: { url: "/mockServiceWorker.js" },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    wsRequests.length = 0;
    mockSkillsList = [];
    skillsSaveCalls = [];
    skillsDeleteCalls = [];
    refreshProvidersCalls = 0;
    skillsListShouldFail = false;
    skillsSaveShouldFail = false;
    skillsDeleteShouldFail = false;
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
    });
    useStore.setState({
      projects: [],
      threads: [],
      threadsHydrated: false,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // ── Rendering ──────────────────────────────────────────────────────

  it("opens the Skill Manager dialog from the sidebar Skills button", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      const title = document.querySelector('[role="dialog"]')?.textContent;
      expect(title).toContain("Skill Manager");
    } finally {
      await mounted.cleanup();
    }
  });

  it("displays all 6 built-in commands", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      const builtIns = ["model", "plan", "default", "clear", "resume", "context"];
      for (const name of builtIns) {
        const row = Array.from(document.querySelectorAll("button")).find(
          (btn) => btn.textContent?.trim() === `/${name}`,
        );
        expect(row, `Built-in "/${name}" should be visible`).toBeTruthy();
      }
    } finally {
      await mounted.cleanup();
    }
  });

  it("displays provider slash commands from the server config", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      // Provider commands "compact" and "bug" are in the fixture
      for (const name of ["compact", "bug"]) {
        const row = Array.from(document.querySelectorAll("button")).find(
          (btn) => btn.textContent?.trim() === `/${name}`,
        );
        expect(row, `Provider command "/${name}" should be visible`).toBeTruthy();
      }
    } finally {
      await mounted.cleanup();
    }
  });

  it("displays custom project and user skills from API", async () => {
    mockSkillsList = [
      {
        name: "deploy",
        source: "project",
        description: "# deploy",
        content: "# deploy\n\nDeploy the app.\n",
      },
      {
        name: "global-lint",
        source: "user",
        description: "# global-lint",
        content: "# global-lint\n\nRun linting everywhere.\n",
      },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      // Wait for skills to load
      await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "/deploy",
          ) ?? null,
        'Project skill "/deploy" should appear after loading',
      );
      const userSkill = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "/global-lint",
      );
      expect(userSkill, 'User skill "/global-lint" should be visible').toBeTruthy();
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Selecting skills ──────────────────────────────────────────────

  it("shows read-only detail when selecting a built-in command", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("clear");
      await waitForTextContent("not editable");
      const detail = document.querySelector('[role="dialog"]')?.textContent;
      expect(detail).toContain("/clear");
      expect(detail).toContain("Built-in command");
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows read-only detail with argument hint for provider commands", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("bug");
      await waitForTextContent("not editable");
      const detail = document.querySelector('[role="dialog"]')?.textContent;
      expect(detail).toContain("/bug");
      expect(detail).toContain("Provider command");
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows editable textarea when selecting a custom skill", async () => {
    mockSkillsList = [
      { name: "test-skill", source: "project", description: "# test", content: "# test\n\nHi.\n" },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("test-skill");
      const textarea = await waitForElement(
        () => document.querySelector("textarea"),
        "Textarea editor should appear for custom skill",
      );
      expect(textarea.value).toBe("# test\n\nHi.\n");
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows empty state message when no skill is selected", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await waitForTextContent("Select a skill to view details");
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Creating skills ───────────────────────────────────────────────

  it("creates a new project skill via the New project skill button", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("project");
      const input = await typeInInput("skill-name", "my-new-skill");
      await pressEnter(input);

      await waitForToast("Created /my-new-skill");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.name).toBe("my-new-skill");
      expect(skillsSaveCalls[0]!.source).toBe("project");
      expect(skillsSaveCalls[0]!.content).toContain("# my-new-skill");

      // Verify the skill now appears in the list
      const row = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "/my-new-skill",
      );
      expect(row, "New skill should appear in the list").toBeTruthy();
    } finally {
      await mounted.cleanup();
    }
  });

  it("creates a new user skill via the New user skill button", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("user");
      const input = await typeInInput("skill-name", "my-user-skill");
      await pressEnter(input);

      await waitForToast("Created /my-user-skill");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.source).toBe("user");
    } finally {
      await mounted.cleanup();
    }
  });

  it("cancels skill creation on Escape", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("project");
      const input = await waitForElement(
        () => document.querySelector<HTMLInputElement>('input[placeholder="skill-name"]'),
        "Name input should appear",
      );
      await pressEscape(input);

      // Input should disappear, "New project skill" button should reappear
      await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "New project skill",
          ) ?? null,
        "New project skill button should reappear after cancel",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("rejects invalid skill names with a warning toast", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("project");
      const input = await typeInInput("skill-name", "invalid name with spaces");
      await pressEnter(input);

      await waitForToast("Invalid skill name");
      expect(skillsSaveCalls).toHaveLength(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows error toast when skill creation fails", async () => {
    skillsSaveShouldFail = true;
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("project");
      const input = await typeInInput("skill-name", "fail-skill");
      await pressEnter(input);

      await waitForToast("Failed to create skill");
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Saving skills ─────────────────────────────────────────────────

  it("saves edited skill content and shows success toast", async () => {
    mockSkillsList = [
      {
        name: "editable",
        source: "project",
        description: "# editable",
        content: "# editable\n\nOriginal content.\n",
      },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("editable");

      const textarea = await waitForElement(
        () => document.querySelector("textarea"),
        "Textarea should appear",
      );

      // Modify content
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      nativeSetter.call(textarea, "# editable\n\nUpdated content.\n");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));

      // Save button should now be enabled
      const saveBtn = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "Save" && !(btn as HTMLButtonElement).disabled,
          ) ?? null,
        "Save button should be enabled after editing",
      );
      saveBtn.click();

      await waitForToast("Saved /editable");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.content).toContain("Updated content");
    } finally {
      await mounted.cleanup();
    }
  });

  it("disables save button when content has not changed", async () => {
    mockSkillsList = [
      { name: "unchanged", source: "project", description: "# unchanged", content: "# unchanged" },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("unchanged");

      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      const saveBtn = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Save",
      ) as HTMLButtonElement | undefined;
      expect(saveBtn, "Save button should exist").toBeTruthy();
      expect(saveBtn!.disabled, "Save button should be disabled when content unchanged").toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Deleting skills ───────────────────────────────────────────────

  it("deletes a custom skill and removes it from the list", async () => {
    mockSkillsList = [
      {
        name: "to-delete",
        source: "project",
        description: "# to-delete",
        content: "# to-delete\n\nWill be deleted.\n",
      },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("to-delete");

      const deleteBtn = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "Delete",
          ) ?? null,
        "Delete button should appear for custom skill",
      );
      deleteBtn.click();

      await waitForToast("Deleted /to-delete");
      expect(skillsDeleteCalls).toHaveLength(1);
      expect(skillsDeleteCalls[0]!.name).toBe("to-delete");

      // Skill should be removed from list
      await waitForNoElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "/to-delete",
          ) ?? null,
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows error toast when skill deletion fails", async () => {
    mockSkillsList = [
      { name: "fail-del", source: "project", description: "# fail-del", content: "# fail-del" },
    ];
    skillsDeleteShouldFail = true;
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("fail-del");

      const deleteBtn = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "Delete",
          ) ?? null,
        "Delete button should appear",
      );
      deleteBtn.click();

      await waitForToast("Failed to delete skill");
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Provider refresh ──────────────────────────────────────────────

  it("refreshes provider commands after creating a skill", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickNewSkillButton("project");
      const input = await typeInInput("skill-name", "refresh-test");
      await pressEnter(input);

      await waitForToast("Created /refresh-test");

      // Wait for the refresh call to be made
      await vi.waitFor(
        () => {
          expect(refreshProvidersCalls).toBeGreaterThanOrEqual(1);
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("refreshes provider commands after deleting a skill", async () => {
    mockSkillsList = [
      {
        name: "del-refresh",
        source: "project",
        description: "# del",
        content: "# del-refresh",
      },
    ];
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await clickSkillRow("del-refresh");

      const deleteBtn = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "Delete",
          ) ?? null,
        "Delete button should appear",
      );
      deleteBtn.click();

      await waitForToast("Deleted /del-refresh");
      await vi.waitFor(
        () => {
          expect(refreshProvidersCalls).toBeGreaterThanOrEqual(1);
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Group labels ──────────────────────────────────────────────────

  it("displays all four skill group headings", async () => {
    const mounted = await mountApp();
    try {
      await openSkillManager();
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("Built-in");
      expect(dialogText).toContain("Provider");
      expect(dialogText).toContain("Project Skills");
      expect(dialogText).toContain("User Skills");
    } finally {
      await mounted.cleanup();
    }
  });

  // ── Error handling ────────────────────────────────────────────────

  it("shows error toast when skills list fails to load", async () => {
    skillsListShouldFail = true;
    const mounted = await mountApp();
    try {
      await openSkillManager();
      await waitForToast("Failed to load skills");
    } finally {
      await mounted.cleanup();
    }
  });

  // ── No project state ─────────────────────────────────────────────

  it("shows helper message when no project is active", async () => {
    // Override fixture to have no projects
    const originalSnapshot = fixture.snapshot;
    fixture.snapshot = {
      ...originalSnapshot,
      projects: [],
      threads: [],
    };

    const mounted = await mountApp();
    try {
      // Since there are no projects, the sidebar might look different.
      // We still need to find and click the Skills button.
      const skillsButton = await waitForElement(
        () =>
          Array.from(document.querySelectorAll("button")).find(
            (btn) => btn.textContent?.trim() === "Skills",
          ) ?? null,
        "Skills button should exist even with no projects",
      );
      skillsButton.click();
      await waitForElement(() => document.querySelector('[role="dialog"]'), "Dialog should open");

      // Should show the helper message
      await waitForTextContent("Add a project to manage project skills");
    } finally {
      fixture.snapshot = originalSnapshot;
      await mounted.cleanup();
    }
  });
});
