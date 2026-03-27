# Skill Manager — Implementation Plan

## Overview

A skill manager UI that lets users view all slash commands and manage custom skills (`.claude/skills/{name}/SKILL.md`). Accessible via a "Skills" button in the sidebar footer, it opens a two-panel dialog showing all commands grouped by type.

## UI Design

```
┌─────────────────────────────────────────────────────┐
│  Skill Manager                                  ✕   │
├───────────────────┬─────────────────────────────────┤
│                   │                                 │
│  Built-in         │  /clear                         │
│    /model      ○  │                                 │
│    /plan       ○  │  Start a new thread.            │
│    /default    ○  │                                 │
│    /clear      ●  │  Type: Built-in                 │
│    /resume     ○  │  Not editable.                  │
│    /context    ○  │                                 │
│                   │                                 │
│  Provider         │                                 │
│    /compact    ○  │                                 │
│    /bug        ○  │                                 │
│                   │                                 │
│  Project Skills   │                                 │
│    /my-skill   ○  │                                 │
│    /deploy     ○  │                                 │
│   [+ New skill]   │                                 │
│                   │                                 │
│  User Skills      │                                 │
│    /global-x   ○  │                                 │
│                   │                                 │
├───────────────────┴─────────────────────────────────┤
│                                   [Delete]   [Save] │
└─────────────────────────────────────────────────────┘
```

### Behavior

- **Built-in** (`/model`, `/plan`, `/default`, `/clear`, `/resume`, `/context`): read-only, shows description.
- **Provider** (from SDK `supportedCommands()`): read-only, shows description + argument hint.
- **Project Skills** (`.claude/skills/*/SKILL.md`): full CRUD — edit content, delete, create new.
- **User Skills** (`~/.claude/skills/*/SKILL.md`): editable — shared across projects.
- Save/Delete buttons only visible for editable (project/user) skills.
- "New skill" button opens an inline name input; creates `.claude/skills/{name}/SKILL.md` with a template.

---

## Phase 1: Contracts (`packages/contracts`)

### 1a. New schemas in `packages/contracts/src/project.ts`

Add after existing `ProjectWriteFileResult`:

```ts
export const ProjectReadFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectReadFileInput = typeof ProjectReadFileInput.Type;

export const ProjectReadFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  contents: Schema.String,
  exists: Schema.Boolean,
});
export type ProjectReadFileResult = typeof ProjectReadFileResult.Type;

export const ProjectDeleteFileInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString.check(Schema.isMaxLength(PROJECT_WRITE_FILE_PATH_MAX_LENGTH)),
});
export type ProjectDeleteFileInput = typeof ProjectDeleteFileInput.Type;

export const ProjectDeleteFileResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
});
export type ProjectDeleteFileResult = typeof ProjectDeleteFileResult.Type;
```

### 1b. New file `packages/contracts/src/skills.ts`

```ts
import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

const SkillSource = Schema.Literals(["project", "user"]);

export const SkillEntry = Schema.Struct({
  name: TrimmedNonEmptyString,
  source: SkillSource,
  description: Schema.String,
  content: Schema.String,
});
export type SkillEntry = typeof SkillEntry.Type;

export const SkillsListInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type SkillsListInput = typeof SkillsListInput.Type;

export const SkillsListResult = Schema.Struct({
  skills: Schema.Array(SkillEntry),
});
export type SkillsListResult = typeof SkillsListResult.Type;
```

### 1c. Register WS methods in `packages/contracts/src/ws.ts`

Add to `WS_METHODS`:

```ts
// Project file operations
projectsReadFile: "projects.readFile",
projectsDeleteFile: "projects.deleteFile",

// Skills
skillsList: "skills.list",
```

Add to `WebSocketRequestBody` union:

```ts
tagRequestBody(WS_METHODS.projectsReadFile, ProjectReadFileInput),
tagRequestBody(WS_METHODS.projectsDeleteFile, ProjectDeleteFileInput),
tagRequestBody(WS_METHODS.skillsList, SkillsListInput),
```

### 1d. Extend `NativeApi` in `packages/contracts/src/ipc.ts`

```ts
projects: {
  searchEntries: (input: ProjectSearchEntriesInput) => Promise<ProjectSearchEntriesResult>;
  writeFile: (input: ProjectWriteFileInput) => Promise<ProjectWriteFileResult>;
  readFile: (input: ProjectReadFileInput) => Promise<ProjectReadFileResult>;
  deleteFile: (input: ProjectDeleteFileInput) => Promise<ProjectDeleteFileResult>;
}
skills: {
  list: (input: SkillsListInput) => Promise<SkillsListResult>;
}
```

### 1e. Export new schemas from `packages/contracts/src/index.ts`

Add the new schemas and types to the barrel export.

---

## Phase 2: Server Handlers (`apps/server`)

### 2a. `projects.readFile` handler in `apps/server/src/wsServer.ts`

After the `projectsWriteFile` case:

```ts
case WS_METHODS.projectsReadFile: {
  const body = stripRequestTag(request.body);
  const target = yield* resolveWorkspaceWritePath({
    workspaceRoot: body.cwd,
    relativePath: body.relativePath,
    path,
  });
  const exists = yield* fileSystem.exists(target.absolutePath);
  if (!exists) {
    return { relativePath: target.relativePath, contents: "", exists: false };
  }
  const contents = yield* fileSystem.readFileString(target.absolutePath).pipe(
    Effect.mapError(
      (cause) => new RouteRequestError({
        message: `Failed to read workspace file: ${String(cause)}`,
      }),
    ),
  );
  return { relativePath: target.relativePath, contents, exists: true };
}
```

### 2b. `projects.deleteFile` handler

```ts
case WS_METHODS.projectsDeleteFile: {
  const body = stripRequestTag(request.body);
  const target = yield* resolveWorkspaceWritePath({
    workspaceRoot: body.cwd,
    relativePath: body.relativePath,
    path,
  });
  yield* fileSystem.remove(target.absolutePath).pipe(
    Effect.mapError(
      (cause) => new RouteRequestError({
        message: `Failed to delete workspace file: ${String(cause)}`,
      }),
    ),
  );
  return { relativePath: target.relativePath };
}
```

### 2c. `skills.list` handler

A dedicated handler that scans both project and user skill directories:

```ts
case WS_METHODS.skillsList: {
  const body = stripRequestTag(request.body);
  const skills: Array<{ name: string; source: "project" | "user"; description: string; content: string }> = [];

  const scanSkillsDir = (dir: string, source: "project" | "user") =>
    Effect.gen(function* () {
      const exists = yield* fileSystem.exists(dir);
      if (!exists) return;
      const entries = yield* fileSystem.readDirectory(dir);
      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = yield* fileSystem.stat(entryPath);
        if (!stat.type || stat.type !== "Directory") continue;
        const skillMdPath = path.join(entryPath, "SKILL.md");
        const skillExists = yield* fileSystem.exists(skillMdPath);
        if (!skillExists) continue;
        const content = yield* fileSystem.readFileString(skillMdPath).pipe(
          Effect.catchAll(() => Effect.succeed("")),
        );
        const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
        skills.push({ name: entry, source, description: firstLine, content });
      }
    }).pipe(Effect.catchAll(() => Effect.void));

  const projectSkillsDir = path.join(body.cwd, ".claude", "skills");
  const userSkillsDir = path.join(os.homedir(), ".claude", "skills");

  yield* scanSkillsDir(projectSkillsDir, "project");
  yield* scanSkillsDir(userSkillsDir, "user");

  return { skills };
}
```

Note: `os` import and `fileSystem` service are already available in the wsServer context.

---

## Phase 3: Client Transport (`apps/web`)

### 3a. Wire in `apps/web/src/wsNativeApi.ts`

Extend the `projects` object:

```ts
projects: {
  searchEntries: (input) => transport.request(WS_METHODS.projectsSearchEntries, input),
  writeFile: (input) => transport.request(WS_METHODS.projectsWriteFile, input),
  readFile: (input) => transport.request(WS_METHODS.projectsReadFile, input),
  deleteFile: (input) => transport.request(WS_METHODS.projectsDeleteFile, input),
},
skills: {
  list: (input) => transport.request(WS_METHODS.skillsList, input),
},
```

---

## Phase 4: UI Components (`apps/web`)

### 4a. New component: `apps/web/src/components/SkillManagerDialog.tsx`

**Props:**

```ts
interface SkillManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCwd: string | null;
  builtInCommands: ReadonlyArray<{ name: string; description: string }>;
  providerCommands: ReadonlyArray<{ name: string; description: string; argumentHint: string }>;
}
```

**Internal state:**

```ts
const [skills, setSkills] = useState<SkillEntry[]>([]);
const [selectedSkill, setSelectedSkill] = useState<SelectedSkill | null>(null);
const [editorContent, setEditorContent] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [newSkillName, setNewSkillName] = useState("");
const [isCreating, setIsCreating] = useState(false);
```

Where `SelectedSkill` is:

```ts
type SelectedSkill =
  | { type: "built-in"; name: string; description: string }
  | { type: "provider"; name: string; description: string; argumentHint: string }
  | { type: "custom"; name: string; source: "project" | "user"; content: string };
```

**Key behaviors:**

1. **On open**: Call `api.skills.list({ cwd })` to fetch custom skills.
2. **On select custom skill**: Populate editor with `skill.content`.
3. **On save**: Call `api.projects.writeFile({ cwd: resolvedCwd, relativePath: ".claude/skills/{name}/SKILL.md", contents })`. For user skills, the server needs to resolve `~/.claude/skills/` (handled by a `scope` flag or the `skills.save` endpoint).
4. **On delete**: Call `api.projects.deleteFile(...)` + remove from local state.
5. **On create new**: Validate name (alphanumeric + hyphens), write template SKILL.md, refresh list.
6. **On save/delete success**: Show toast via `toastManager.add(...)`.

**Layout (using existing UI primitives):**

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogBackdrop />
  <DialogPopup className="max-w-3xl">
    <div className="flex h-[500px]">
      {/* Left panel: skill list */}
      <div className="w-56 border-r overflow-y-auto">
        <SkillGroup title="Built-in" items={builtInCommands} />
        <SkillGroup title="Provider" items={providerCommands} />
        <SkillGroup title="Project Skills" items={projectSkills} editable />
        <SkillGroup title="User Skills" items={userSkills} editable />
      </div>
      {/* Right panel: detail/editor */}
      <div className="flex-1 flex flex-col p-4">
        {selectedSkill?.type === "custom" ? (
          <>
            <textarea value={editorContent} onChange={...} className="flex-1 font-mono text-sm" />
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </>
        ) : selectedSkill ? (
          <div className="text-sm text-muted-foreground">
            <p>{selectedSkill.description}</p>
            <p className="mt-2">Type: {selectedSkill.type} · Not editable</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Select a skill to view details.</p>
        )}
      </div>
    </div>
  </DialogPopup>
</Dialog>
```

### 4b. Add "Skills" button to sidebar footer

In `apps/web/src/components/Sidebar.tsx`, inside `SidebarFooter > SidebarMenu`, add before the Settings button:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    size="sm"
    className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
    onClick={() => setSkillManagerOpen(true)}
  >
    <ZapIcon className="size-3.5" />
    <span className="text-xs">Skills</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

Mount the dialog:

```tsx
<SkillManagerDialog
  open={skillManagerOpen}
  onOpenChange={setSkillManagerOpen}
  projectCwd={activeProject?.cwd ?? null}
  builtInCommands={BUILT_IN_COMMANDS}
  providerCommands={providerSlashCommands}
/>
```

---

## Phase 5: Saving User-Scope Skills

For user-level skills (`~/.claude/skills/`), the generic `projects.writeFile` won't work because it validates paths relative to a project `cwd`. Two options:

**Option A (simple):** Add a `skills.save` and `skills.delete` WS method that accept `{ name, source, content }` and resolve the path server-side based on `source`. This keeps home-directory access scoped to the skills system.

**Option B (generic):** Pass `cwd: os.homedir()` from the server config (already available as `ServerConfig.homePath` or similar). Less secure but simpler.

**Recommendation:** Option A — dedicated `skills.save` and `skills.delete` endpoints. This avoids exposing arbitrary home directory writes through `projects.writeFile`.

If going with Option A, add to contracts:

```ts
// ws.ts
skillsSave: "skills.save",
skillsDelete: "skills.delete",

// skills.ts
export const SkillsSaveInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillSource,
  content: Schema.String,
});

export const SkillsDeleteInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillSource,
});
```

---

## File Summary

| File                                             | Change                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `packages/contracts/src/project.ts`              | Add `ProjectReadFileInput/Result`, `ProjectDeleteFileInput/Result`                       |
| `packages/contracts/src/skills.ts`               | New file: `SkillEntry`, `SkillsListInput/Result`, `SkillsSaveInput`, `SkillsDeleteInput` |
| `packages/contracts/src/ws.ts`                   | Add 5 WS methods + `tagRequestBody` entries                                              |
| `packages/contracts/src/ipc.ts`                  | Extend `NativeApi` with `readFile`, `deleteFile`, `skills.*`                             |
| `packages/contracts/src/index.ts`                | Export new schemas                                                                       |
| `apps/server/src/wsServer.ts`                    | Add 5 case handlers                                                                      |
| `apps/web/src/wsNativeApi.ts`                    | Wire 5 new transport methods                                                             |
| `apps/web/src/components/SkillManagerDialog.tsx` | New component (~200 lines)                                                               |
| `apps/web/src/components/Sidebar.tsx`            | Add Skills button + mount dialog                                                         |

## Implementation Order

1. **Contracts** — schemas, WS methods, NativeApi types
2. **Server** — `skills.list`, `projects.readFile`, `projects.deleteFile`, `skills.save`, `skills.delete`
3. **Client transport** — wire in wsNativeApi.ts
4. **UI** — `SkillManagerDialog` + sidebar button
5. **Polish** — error handling, toasts, loading states
