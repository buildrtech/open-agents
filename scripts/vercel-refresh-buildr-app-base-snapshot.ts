import path from "node:path";
import {
  DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS,
  refreshBaseSnapshot,
} from "@open-agents/sandbox/vercel";
import {
  DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
  DEFAULT_SANDBOX_PORTS,
  DEFAULT_SANDBOX_TIMEOUT_MS,
} from "../apps/web/lib/sandbox/config";
import {
  buildBuildrAppSnapshotCommands,
  collectBuildrAppSnapshotInputs,
} from "./lib/buildr-app-snapshot";

const SANDBOX_BASE_SNAPSHOT_CONFIG_PATH = "apps/web/lib/sandbox/config.ts";
const BUILDR_APP_ROOT = path.resolve(import.meta.dir, "../../app");

interface CliOptions {
  baseSnapshotId?: string;
  sandboxTimeoutMs?: number;
  commandTimeoutMs?: number;
}

interface HelpResult {
  help: true;
}

function printUsage() {
  console.log(`Usage:
  bun run sandbox:snapshot-buildr-app-base
  bun run sandbox:snapshot-buildr-app-base -- --from snap_123 --sandbox-timeout-ms 1800000

Options:
  --from <snapshot-id>         Override the starting snapshot id
  --sandbox-timeout-ms <ms>    Sandbox lifetime for the refresh run
  --command-timeout-ms <ms>    Timeout for each setup command (default: ${DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS})
  --help                       Show this message

Buildr app root:
  ${BUILDR_APP_ROOT}

Current configured base snapshot:
  ${DEFAULT_SANDBOX_BASE_SNAPSHOT_ID}`);
}

function requireOptionValue(
  argv: string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }

  return value;
}

function parsePositiveNumber(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive number.`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliOptions | HelpResult {
  let baseSnapshotId: string | undefined;
  let sandboxTimeoutMs: number | undefined;
  let commandTimeoutMs: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--from") {
      baseSnapshotId = requireOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--sandbox-timeout-ms") {
      sandboxTimeoutMs = parsePositiveNumber(
        requireOptionValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }

    if (arg === "--command-timeout-ms") {
      commandTimeoutMs = parsePositiveNumber(
        requireOptionValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    baseSnapshotId,
    sandboxTimeoutMs,
    commandTimeoutMs,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if ("help" in parsed) {
    printUsage();
    return;
  }

  console.log(`Collecting Buildr app snapshot inputs from ${BUILDR_APP_ROOT}.`);
  const inputs = await collectBuildrAppSnapshotInputs({
    appRoot: BUILDR_APP_ROOT,
  });
  console.log(
    `Staged ${inputs.stagedFiles.length} files for dependency warmup.`,
  );

  const result = await refreshBaseSnapshot({
    baseSnapshotId: parsed.baseSnapshotId ?? DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
    stagedFiles: inputs.stagedFiles,
    commands: buildBuildrAppSnapshotCommands(),
    sandboxTimeoutMs: parsed.sandboxTimeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS,
    commandTimeoutMs: parsed.commandTimeoutMs,
    ports: DEFAULT_SANDBOX_PORTS,
    log: (message) => console.log(message),
  });

  console.log("");
  console.log(`New snapshot id: ${result.snapshotId}`);
  console.log(`Started from snapshot: ${result.sourceSnapshotId}`);
  console.log(
    `Update ${SANDBOX_BASE_SNAPSHOT_CONFIG_PATH} or set VERCEL_SANDBOX_BASE_SNAPSHOT_ID=${result.snapshotId}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
