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
import {
  buildForgeHarnessSkillSnapshotCommands,
  collectForgeHarnessSkillSnapshotInputs,
} from "./lib/forge-harness-skills-snapshot";
import { parseRefreshBaseSnapshotArgs } from "./lib/refresh-base-snapshot-cli";

const SANDBOX_BASE_SNAPSHOT_CONFIG_PATH = "apps/web/lib/sandbox/config.ts";
const BUILDR_APP_ROOT = path.resolve(import.meta.dir, "../../app2");
const FORGE_HARNESS_SKILLS_ROOT = path.resolve(
  import.meta.dir,
  "../../forge/harness/skills",
);

function printUsage() {
  console.log(`Usage:
  bun run sandbox:snapshot-buildr-app-base
  bun run sandbox:snapshot-buildr-app-base -- --from snap_123 --sandbox-timeout-ms 1800000
  bun run sandbox:snapshot-buildr-app-base -- --from-runtime --sandbox-timeout-ms 1800000

Options:
  --from <snapshot-id>         Override the starting snapshot id
  --from-runtime               Start from the default Vercel runtime instead of a snapshot
  --sandbox-timeout-ms <ms>    Sandbox lifetime for the refresh run
  --command-timeout-ms <ms>    Timeout for each setup command (default: ${DEFAULT_BASE_SNAPSHOT_COMMAND_TIMEOUT_MS})
  --help                       Show this message

Buildr app root:
  ${BUILDR_APP_ROOT}

Forge harness skills root:
  ${FORGE_HARNESS_SKILLS_ROOT}

Current configured base snapshot:
  ${DEFAULT_SANDBOX_BASE_SNAPSHOT_ID}`);
}

async function main() {
  const parsed = parseRefreshBaseSnapshotArgs(process.argv.slice(2));
  if ("help" in parsed) {
    printUsage();
    return;
  }

  console.log(`Collecting Buildr app snapshot inputs from ${BUILDR_APP_ROOT}.`);
  const [buildrAppInputs, forgeHarnessSkillInputs] = await Promise.all([
    collectBuildrAppSnapshotInputs({
      appRoot: BUILDR_APP_ROOT,
    }),
    collectForgeHarnessSkillSnapshotInputs({
      skillsRoot: FORGE_HARNESS_SKILLS_ROOT,
    }),
  ]);
  console.log(
    `Staged ${buildrAppInputs.stagedFiles.length} Buildr app files for dependency warmup.`,
  );
  console.log(
    `Staged ${forgeHarnessSkillInputs.stagedFiles.length} Forge harness skill files for the base snapshot.`,
  );

  const result = await refreshBaseSnapshot({
    baseSnapshotId: parsed.bootstrapFromRuntime
      ? undefined
      : (parsed.baseSnapshotId ?? DEFAULT_SANDBOX_BASE_SNAPSHOT_ID),
    stagedFiles: [
      ...buildrAppInputs.stagedFiles,
      ...forgeHarnessSkillInputs.stagedFiles,
    ],
    commands: [
      ...buildForgeHarnessSkillSnapshotCommands(),
      ...buildBuildrAppSnapshotCommands(),
    ],
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
    `Update ${SANDBOX_BASE_SNAPSHOT_CONFIG_PATH} or set VERCEL_SANDBOX_BASE_SNAPSHOT_ID=${result.snapshotId}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
