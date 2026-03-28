import "../index.css";

import type { NativeApi } from "@codeforge/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useState } from "react";
import { SkillManagerDialog } from "./SkillManagerDialog";

// ── Constants ──────────────────────────────────────────────────────────

const PROJECT_CWD = "/repo/project";

// ── Mock tracking state ────────────────────────────────────────────────

let mockSkillsList: Array<{
  name: string;
  source: "project" | "user";
  description: string;
  content: string;
}> = [];

let skillsSaveCalls: Array<{ name: string; source: string; content: string }> = [];
let skillsDeleteCalls: Array<{ name: string; source: string }> = [];
let refreshProvidersCalls = 0;

let skillsListShouldFail = false;
let skillsSaveShouldFail = false;
let skillsDeleteShouldFail = false;

// ── Mock NativeApi ─────────────────────────────────────────────────────
//
// We create a SINGLE mock instance and install it on `window.nativeApi`
// before any test runs. The `readNativeApi()` function caches the first
// result at module scope, so it will hold a reference to this object for
// the entire test suite. Individual mock methods read from the mutable
// flag/tracking variables defined above, so resetting those in `beforeEach`
// is sufficient to get fresh behavior per test.

const mockNativeApi = {
  skills: {
    list: async () => {
      if (skillsListShouldFail) throw new Error("skills.list failed");
      return { skills: mockSkillsList };
    },
    save: async (input: { name: string; source: string; content: string }) => {
      if (skillsSaveShouldFail) throw new Error("skills.save failed");
      skillsSaveCalls.push({
        name: input.name,
        source: input.source,
        content: input.content,
      });
      return { name: input.name };
    },
    delete: async (input: { name: string; source: string }) => {
      if (skillsDeleteShouldFail) throw new Error("skills.delete failed");
      skillsDeleteCalls.push({ name: input.name, source: input.source });
      return { name: input.name };
    },
  },
  server: {
    getConfig: async () => ({
      cwd: PROJECT_CWD,
      keybindingsConfigPath: "",
      keybindings: [],
      issues: [],
      providers: [],
      availableEditors: [],
      settings: {
        enableAssistantStreaming: false,
        defaultThreadEnvMode: "local" as const,
        textGenerationModelSelection: { provider: "codex" as const, model: "gpt-5" },
        providers: {
          codex: { enabled: true, binaryPath: "", homePath: "", customModels: [] },
          claudeAgent: { enabled: true, binaryPath: "", customModels: [] },
        },
      },
    }),
    refreshProviders: async () => {
      refreshProvidersCalls++;
      return {};
    },
    updateSettings: async () => ({}),
  },
  orchestration: { dispatchCommand: async () => ({}), getSnapshot: async () => ({}) },
  projects: {
    searchEntries: async () => ({ entries: [], truncated: false }),
    writeFile: async () => ({}),
    readFile: async () => ({ relativePath: "", contents: "", exists: false }),
    deleteFile: async () => ({}),
  },
  git: {
    status: async () => ({}),
    pull: async () => ({}),
    listBranches: async () => ({}),
    createBranch: async () => ({}),
    createWorktree: async () => ({}),
    removeWorktree: async () => ({}),
    checkoutBranch: async () => ({}),
    deleteBranch: async () => ({}),
    commit: async () => ({}),
    push: async () => ({}),
    fetch: async () => ({}),
  },
  shell: {
    openInEditor: async () => ({}),
    openExternal: async () => ({}),
    showContextMenu: async () => ({}),
  },
  terminal: {
    open: async () => ({}),
    close: async () => ({}),
    resize: async () => ({}),
    write: async () => ({}),
  },
} as unknown as NativeApi;

// Install immediately so readNativeApi() picks it up on first call
(window as any).nativeApi = mockNativeApi;

// ── Test harness ───────────────────────────────────────────────────────

function TestHarness({
  projectCwd = PROJECT_CWD,
  providerCommands = [],
}: {
  projectCwd?: string | null;
  providerCommands?: Array<{ name: string; description: string; argumentHint: string }>;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={queryClient}>
      <SkillManagerDialog
        open={open}
        onOpenChange={setOpen}
        projectCwd={projectCwd}
        providerCommands={providerCommands}
      />
    </QueryClientProvider>
  );
}

async function renderDialog(
  props?: Parameters<typeof TestHarness>[0],
): Promise<ReturnType<typeof render>> {
  const screen = await render(<TestHarness {...props} />);
  // Wait for the dialog to be visible
  await vi.waitFor(
    () => {
      expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    },
    { timeout: 4_000, interval: 16 },
  );
  // Give effects time to run (skills.list fetch)
  await new Promise((resolve) => setTimeout(resolve, 200));
  return screen;
}

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
        `Expected toast "${title}", found: [${queryToastTitles().join(", ")}]`,
      ).toBe(true);
    },
    { timeout, interval: 16 },
  );
}

function findButton(text: string): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === text,
    ) as HTMLButtonElement | undefined) ?? null
  );
}

async function clickButton(text: string): Promise<HTMLButtonElement> {
  const btn = await waitForElement(() => findButton(text), `Button "${text}" should exist`);
  btn.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return btn;
}

async function typeInInput(placeholder: string, text: string): Promise<HTMLInputElement> {
  const input = await waitForElement(
    () => document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`),
    `Input with placeholder "${placeholder}" should exist`,
  );
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return input;
}

function pressKey(element: HTMLElement, key: string): void {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function editTextarea(value: string): void {
  const textarea = document.querySelector("textarea");
  if (!textarea) throw new Error("No textarea found");
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("SkillManagerDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockSkillsList = [];
    skillsSaveCalls = [];
    skillsDeleteCalls = [];
    refreshProvidersCalls = 0;
    skillsListShouldFail = false;
    skillsSaveShouldFail = false;
    skillsDeleteShouldFail = false;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // ── Rendering ──────────────────────────────────────────────────────

  it("renders the dialog with title", async () => {
    const screen = await renderDialog();
    try {
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain("Skill Manager");
    } finally {
      screen.unmount();
    }
  });

  it("displays all 6 built-in commands", async () => {
    const screen = await renderDialog();
    try {
      for (const name of ["model", "plan", "default", "clear", "resume", "context"]) {
        expect(findButton(`/${name}`), `Built-in "/${name}" should be visible`).toBeTruthy();
      }
    } finally {
      screen.unmount();
    }
  });

  it("displays provider slash commands", async () => {
    const screen = await renderDialog({
      providerCommands: [
        { name: "compact", description: "Compact context", argumentHint: "" },
        { name: "bug", description: "Report a bug", argumentHint: "<description>" },
      ],
    });
    try {
      expect(findButton("/compact")).toBeTruthy();
      expect(findButton("/bug")).toBeTruthy();
    } finally {
      screen.unmount();
    }
  });

  it("hides provider section when no provider commands exist", async () => {
    const screen = await renderDialog({ providerCommands: [] });
    try {
      const dialog = document.querySelector('[role="dialog"]');
      // "Provider" heading should not be in the dialog
      const headings = Array.from(dialog?.querySelectorAll("div") ?? []).filter(
        (div) => div.textContent?.trim() === "Provider" && div.children.length === 0,
      );
      expect(headings).toHaveLength(0);
    } finally {
      screen.unmount();
    }
  });

  it("displays custom project and user skills from API", async () => {
    mockSkillsList = [
      { name: "deploy", source: "project", description: "# deploy", content: "# deploy\nDeploy." },
      {
        name: "global-lint",
        source: "user",
        description: "# global-lint",
        content: "# global-lint\nLint.",
      },
    ];
    const screen = await renderDialog();
    try {
      await waitForElement(
        () => findButton("/deploy"),
        'Project skill "/deploy" should appear after loading',
      );
      expect(findButton("/global-lint")).toBeTruthy();
    } finally {
      screen.unmount();
    }
  });

  it("displays all four skill group headings", async () => {
    const screen = await renderDialog({
      providerCommands: [{ name: "x", description: "x", argumentHint: "" }],
    });
    try {
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("Built-in");
      expect(dialogText).toContain("Provider");
      expect(dialogText).toContain("Project Skills");
      expect(dialogText).toContain("User Skills");
    } finally {
      screen.unmount();
    }
  });

  // ── Selecting skills ──────────────────────────────────────────────

  it("shows empty state message when no skill is selected", async () => {
    const screen = await renderDialog();
    try {
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("Select a skill to view details");
    } finally {
      screen.unmount();
    }
  });

  it("shows read-only detail when selecting a built-in command", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("/clear");
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("/clear");
      expect(dialogText).toContain("Built-in command");
      expect(dialogText).toContain("not editable");
    } finally {
      screen.unmount();
    }
  });

  it("shows read-only detail for provider commands with argument hint", async () => {
    const screen = await renderDialog({
      providerCommands: [
        { name: "bug", description: "Report a bug", argumentHint: "<description>" },
      ],
    });
    try {
      await clickButton("/bug");
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("/bug");
      expect(dialogText).toContain("Provider command");
      expect(dialogText).toContain("<description>");
    } finally {
      screen.unmount();
    }
  });

  it("shows editable textarea when selecting a custom skill", async () => {
    mockSkillsList = [
      {
        name: "test-skill",
        source: "project",
        description: "# test",
        content: "# test\n\nHello world.\n",
      },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/test-skill");
      const textarea = await waitForElement(
        () => document.querySelector("textarea"),
        "Textarea should appear for custom skill",
      );
      expect(textarea.value).toBe("# test\n\nHello world.\n");
    } finally {
      screen.unmount();
    }
  });

  it("shows source label for custom skills", async () => {
    mockSkillsList = [
      { name: "proj-s", source: "project", description: "# proj", content: "# proj" },
      { name: "user-s", source: "user", description: "# user", content: "# user" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/proj-s");
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Project skill");

      await clickButton("/user-s");
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain("User skill");
    } finally {
      screen.unmount();
    }
  });

  // ── Creating skills ───────────────────────────────────────────────

  it("creates a new project skill via the New project skill button", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "my-new-skill");
      pressKey(input, "Enter");

      await waitForToast("Created /my-new-skill");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.name).toBe("my-new-skill");
      expect(skillsSaveCalls[0]!.source).toBe("project");
      expect(skillsSaveCalls[0]!.content).toContain("# my-new-skill");

      // Verify it appears in the list
      expect(findButton("/my-new-skill")).toBeTruthy();
    } finally {
      screen.unmount();
    }
  });

  it("creates a new user skill via the New user skill button", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New user skill");
      const input = await typeInInput("skill-name", "my-user-skill");
      pressKey(input, "Enter");

      await waitForToast("Created /my-user-skill");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.source).toBe("user");
    } finally {
      screen.unmount();
    }
  });

  it("cancels skill creation on Escape", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await waitForElement(
        () => document.querySelector<HTMLInputElement>('input[placeholder="skill-name"]'),
        "Name input should appear",
      );
      pressKey(input, "Escape");

      await waitForElement(
        () => findButton("New project skill"),
        "New project skill button should reappear after cancel",
      );
    } finally {
      screen.unmount();
    }
  });

  it("rejects invalid skill names with a warning toast", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "bad name!");
      pressKey(input, "Enter");

      await waitForToast("Invalid skill name");
      expect(skillsSaveCalls).toHaveLength(0);
    } finally {
      screen.unmount();
    }
  });

  it("rejects skill names starting with a hyphen", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "-invalid");
      pressKey(input, "Enter");

      await waitForToast("Invalid skill name");
      expect(skillsSaveCalls).toHaveLength(0);
    } finally {
      screen.unmount();
    }
  });

  it("shows error toast when skill creation fails", async () => {
    skillsSaveShouldFail = true;
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "fail-skill");
      pressKey(input, "Enter");

      await waitForToast("Failed to create skill");
    } finally {
      screen.unmount();
    }
  });

  // ── Saving skills ─────────────────────────────────────────────────

  it("saves edited skill content and shows success toast", async () => {
    mockSkillsList = [
      {
        name: "editable",
        source: "project",
        description: "# editable",
        content: "# editable\n\nOriginal.\n",
      },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/editable");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      editTextarea("# editable\n\nUpdated content.\n");
      await clickButton("Save");

      await waitForToast("Saved /editable");
      expect(skillsSaveCalls).toHaveLength(1);
      expect(skillsSaveCalls[0]!.content).toContain("Updated content");
    } finally {
      screen.unmount();
    }
  });

  it("disables save button when content has not changed", async () => {
    mockSkillsList = [
      { name: "unchanged", source: "project", description: "# unchanged", content: "# unchanged" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/unchanged");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      const saveBtn = findButton("Save") as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      expect(saveBtn.disabled).toBe(true);
    } finally {
      screen.unmount();
    }
  });

  it("shows error toast when skill save fails", async () => {
    mockSkillsList = [
      {
        name: "fail-save",
        source: "project",
        description: "# fail-save",
        content: "# fail-save",
      },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/fail-save");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      editTextarea("# fail-save\n\nNew content.");
      skillsSaveShouldFail = true;
      await clickButton("Save");

      await waitForToast("Failed to save skill");
    } finally {
      screen.unmount();
    }
  });

  // ── Deleting skills ───────────────────────────────────────────────

  it("deletes a custom skill and removes it from the list", async () => {
    mockSkillsList = [
      { name: "to-delete", source: "project", description: "# to-delete", content: "# to-delete" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/to-delete");
      await clickButton("Delete");

      await waitForToast("Deleted /to-delete");
      expect(skillsDeleteCalls).toHaveLength(1);
      expect(skillsDeleteCalls[0]!.name).toBe("to-delete");

      await waitForNoElement(() => findButton("/to-delete"));
    } finally {
      screen.unmount();
    }
  });

  it("shows error toast when skill deletion fails", async () => {
    mockSkillsList = [
      { name: "fail-del", source: "project", description: "# fail-del", content: "# fail-del" },
    ];
    skillsDeleteShouldFail = true;
    const screen = await renderDialog();
    try {
      await clickButton("/fail-del");
      await clickButton("Delete");

      await waitForToast("Failed to delete skill");
    } finally {
      screen.unmount();
    }
  });

  it("clears selection and editor after deletion", async () => {
    mockSkillsList = [
      { name: "del-clear", source: "project", description: "# del-clear", content: "# del-clear" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/del-clear");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      await clickButton("Delete");
      await waitForToast("Deleted /del-clear");

      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("Select a skill to view details");
    } finally {
      screen.unmount();
    }
  });

  // ── Provider refresh ──────────────────────────────────────────────

  it("refreshes providers after creating a skill", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "refresh-test");
      pressKey(input, "Enter");

      await waitForToast("Created /refresh-test");
      await vi.waitFor(() => expect(refreshProvidersCalls).toBeGreaterThanOrEqual(1), {
        timeout: 4_000,
        interval: 16,
      });
    } finally {
      screen.unmount();
    }
  });

  it("refreshes providers after deleting a skill", async () => {
    mockSkillsList = [
      { name: "del-ref", source: "project", description: "# del", content: "# del-ref" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/del-ref");
      await clickButton("Delete");

      await waitForToast("Deleted /del-ref");
      await vi.waitFor(() => expect(refreshProvidersCalls).toBeGreaterThanOrEqual(1), {
        timeout: 4_000,
        interval: 16,
      });
    } finally {
      screen.unmount();
    }
  });

  it("refreshes providers after saving a skill", async () => {
    mockSkillsList = [
      { name: "save-ref", source: "project", description: "# save-ref", content: "# save-ref" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/save-ref");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      editTextarea("# save-ref\n\nNew content.");
      await clickButton("Save");

      await waitForToast("Saved /save-ref");
      await vi.waitFor(() => expect(refreshProvidersCalls).toBeGreaterThanOrEqual(1), {
        timeout: 4_000,
        interval: 16,
      });
    } finally {
      screen.unmount();
    }
  });

  // ── Error handling ────────────────────────────────────────────────

  it("shows error toast when skills list fails to load", async () => {
    skillsListShouldFail = true;
    const screen = await renderDialog();
    try {
      await waitForToast("Failed to load skills");
    } finally {
      screen.unmount();
    }
  });

  // ── No project state ─────────────────────────────────────────────

  it("shows helper message when no project CWD is provided", async () => {
    const screen = await renderDialog({ projectCwd: null });
    try {
      const dialogText = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(dialogText).toContain("Add a project to manage project skills");
    } finally {
      screen.unmount();
    }
  });

  it("still shows built-in commands when no project CWD is provided", async () => {
    const screen = await renderDialog({ projectCwd: null });
    try {
      expect(findButton("/clear")).toBeTruthy();
      expect(findButton("/model")).toBeTruthy();
    } finally {
      screen.unmount();
    }
  });
});
