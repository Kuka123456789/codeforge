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

const mockNativeApi = {
  skills: {
    list: async () => {
      if (skillsListShouldFail) throw new Error("skills.list failed");
      return { skills: mockSkillsList };
    },
    save: async (input: { name: string; source: string; content: string }) => {
      if (skillsSaveShouldFail) throw new Error("skills.save failed");
      skillsSaveCalls.push({ name: input.name, source: input.source, content: input.content });
      return { name: input.name };
    },
    delete: async (input: { name: string; source: string }) => {
      if (skillsDeleteShouldFail) throw new Error("skills.delete failed");
      skillsDeleteCalls.push({ name: input.name, source: input.source });
      return { name: input.name };
    },
  },
  server: {
    getConfig: async () => ({}),
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
  git: {},
  shell: {},
  terminal: {},
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
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy(), {
    timeout: 4_000,
    interval: 16,
  });
  // Give effects time to run (skills.list fetch)
  await new Promise((resolve) => setTimeout(resolve, 300));
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
  await vi.waitFor(() => expect(query()).toBeNull(), { timeout, interval: 16 });
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

/** Wait for the mock API to have been called. */
async function waitForApiCalls(
  getter: () => number,
  minCalls: number,
  timeout = 4_000,
): Promise<void> {
  await vi.waitFor(() => expect(getter()).toBeGreaterThanOrEqual(minCalls), {
    timeout,
    interval: 16,
  });
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
      // Check no "Provider" group heading exists
      const headings = Array.from(document.querySelectorAll('[role="dialog"] div')).filter(
        (el) => el.textContent?.trim() === "PROVIDER" || el.textContent?.trim() === "Provider",
      );
      // Should only appear as part of "Provider commands" etc., not as standalone heading
      expect(headings.filter((h) => h.children.length === 0)).toHaveLength(0);
    } finally {
      screen.unmount();
    }
  });

  it("displays custom project and user skills from API", async () => {
    mockSkillsList = [
      { name: "deploy", source: "project", description: "# deploy", content: "# deploy\nDeploy." },
      { name: "global-lint", source: "user", description: "# global", content: "# global\nLint." },
    ];
    const screen = await renderDialog();
    try {
      await waitForElement(() => findButton("/deploy"), "/deploy should appear after loading");
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
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "Select a skill to view details",
      );
    } finally {
      screen.unmount();
    }
  });

  it("shows read-only detail when selecting a built-in command", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("/clear");
      const text = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(text).toContain("/clear");
      expect(text).toContain("Built-in command");
      expect(text).toContain("not editable");
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
      const text = document.querySelector('[role="dialog"]')?.textContent ?? "";
      expect(text).toContain("/bug");
      expect(text).toContain("Provider command");
      expect(text).toContain("<description>");
    } finally {
      screen.unmount();
    }
  });

  it("shows editable textarea when selecting a custom skill", async () => {
    mockSkillsList = [
      { name: "test-skill", source: "project", description: "# t", content: "# test\n\nHi.\n" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/test-skill");
      const textarea = await waitForElement(
        () => document.querySelector("textarea"),
        "Textarea should appear",
      );
      expect(textarea.value).toBe("# test\n\nHi.\n");
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

      await waitForApiCalls(() => skillsSaveCalls.length, 1);
      expect(skillsSaveCalls[0]!.name).toBe("my-new-skill");
      expect(skillsSaveCalls[0]!.source).toBe("project");
      expect(skillsSaveCalls[0]!.content).toContain("# my-new-skill");

      // New skill should appear in the list
      await waitForElement(() => findButton("/my-new-skill"), "New skill should appear in list");
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

      await waitForApiCalls(() => skillsSaveCalls.length, 1);
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
        "New project skill button should reappear",
      );
    } finally {
      screen.unmount();
    }
  });

  it("rejects invalid skill names (no API call made)", async () => {
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "bad name!");
      pressKey(input, "Enter");

      // Wait a beat to ensure nothing was called
      await new Promise((resolve) => setTimeout(resolve, 300));
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

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(skillsSaveCalls).toHaveLength(0);
    } finally {
      screen.unmount();
    }
  });

  it("does not create skill when API fails", async () => {
    skillsSaveShouldFail = true;
    const screen = await renderDialog();
    try {
      await clickButton("New project skill");
      const input = await typeInInput("skill-name", "fail-skill");
      pressKey(input, "Enter");

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The skill should NOT appear in the list since save failed
      expect(findButton("/fail-skill")).toBeNull();
    } finally {
      screen.unmount();
    }
  });

  // ── Saving skills ─────────────────────────────────────────────────

  it("saves edited skill content", async () => {
    mockSkillsList = [
      { name: "editable", source: "project", description: "# e", content: "# editable\nOrig.\n" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/editable");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      editTextarea("# editable\n\nUpdated content.\n");
      await clickButton("Save");

      await waitForApiCalls(() => skillsSaveCalls.length, 1);
      expect(skillsSaveCalls[0]!.content).toContain("Updated content");
    } finally {
      screen.unmount();
    }
  });

  it("disables save button when content has not changed", async () => {
    mockSkillsList = [
      { name: "unchanged", source: "project", description: "# u", content: "# unchanged" },
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

  // ── Deleting skills ───────────────────────────────────────────────

  it("deletes a custom skill and removes it from the list", async () => {
    mockSkillsList = [
      { name: "to-delete", source: "project", description: "# d", content: "# to-delete" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/to-delete");
      await clickButton("Delete");

      await waitForApiCalls(() => skillsDeleteCalls.length, 1);
      expect(skillsDeleteCalls[0]!.name).toBe("to-delete");

      // Skill removed from list
      await waitForNoElement(() => findButton("/to-delete"));
    } finally {
      screen.unmount();
    }
  });

  it("clears selection and editor after deletion", async () => {
    mockSkillsList = [
      { name: "del-clear", source: "project", description: "# d", content: "# del-clear" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/del-clear");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      await clickButton("Delete");
      await waitForApiCalls(() => skillsDeleteCalls.length, 1);

      // Should return to empty state
      await vi.waitFor(
        () => {
          expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
            "Select a skill to view details",
          );
        },
        { timeout: 4_000, interval: 16 },
      );
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

      await waitForApiCalls(() => skillsSaveCalls.length, 1);
      await waitForApiCalls(() => refreshProvidersCalls, 1);
    } finally {
      screen.unmount();
    }
  });

  it("refreshes providers after deleting a skill", async () => {
    mockSkillsList = [
      { name: "del-ref", source: "project", description: "# d", content: "# del-ref" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/del-ref");
      await clickButton("Delete");

      await waitForApiCalls(() => skillsDeleteCalls.length, 1);
      await waitForApiCalls(() => refreshProvidersCalls, 1);
    } finally {
      screen.unmount();
    }
  });

  it("refreshes providers after saving a skill", async () => {
    mockSkillsList = [
      { name: "save-ref", source: "project", description: "# s", content: "# save-ref" },
    ];
    const screen = await renderDialog();
    try {
      await clickButton("/save-ref");
      await waitForElement(() => document.querySelector("textarea"), "Textarea should appear");

      editTextarea("# save-ref\n\nNew content.");
      await clickButton("Save");

      await waitForApiCalls(() => skillsSaveCalls.length, 1);
      await waitForApiCalls(() => refreshProvidersCalls, 1);
    } finally {
      screen.unmount();
    }
  });

  // ── No project state ─────────────────────────────────────────────

  it("shows helper message when no project CWD is provided", async () => {
    const screen = await renderDialog({ projectCwd: null });
    try {
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "Add a project to manage project skills",
      );
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
