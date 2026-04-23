import { describe, expect, test } from "bun:test";
import { parseRefreshBaseSnapshotArgs } from "./refresh-base-snapshot-cli";

describe("parseRefreshBaseSnapshotArgs", () => {
  test("parses runtime bootstrap without a base snapshot", () => {
    expect(parseRefreshBaseSnapshotArgs(["--from-runtime"])).toEqual({
      bootstrapFromRuntime: true,
      baseSnapshotId: undefined,
      sandboxTimeoutMs: undefined,
      commandTimeoutMs: undefined,
      commands: [],
    });
  });

  test("parses commands when enabled", () => {
    expect(
      parseRefreshBaseSnapshotArgs(
        ["--from-runtime", "--command", "apt-get update"],
        { allowCommands: true },
      ),
    ).toEqual({
      bootstrapFromRuntime: true,
      baseSnapshotId: undefined,
      sandboxTimeoutMs: undefined,
      commandTimeoutMs: undefined,
      commands: ["apt-get update"],
    });
  });

  test("rejects mixing --from with --from-runtime", () => {
    expect(() =>
      parseRefreshBaseSnapshotArgs(["--from", "snap_123", "--from-runtime"]),
    ).toThrow("Choose either --from or --from-runtime.");
  });
});
