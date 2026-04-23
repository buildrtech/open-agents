/**
 * Create a new sandbox base snapshot from the currently configured snapshot.
 * Defaults (snapshot id, ports, timeouts) come from the web app sandbox config so
 * this matches production; `refreshBaseSnapshot` skips workspace git bootstrap
 * so the new image stays clone-ready (see `@open-agents/sandbox` snapshot-refresh).
 *
 * Usage:
 *   bun run scripts/vercel-refresh-base-snapshot.ts --command "apt-get update"
 *   bun run scripts/vercel-refresh-base-snapshot.ts --from snap_123 --command "apt-get install -y ripgrep"
 *   bun run scripts/vercel-refresh-base-snapshot.ts --from-runtime --command "apt-get update"
 */

import {
  DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS,
  refreshBaseSnapshot,
} from "@open-agents/sandbox/vercel";
import {
  DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
  DEFAULT_SANDBOX_PORTS,
  DEFAULT_SANDBOX_TIMEOUT_MS,
} from "../apps/web/lib/sandbox/config";
import { parseRefreshBaseSnapshotArgs } from "./lib/refresh-base-snapshot-cli";

const SANDBOX_BASE_SNAPSHOT_CONFIG_PATH = "apps/web/lib/sandbox/config.ts";

function printUsage() {
  console.log(`Usage:
  bun run sandbox:snapshot-base -- --command "apt-get update"
  bun run sandbox:snapshot-base -- --from snap_123 --command "apt-get install -y ripgrep"
  bun run sandbox:snapshot-base -- --from-runtime --command "apt-get update"

Options:
  --from <snapshot-id>         Override the starting snapshot id
  --from-runtime               Start from the default Vercel runtime instead of a snapshot
  --command <shell-command>    Command to run inside the sandbox. Repeat as needed.
  --sandbox-timeout-ms <ms>    Sandbox lifetime for the refresh run
  --command-timeout-ms <ms>    Timeout for each setup command (default: ${DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS})
  --help                       Show this message

Current configured base snapshot:
  ${DEFAULT_SANDBOX_BASE_SNAPSHOT_ID}`);
}

async function main() {
  const parsed = parseRefreshBaseSnapshotArgs(process.argv.slice(2), {
    allowCommands: true,
  });
  if ("help" in parsed) {
    printUsage();
    return;
  }

  const result = await refreshBaseSnapshot({
    baseSnapshotId: parsed.bootstrapFromRuntime
      ? undefined
      : (parsed.baseSnapshotId ?? DEFAULT_SANDBOX_BASE_SNAPSHOT_ID),
    commands: parsed.commands,
    sandboxTimeoutMs: parsed.sandboxTimeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS,
    commandTimeoutMs: parsed.commandTimeoutMs,
    ports: DEFAULT_SANDBOX_PORTS,
    log: (message) => console.log(message),
  });

  console.log("");
  console.log(`New snapshot id: ${result.snapshotId}`);
  if (result.sourceSnapshotId) {
    console.log(`Started from snapshot: ${result.sourceSnapshotId}`);
  } else {
    console.log("Started from the default Vercel runtime.");
  }
  console.log(
    `Update ${SANDBOX_BASE_SNAPSHOT_CONFIG_PATH} to use: "${result.snapshotId}"`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
