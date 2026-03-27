/**
 * Module-level cache for provider slash commands discovered from live sessions.
 *
 * ClaudeAdapter writes here after calling `supportedCommands()` on a query.
 * `checkClaudeProviderStatus()` reads from here to include commands in the
 * ServerProvider snapshot that gets pushed to clients.
 *
 * @module slashCommandsCache
 */
import type { ProviderKind, ProviderSlashCommand } from "@codeforge/contracts";

const cache = new Map<ProviderKind, ReadonlyArray<ProviderSlashCommand>>();
const listeners = new Set<() => void>();

export function setSlashCommands(
  provider: ProviderKind,
  commands: ReadonlyArray<ProviderSlashCommand>,
): void {
  cache.set(provider, commands);
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Swallow listener errors.
    }
  }
}

export function getSlashCommands(provider: ProviderKind): ReadonlyArray<ProviderSlashCommand> {
  return cache.get(provider) ?? [];
}

export function onSlashCommandsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
