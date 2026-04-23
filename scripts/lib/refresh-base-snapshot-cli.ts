export interface RefreshBaseSnapshotCliOptions {
  bootstrapFromRuntime: boolean;
  baseSnapshotId?: string;
  sandboxTimeoutMs?: number;
  commandTimeoutMs?: number;
  commands: string[];
}

export interface RefreshBaseSnapshotCliHelpResult {
  help: true;
}

interface ParseRefreshBaseSnapshotArgsOptions {
  allowCommands?: boolean;
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

export function parseRefreshBaseSnapshotArgs(
  argv: string[],
  options: ParseRefreshBaseSnapshotArgsOptions = {},
): RefreshBaseSnapshotCliOptions | RefreshBaseSnapshotCliHelpResult {
  const commands: string[] = [];
  let bootstrapFromRuntime = false;
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

    if (arg === "--from-runtime") {
      bootstrapFromRuntime = true;
      continue;
    }

    if (arg === "--command") {
      if (!options.allowCommands) {
        throw new Error(`Unknown argument: ${arg}`);
      }

      commands.push(requireOptionValue(argv, index, arg));
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

  if (bootstrapFromRuntime && baseSnapshotId) {
    throw new Error("Choose either --from or --from-runtime.");
  }

  return {
    bootstrapFromRuntime,
    baseSnapshotId,
    sandboxTimeoutMs,
    commandTimeoutMs,
    commands,
  };
}
