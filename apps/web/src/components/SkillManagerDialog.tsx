import type { ProviderSlashCommand, SkillEntry } from "@codeforge/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PlusIcon, TrashIcon, ZapIcon, TerminalIcon, CpuIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { readNativeApi } from "../nativeApi";
import { serverQueryKeys } from "~/lib/serverReactQuery";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { toastManager } from "./ui/toast";
import type { ComposerSlashCommand } from "../composer-logic";

// ── Types ───────────────────────────────────────────────────────────

type SelectedSkill =
  | { type: "built-in"; name: string; description: string }
  | { type: "provider"; name: string; description: string; argumentHint: string }
  | { type: "custom"; name: string; source: "project" | "user"; content: string };

interface SkillManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCwd: string | null;
  providerCommands: ReadonlyArray<ProviderSlashCommand>;
}

// ── Constants ───────────────────────────────────────────────────────

const BUILT_IN_COMMANDS: ReadonlyArray<{ name: ComposerSlashCommand; description: string }> = [
  { name: "model", description: "Switch response model for this thread" },
  { name: "plan", description: "Switch this thread into plan mode" },
  { name: "default", description: "Switch this thread back to normal chat mode" },
  { name: "clear", description: "Start a new thread" },
  { name: "resume", description: "Search and switch to a previous thread" },
  { name: "context", description: "Show context window usage" },
];

const SKILL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

// ── Component ───────────────────────────────────────────────────────

export function SkillManagerDialog({
  open,
  onOpenChange,
  projectCwd,
  providerCommands,
}: SkillManagerDialogProps) {
  const queryClient = useQueryClient();
  const [customSkills, setCustomSkills] = useState<SkillEntry[]>([]);
  const [selected, setSelected] = useState<SelectedSkill | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newSkillSource, setNewSkillSource] = useState<"project" | "user">("project");

  /** Refresh provider slash commands so newly created/deleted skills appear in the command menu. */
  const refreshProviderCommands = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.server.refreshProviders();
      await queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
    } catch {
      // Best-effort — skill was already saved/deleted successfully
    }
  }, [queryClient]);

  const projectSkills = useMemo(
    () => customSkills.filter((s) => s.source === "project"),
    [customSkills],
  );
  const userSkills = useMemo(() => customSkills.filter((s) => s.source === "user"), [customSkills]);

  // Fetch skills when dialog opens
  useEffect(() => {
    if (!open || !projectCwd) return;
    setIsLoading(true);
    const api = readNativeApi();
    if (!api) {
      setIsLoading(false);
      return;
    }
    void api.skills
      .list({ cwd: projectCwd })
      .then((result) => {
        setCustomSkills(result.skills as SkillEntry[]);
      })
      .catch(() => {
        toastManager.add({ type: "error", title: "Failed to load skills" });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, projectCwd]);

  // Reset state when dialog closes
  useEffect(() => {
    if (open) return;
    setSelected(null);
    setEditorContent("");
    setEditorDirty(false);
    setIsCreating(false);
    setNewSkillName("");
  }, [open]);

  const selectCustomSkill = useCallback((skill: SkillEntry) => {
    setSelected({ type: "custom", name: skill.name, source: skill.source, content: skill.content });
    setEditorContent(skill.content);
    setEditorDirty(false);
    setIsCreating(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectCwd || !selected || selected.type !== "custom") return;
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.skills.save({
        cwd: projectCwd,
        name: selected.name,
        source: selected.source,
        content: editorContent,
      });
      // Update local state
      setCustomSkills((prev) =>
        prev.map((s) =>
          s.name === selected.name && s.source === selected.source
            ? {
                ...s,
                content: editorContent,
                description: editorContent.split("\n").find((l) => l.trim().length > 0) ?? "",
              }
            : s,
        ),
      );
      setSelected({ ...selected, content: editorContent });
      setEditorDirty(false);
      toastManager.add({ type: "success", title: `Saved /${selected.name}` });
      await refreshProviderCommands();
    } catch {
      toastManager.add({ type: "error", title: "Failed to save skill" });
    }
  }, [projectCwd, selected, editorContent, refreshProviderCommands]);

  const handleDelete = useCallback(async () => {
    if (!projectCwd || !selected || selected.type !== "custom") return;
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.skills.delete({
        cwd: projectCwd,
        name: selected.name,
        source: selected.source,
      });
      setCustomSkills((prev) =>
        prev.filter((s) => !(s.name === selected.name && s.source === selected.source)),
      );
      setSelected(null);
      setEditorContent("");
      setEditorDirty(false);
      toastManager.add({ type: "success", title: `Deleted /${selected.name}` });
      await refreshProviderCommands();
    } catch {
      toastManager.add({ type: "error", title: "Failed to delete skill" });
    }
  }, [projectCwd, selected, refreshProviderCommands]);

  const handleCreate = useCallback(async () => {
    if (!projectCwd || !newSkillName.trim()) return;
    const name = newSkillName.trim();
    if (!SKILL_NAME_PATTERN.test(name)) {
      toastManager.add({
        type: "warning",
        title: "Invalid skill name",
        description: "Use only letters, numbers, hyphens, and underscores.",
      });
      return;
    }
    const api = readNativeApi();
    if (!api) return;
    const template = `# ${name}\n\nDescribe what this skill does.\n`;
    try {
      await api.skills.save({
        cwd: projectCwd,
        name,
        source: newSkillSource,
        content: template,
      });
      const newSkill: SkillEntry = {
        name,
        source: newSkillSource,
        description: `# ${name}`,
        content: template,
      };
      setCustomSkills((prev) => [...prev, newSkill]);
      selectCustomSkill(newSkill);
      setNewSkillName("");
      setIsCreating(false);
      toastManager.add({ type: "success", title: `Created /${name}` });
      await refreshProviderCommands();
    } catch {
      toastManager.add({ type: "error", title: "Failed to create skill" });
    }
  }, [projectCwd, newSkillName, newSkillSource, selectCustomSkill, refreshProviderCommands]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPanel>
        <DialogPopup className="max-w-3xl p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Skill Manager</DialogTitle>
          </DialogHeader>

          <div className="flex h-[480px]">
            {/* Left panel — skill list */}
            <div className="w-56 shrink-0 overflow-y-auto border-r">
              {/* Built-in commands */}
              <SkillGroup title="Built-in">
                {BUILT_IN_COMMANDS.map((cmd) => (
                  <SkillRow
                    key={`builtin:${cmd.name}`}
                    name={cmd.name}
                    icon={<ZapIcon className="size-3.5 text-amber-500" />}
                    active={selected?.type === "built-in" && selected.name === cmd.name}
                    onClick={() => {
                      setSelected({
                        type: "built-in",
                        name: cmd.name,
                        description: cmd.description,
                      });
                      setIsCreating(false);
                    }}
                  />
                ))}
              </SkillGroup>

              {/* Provider commands */}
              {providerCommands.length > 0 && (
                <SkillGroup title="Provider">
                  {providerCommands.map((cmd) => (
                    <SkillRow
                      key={`provider:${cmd.name}`}
                      name={cmd.name}
                      icon={<CpuIcon className="size-3.5 text-blue-500" />}
                      active={selected?.type === "provider" && selected.name === cmd.name}
                      onClick={() => {
                        setSelected({
                          type: "provider",
                          name: cmd.name,
                          description: cmd.description,
                          argumentHint: cmd.argumentHint,
                        });
                        setIsCreating(false);
                      }}
                    />
                  ))}
                </SkillGroup>
              )}

              {/* Project skills */}
              <SkillGroup title="Project Skills">
                {projectSkills.map((skill) => (
                  <SkillRow
                    key={`project:${skill.name}`}
                    name={skill.name}
                    icon={<TerminalIcon className="size-3.5 text-green-500" />}
                    active={
                      selected?.type === "custom" &&
                      selected.name === skill.name &&
                      selected.source === "project"
                    }
                    onClick={() => selectCustomSkill(skill)}
                  />
                ))}
                <NewSkillButton
                  source="project"
                  isCreating={isCreating && newSkillSource === "project"}
                  newSkillName={newSkillName}
                  onChangeName={setNewSkillName}
                  onConfirm={() => void handleCreate()}
                  onCancel={() => {
                    setIsCreating(false);
                    setNewSkillName("");
                  }}
                  onStart={() => {
                    setNewSkillSource("project");
                    setIsCreating(true);
                  }}
                />
              </SkillGroup>

              {/* User skills */}
              <SkillGroup title="User Skills">
                {userSkills.map((skill) => (
                  <SkillRow
                    key={`user:${skill.name}`}
                    name={skill.name}
                    icon={<TerminalIcon className="size-3.5 text-purple-500" />}
                    active={
                      selected?.type === "custom" &&
                      selected.name === skill.name &&
                      selected.source === "user"
                    }
                    onClick={() => selectCustomSkill(skill)}
                  />
                ))}
                <NewSkillButton
                  source="user"
                  isCreating={isCreating && newSkillSource === "user"}
                  newSkillName={newSkillName}
                  onChangeName={setNewSkillName}
                  onConfirm={() => void handleCreate()}
                  onCancel={() => {
                    setIsCreating(false);
                    setNewSkillName("");
                  }}
                  onStart={() => {
                    setNewSkillSource("user");
                    setIsCreating(true);
                  }}
                />
              </SkillGroup>

              {isLoading && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Loading skills...</div>
              )}
              {!isLoading && !projectCwd && (
                <div className="px-3 py-2 text-xs text-muted-foreground/60">
                  Add a project to manage project skills.
                </div>
              )}
            </div>

            {/* Right panel — detail / editor */}
            <div className="flex flex-1 flex-col">
              {selected?.type === "custom" ? (
                <>
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <span className="text-sm font-medium">/{selected.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {selected.source === "project" ? "Project skill" : "User skill"}
                    </span>
                  </div>
                  <textarea
                    className="flex-1 resize-none bg-transparent p-4 font-mono text-sm outline-none"
                    value={editorContent}
                    onChange={(e) => {
                      setEditorContent(e.target.value);
                      setEditorDirty(true);
                    }}
                    spellCheck={false}
                  />
                  <div className="flex items-center justify-end gap-2 border-t px-4 py-2">
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
                      <TrashIcon className="mr-1 size-3.5" />
                      Delete
                    </Button>
                    <Button size="sm" disabled={!editorDirty} onClick={() => void handleSave()}>
                      Save
                    </Button>
                  </div>
                </>
              ) : selected ? (
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="text-sm font-medium">/{selected.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                  {"argumentHint" in selected && selected.argumentHint ? (
                    <p className="text-xs text-muted-foreground">
                      Usage: /{selected.name} {selected.argumentHint}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground/60">
                    {selected.type === "built-in" ? "Built-in command" : "Provider command"} — not
                    editable.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a skill to view details
                </div>
              )}
            </div>
          </div>
        </DialogPopup>
      </DialogPanel>
    </Dialog>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SkillGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {title}
      </div>
      {children}
    </div>
  );
}

function SkillRow({
  name,
  icon,
  active,
  onClick,
}: {
  name: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
      )}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">/{name}</span>
    </button>
  );
}

function NewSkillButton({
  source,
  isCreating,
  newSkillName,
  onChangeName,
  onConfirm,
  onCancel,
  onStart,
}: {
  source: "project" | "user";
  isCreating: boolean;
  newSkillName: string;
  onChangeName: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  if (isCreating) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          className="h-6 text-xs"
          placeholder="skill-name"
          value={newSkillName}
          onChange={(e) => onChangeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
      onClick={onStart}
    >
      <PlusIcon className="size-3" />
      New {source} skill
    </button>
  );
}
