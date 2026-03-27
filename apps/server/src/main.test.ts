import * as Http from "node:http";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it, vi } from "@effect/vitest";
import type { OrchestrationReadModel } from "@codeforge/contracts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";
import { FetchHttpClient } from "effect/unstable/http";
import { beforeEach } from "vitest";
import { NetService } from "@codeforge/shared/Net";

import { CliConfig, recordStartupHeartbeat, codeforgeCli, type CliConfigShape } from "./main";
import { ServerConfig, type ServerConfigShape } from "./config";
import { Open, type OpenShape } from "./open";
import { ProjectionSnapshotQuery } from "./orchestration/Services/ProjectionSnapshotQuery";
import { AnalyticsService } from "./telemetry/Services/AnalyticsService";
import { Server, type ServerShape } from "./wsServer";
import { ServerSettingsService } from "./serverSettings";

const start = vi.fn(() => undefined);
const stop = vi.fn(() => undefined);
let resolvedConfig: ServerConfigShape | null = null;
const serverStart = Effect.acquireRelease(
  Effect.gen(function* () {
    resolvedConfig = yield* ServerConfig;
    start();
    return {} as unknown as Http.Server;
  }),
  () => Effect.sync(() => stop()),
);
const findAvailablePort = vi.fn((preferred: number) => Effect.succeed(preferred));

// Shared service layer used by this CLI test suite.
const testLayer = Layer.mergeAll(
  Layer.succeed(CliConfig, {
    cwd: "/tmp/codeforge-test-workspace",
    fixPath: Effect.void,
    resolveStaticDir: Effect.undefined,
  } satisfies CliConfigShape),
  Layer.succeed(NetService, {
    canListenOnHost: () => Effect.succeed(true),
    isPortAvailableOnLoopback: () => Effect.succeed(true),
    reserveLoopbackPort: () => Effect.succeed(0),
    findAvailablePort,
  }),
  Layer.succeed(Server, {
    start: serverStart,
    stopSignal: Effect.void,
  } satisfies ServerShape),
  Layer.succeed(Open, {
    openBrowser: (_target: string) => Effect.void,
    openInEditor: () => Effect.void,
  } satisfies OpenShape),
  ServerSettingsService.layerTest(),
  AnalyticsService.layerTest,
  FetchHttpClient.layer,
  NodeServices.layer,
);

const runCli = (
  args: ReadonlyArray<string>,
  env: Record<string, string> = { CODEFORGE_NO_BROWSER: "true" },
) => {
  return Command.runWith(codeforgeCli, { version: "0.0.0-test" })(args).pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: {
            ...env,
          },
        }),
      ),
    ),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resolvedConfig = null;
  start.mockImplementation(() => undefined);
  stop.mockImplementation(() => undefined);
  findAvailablePort.mockImplementation((preferred: number) => Effect.succeed(preferred));
});

it.layer(testLayer)("server CLI command", (it) => {
  it.effect("parses all CLI flags and wires scoped start/stop", () =>
    Effect.gen(function* () {
      yield* runCli([
        "--mode",
        "desktop",
        "--port",
        "4010",
        "--host",
        "0.0.0.0",
        "--home-dir",
        "/tmp/codeforge-cli-home",
        "--dev-url",
        "http://127.0.0.1:5173",
        "--no-browser",
        "--auth-token",
        "auth-secret",
      ]);

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "desktop");
      assert.equal(resolvedConfig?.port, 4010);
      assert.equal(resolvedConfig?.host, "0.0.0.0");
      assert.equal(resolvedConfig?.baseDir, "/tmp/codeforge-cli-home");
      assert.equal(resolvedConfig?.stateDir, "/tmp/codeforge-cli-home/dev");
      assert.equal(resolvedConfig?.devUrl?.toString(), "http://127.0.0.1:5173/");
      assert.equal(resolvedConfig?.noBrowser, true);
      assert.equal(resolvedConfig?.authToken, "auth-secret");
      assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, false);
      assert.equal(resolvedConfig?.logWebSocketEvents, true);
      assert.equal(stop.mock.calls.length, 1);
    }),
  );

  it.effect("supports --token as an alias for --auth-token", () =>
    Effect.gen(function* () {
      yield* runCli(["--token", "token-secret"]);

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.authToken, "token-secret");
    }),
  );

  it.effect("uses env fallbacks when flags are not provided", () =>
    Effect.gen(function* () {
      yield* runCli([], {
        CODEFORGE_MODE: "desktop",
        CODEFORGE_PORT: "4999",
        CODEFORGE_HOST: "100.88.10.4",
        CODEFORGE_HOME: "/tmp/codeforge-env-home",
        VITE_DEV_SERVER_URL: "http://localhost:5173",
        CODEFORGE_NO_BROWSER: "true",
        CODEFORGE_AUTH_TOKEN: "env-token",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "desktop");
      assert.equal(resolvedConfig?.port, 4999);
      assert.equal(resolvedConfig?.host, "100.88.10.4");
      assert.equal(resolvedConfig?.baseDir, "/tmp/codeforge-env-home");
      assert.equal(resolvedConfig?.stateDir, "/tmp/codeforge-env-home/dev");
      assert.equal(resolvedConfig?.devUrl?.toString(), "http://localhost:5173/");
      assert.equal(resolvedConfig?.noBrowser, true);
      assert.equal(resolvedConfig?.authToken, "env-token");
      assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, false);
      assert.equal(resolvedConfig?.logWebSocketEvents, true);
      assert.equal(findAvailablePort.mock.calls.length, 0);
    }),
  );

  const openBootstrapFd = Effect.fn(function* (payload: Record<string, unknown>) {
    const fs = yield* FileSystem.FileSystem;
    const filePath = yield* fs.makeTempFileScoped({
      prefix: "codeforge-bootstrap-",
      suffix: ".ndjson",
    });
    yield* fs.writeFileString(filePath, `${JSON.stringify(payload)}\n`);
    const { fd } = yield* fs.open(filePath, { flag: "r" });
    return fd;
  });

  it.effect("recognizes bootstrap fd from environment config", () =>
    Effect.gen(function* () {
      const fd = yield* openBootstrapFd({ authToken: "bootstrap-token" });

      yield* runCli([], {
        CODEFORGE_MODE: "web",
        CODEFORGE_BOOTSTRAP_FD: String(fd),
        CODEFORGE_AUTH_TOKEN: "env-token",
        CODEFORGE_NO_BROWSER: "true",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "web");
      assert.equal(resolvedConfig?.authToken, "env-token");
    }),
  );

  it.effect("uses bootstrap envelope values as fallbacks when CLI and env are absent", () =>
    Effect.gen(function* () {
      const fd = yield* openBootstrapFd({
        mode: "desktop",
        port: 4888,
        host: "127.0.0.2",
        codeforgeHome: "/tmp/codeforge-bootstrap-home",
        devUrl: "http://127.0.0.1:5173",
        noBrowser: true,
        authToken: "bootstrap-token",
        autoBootstrapProjectFromCwd: false,
        logWebSocketEvents: true,
      });

      yield* runCli([], {
        CODEFORGE_BOOTSTRAP_FD: String(fd),
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "desktop");
      assert.equal(resolvedConfig?.port, 4888);
      assert.equal(resolvedConfig?.host, "127.0.0.2");
      assert.equal(resolvedConfig?.baseDir, "/tmp/codeforge-bootstrap-home");
      assert.equal(resolvedConfig?.stateDir, "/tmp/codeforge-bootstrap-home/dev");
      assert.equal(resolvedConfig?.devUrl?.toString(), "http://127.0.0.1:5173/");
      assert.equal(resolvedConfig?.noBrowser, true);
      assert.equal(resolvedConfig?.authToken, "bootstrap-token");
      assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, false);
      assert.equal(resolvedConfig?.logWebSocketEvents, true);
    }),
  );

  it.effect("applies CLI then env precedence over bootstrap envelope values", () =>
    Effect.gen(function* () {
      const fd = yield* openBootstrapFd({
        mode: "desktop",
        port: 4888,
        host: "127.0.0.2",
        codeforgeHome: "/tmp/codeforge-bootstrap-home",
        devUrl: "http://127.0.0.1:5173",
        noBrowser: false,
        authToken: "bootstrap-token",
        autoBootstrapProjectFromCwd: false,
        logWebSocketEvents: false,
      });

      yield* runCli(["--port", "4999", "--host", "0.0.0.0", "--auth-token", "cli-token"], {
        CODEFORGE_MODE: "web",
        CODEFORGE_BOOTSTRAP_FD: String(fd),
        CODEFORGE_HOME: "/tmp/codeforge-env-home",
        CODEFORGE_NO_BROWSER: "true",
        CODEFORGE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD: "true",
        CODEFORGE_LOG_WS_EVENTS: "true",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "web");
      assert.equal(resolvedConfig?.port, 4999);
      assert.equal(resolvedConfig?.host, "0.0.0.0");
      assert.equal(resolvedConfig?.baseDir, "/tmp/codeforge-env-home");
      assert.equal(resolvedConfig?.devUrl?.toString(), "http://127.0.0.1:5173/");
      assert.equal(resolvedConfig?.noBrowser, true);
      assert.equal(resolvedConfig?.authToken, "cli-token");
      assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, true);
      assert.equal(resolvedConfig?.logWebSocketEvents, true);
    }),
  );

  it.effect("prefers --mode over CODEFORGE_MODE", () =>
    Effect.gen(function* () {
      findAvailablePort.mockImplementation((_preferred: number) => Effect.succeed(4666));
      yield* runCli(["--mode", "web"], {
        CODEFORGE_MODE: "desktop",
        CODEFORGE_NO_BROWSER: "true",
      });

      assert.deepStrictEqual(findAvailablePort.mock.calls, [[3773]]);
      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "web");
      assert.equal(resolvedConfig?.port, 4666);
      assert.equal(resolvedConfig?.host, undefined);
    }),
  );

  it.effect("prefers --no-browser over CODEFORGE_NO_BROWSER", () =>
    Effect.gen(function* () {
      yield* runCli(["--no-browser"], {
        CODEFORGE_NO_BROWSER: "false",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.noBrowser, true);
    }),
  );

  it.effect("uses dynamic port discovery in web mode when port is omitted", () =>
    Effect.gen(function* () {
      findAvailablePort.mockImplementation((_preferred: number) => Effect.succeed(5444));
      yield* runCli([]);

      assert.deepStrictEqual(findAvailablePort.mock.calls, [[3773]]);
      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.port, 5444);
      assert.equal(resolvedConfig?.mode, "web");
    }),
  );

  it.effect("uses fixed localhost defaults in desktop mode", () =>
    Effect.gen(function* () {
      yield* runCli([], {
        CODEFORGE_MODE: "desktop",
        CODEFORGE_NO_BROWSER: "true",
      });

      assert.equal(findAvailablePort.mock.calls.length, 0);
      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.port, 3773);
      assert.equal(resolvedConfig?.host, "127.0.0.1");
      assert.equal(resolvedConfig?.mode, "desktop");
    }),
  );

  it.effect("allows overriding desktop host with --host", () =>
    Effect.gen(function* () {
      yield* runCli(["--host", "0.0.0.0"], {
        CODEFORGE_MODE: "desktop",
        CODEFORGE_NO_BROWSER: "true",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.mode, "desktop");
      assert.equal(resolvedConfig?.host, "0.0.0.0");
    }),
  );

  it.effect("supports CLI and env for bootstrap/log websocket toggles", () =>
    Effect.gen(function* () {
      yield* runCli(["--auto-bootstrap-project-from-cwd"], {
        CODEFORGE_MODE: "desktop",
        CODEFORGE_LOG_WS_EVENTS: "false",
        CODEFORGE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD: "false",
        CODEFORGE_NO_BROWSER: "true",
      });

      assert.equal(start.mock.calls.length, 1);
      assert.equal(resolvedConfig?.autoBootstrapProjectFromCwd, true);
      assert.equal(resolvedConfig?.logWebSocketEvents, false);
    }),
  );

  it.effect("records a startup heartbeat with thread/project counts", () =>
    Effect.gen(function* () {
      const recordTelemetry = vi.fn(
        (_event: string, _properties?: Readonly<Record<string, unknown>>) => Effect.void,
      );
      const getSnapshot = vi.fn(() =>
        Effect.succeed({
          snapshotSequence: 2,
          projects: [{} as OrchestrationReadModel["projects"][number]],
          threads: [
            {} as OrchestrationReadModel["threads"][number],
            {} as OrchestrationReadModel["threads"][number],
          ],
          updatedAt: new Date(1).toISOString(),
        } satisfies OrchestrationReadModel),
      );

      yield* recordStartupHeartbeat.pipe(
        Effect.provideService(ProjectionSnapshotQuery, {
          getSnapshot,
        }),
        Effect.provideService(AnalyticsService, {
          record: recordTelemetry,
          flush: Effect.void,
        }),
      );

      assert.deepEqual(recordTelemetry.mock.calls[0], [
        "server.boot.heartbeat",
        {
          threadCount: 2,
          projectCount: 1,
        },
      ]);
    }),
  );

  it.effect("does not start server for invalid --mode values", () =>
    Effect.gen(function* () {
      yield* runCli(["--mode", "invalid"]);

      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );

  it.effect("does not start server for invalid --dev-url values", () =>
    Effect.gen(function* () {
      yield* runCli(["--dev-url", "not-a-url"]).pipe(Effect.catch(() => Effect.void));

      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );

  it.effect("does not start server for out-of-range --port values", () =>
    Effect.gen(function* () {
      yield* runCli(["--port", "70000"]);

      // effect/unstable/cli renders help/errors for parse failures and returns success.
      assert.equal(start.mock.calls.length, 0);
      assert.equal(stop.mock.calls.length, 0);
    }),
  );
});
