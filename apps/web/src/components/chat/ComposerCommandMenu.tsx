import { type ProjectEntry, type ModelSlug, type ProviderKind } from "@codeforge/contracts";
import { memo, useCallback } from "react";
import { type ComposerSlashCommand, type ComposerTriggerKind } from "../../composer-logic";
import { TerminalIcon, ZapIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Command, CommandItem, CommandList } from "../ui/command";
import { VscodeEntryIcon } from "./VscodeEntryIcon";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "provider-slash-command";
      commandName: string;
      argumentHint: string;
      provider: ProviderKind;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "model";
      provider: ProviderKind;
      model: ModelSlug;
      label: string;
      description: string;
    };

export const ComposerCommandMenu = memo(function ComposerCommandMenu(props: {
  items: ComposerCommandItem[];
  resolvedTheme: "light" | "dark";
  isLoading: boolean;
  triggerKind: ComposerTriggerKind | null;
  activeItemId: string | null;
  onHighlightedItemChange: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  return (
    <Command
      mode="none"
      onItemHighlighted={(highlightedValue) => {
        props.onHighlightedItemChange(
          typeof highlightedValue === "string" ? highlightedValue : null,
        );
      }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-popover/96 shadow-lg/8 backdrop-blur-xs">
        <CommandList className="max-h-72">
          {props.items.map((item) => (
            <ComposerCommandMenuItem
              key={item.id}
              item={item}
              resolvedTheme={props.resolvedTheme}
              isActive={props.activeItemId === item.id}
              onSelect={props.onSelect}
            />
          ))}
        </CommandList>
        {props.items.length === 0 && (
          <p className="px-3 py-2 text-muted-foreground/70 text-xs">
            {props.isLoading
              ? "Searching workspace files..."
              : props.triggerKind === "path"
                ? "No matching files or folders."
                : "No matching command."}
          </p>
        )}
      </div>
    </Command>
  );
});

const ComposerCommandMenuItem = memo(function ComposerCommandMenuItem(props: {
  item: ComposerCommandItem;
  resolvedTheme: "light" | "dark";
  isActive: boolean;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  const scrollRef = useCallback(
    (node: HTMLElement | null) => {
      if (node && props.isActive) {
        node.scrollIntoView({ block: "nearest" });
      }
    },
    [props.isActive],
  );

  const { item } = props;
  const isSlashLike = item.type === "slash-command" || item.type === "provider-slash-command";

  return (
    <CommandItem
      ref={scrollRef}
      value={item.id}
      className={cn(
        "cursor-pointer select-none gap-2",
        isSlashLike ? "items-start py-1.5" : "items-center",
        props.isActive && "bg-accent text-accent-foreground",
      )}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        props.onSelect(item);
      }}
    >
      {item.type === "path" ? (
        <VscodeEntryIcon pathValue={item.path} kind={item.pathKind} theme={props.resolvedTheme} />
      ) : null}
      {item.type === "slash-command" ? (
        <div className="mt-0.5">
          <ZapIcon className="size-3.5 shrink-0 text-amber-500/80" />
        </div>
      ) : null}
      {item.type === "provider-slash-command" ? (
        <div className="mt-0.5">
          <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        </div>
      ) : null}
      {item.type === "model" ? (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          model
        </Badge>
      ) : null}

      {item.type === "slash-command" || item.type === "provider-slash-command" ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{item.label}</span>
            {item.type === "provider-slash-command" && item.argumentHint ? (
              <span className="text-muted-foreground/50 text-xs">{item.argumentHint}</span>
            ) : null}
          </div>
          <span className="text-muted-foreground/70 text-xs leading-snug">{item.description}</span>
        </div>
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <span className="truncate">{item.label}</span>
          </span>
          <span className="truncate text-muted-foreground/70 text-xs">{item.description}</span>
        </>
      )}
    </CommandItem>
  );
});
