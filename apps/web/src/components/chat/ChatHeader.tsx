import {
  type EditorId,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
} from "@codeforge/contracts";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import GitActionsControl from "../GitActionsControl";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ClipboardCopyIcon,
  DiffIcon,
  EllipsisIcon,
  HashIcon,
  PencilIcon,
  TerminalSquareIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Toggle } from "../ui/toggle";
import { SidebarTrigger } from "../ui/sidebar";
import { OpenInPicker } from "./OpenInPicker";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  isArchived: boolean;
  workspacePath: string | null;
  isGitRepo: boolean;
  openInCwd: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  diffToggleShortcutLabel: string | null;
  gitCwd: string | null;
  diffOpen: boolean;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onToggleTerminal: () => void;
  onToggleDiff: () => void;
  onRenameThread?: (threadId: ThreadId, newTitle: string) => Promise<void>;
  onArchiveThread?: (threadId: ThreadId) => Promise<void>;
  onUnarchiveThread?: (threadId: ThreadId) => Promise<void>;
  onDeleteThread?: (threadId: ThreadId) => Promise<void>;
  onCopyPath?: (path: string) => void;
  onCopyThreadId?: (threadId: ThreadId) => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
  activeProjectName,
  isArchived,
  workspacePath,
  isGitRepo,
  openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  diffToggleShortcutLabel,
  gitCwd,
  diffOpen,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onToggleTerminal,
  onToggleDiff,
  onRenameThread,
  onArchiveThread,
  onUnarchiveThread,
  onDeleteThread,
  onCopyPath,
  onCopyThreadId,
}: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(activeThreadTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(activeThreadTitle);
  }, [activeThreadTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitRename = useCallback(async () => {
    const trimmed = editValue.trim();
    setIsEditing(false);
    if (trimmed.length === 0 || trimmed === activeThreadTitle) {
      setEditValue(activeThreadTitle);
      return;
    }
    if (onRenameThread) {
      await onRenameThread(activeThreadId, trimmed);
    }
  }, [editValue, activeThreadTitle, activeThreadId, onRenameThread]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              if (e.key === "Escape") {
                setEditValue(activeThreadTitle);
                setIsEditing(false);
              }
            }}
            className="w-full min-w-0 flex-1 border-b border-foreground/30 bg-transparent text-sm font-medium text-foreground outline-none focus:border-foreground"
          />
        ) : (
          <h2
            className="min-w-0 shrink cursor-pointer truncate text-sm font-medium text-foreground hover:text-foreground/80"
            title="Click to rename"
            onClick={() => setIsEditing(true)}
          >
            {activeThreadTitle}
          </h2>
        )}
        {activeProjectName && (
          <Badge variant="outline" className="min-w-0 shrink truncate">
            {activeProjectName}
          </Badge>
        )}
        {activeProjectName && !isGitRepo && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700">
            No Git
          </Badge>
        )}
      </div>
      <div className="@container/header-actions flex min-w-0 flex-1 items-center justify-end gap-2 @sm/header-actions:gap-3">
        {activeProjectScripts && (
          <ProjectScriptsControl
            scripts={activeProjectScripts}
            keybindings={keybindings}
            preferredScriptId={preferredScriptId}
            onRunScript={onRunProjectScript}
            onAddScript={onAddProjectScript}
            onUpdateScript={onUpdateProjectScript}
            onDeleteScript={onDeleteProjectScript}
          />
        )}
        {activeProjectName && (
          <OpenInPicker
            keybindings={keybindings}
            availableEditors={availableEditors}
            openInCwd={openInCwd}
          />
        )}
        {activeProjectName && <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThreadId} />}
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={terminalOpen}
                onPressedChange={onToggleTerminal}
                aria-label="Toggle terminal drawer"
                variant="outline"
                size="xs"
                disabled={!terminalAvailable}
              >
                <TerminalSquareIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!terminalAvailable
              ? "Terminal is unavailable until this thread has an active project."
              : terminalToggleShortcutLabel
                ? `Toggle terminal drawer (${terminalToggleShortcutLabel})`
                : "Toggle terminal drawer"}
          </TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={diffOpen}
                onPressedChange={onToggleDiff}
                aria-label="Toggle diff panel"
                variant="outline"
                size="xs"
                disabled={!isGitRepo}
              >
                <DiffIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!isGitRepo
              ? "Diff panel is unavailable because this project is not a git repository."
              : diffToggleShortcutLabel
                ? `Toggle diff panel (${diffToggleShortcutLabel})`
                : "Toggle diff panel"}
          </TooltipPopup>
        </Tooltip>
        <Menu>
          <MenuTrigger
            render={
              <Button
                size="xs"
                variant="outline"
                className="shrink-0"
                aria-label="Thread actions"
              />
            }
          >
            <EllipsisIcon className="size-3" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem
              onClick={() => {
                setIsEditing(true);
              }}
            >
              <PencilIcon />
              Rename
            </MenuItem>
            {isArchived ? (
              <MenuItem
                onClick={() => {
                  void onUnarchiveThread?.(activeThreadId);
                }}
              >
                <ArchiveRestoreIcon />
                Unarchive
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  void onArchiveThread?.(activeThreadId);
                }}
              >
                <ArchiveIcon />
                Archive
              </MenuItem>
            )}
            {workspacePath && (
              <MenuItem
                onClick={() => {
                  onCopyPath?.(workspacePath);
                }}
              >
                <ClipboardCopyIcon />
                Copy Path
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                onCopyThreadId?.(activeThreadId);
              }}
            >
              <HashIcon />
              Copy Thread ID
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              variant="destructive"
              onClick={() => {
                void onDeleteThread?.(activeThreadId);
              }}
            >
              <Trash2Icon />
              Delete
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
});
