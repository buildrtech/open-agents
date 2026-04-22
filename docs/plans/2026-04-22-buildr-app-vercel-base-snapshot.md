# Buildr App Vercel Base Snapshot Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staged-context snapshot refresh support and a Buildr-app-specific snapshot builder that produces a generic, clone-ready Vercel base snapshot with Buildr app system dependencies, local services, and warmed Ruby/JS dependency caches.

**Architecture:** Extend the generic `refreshBaseSnapshot()` helper so it can upload a temporary build context into the sandbox before running setup commands. Then add a repo-specific script that stages the minimal install inputs from `../app`, installs the Buildr app's OS/toolchain/service requirements, warms Bundler and pnpm caches, scrubs temp state, and snapshots the result.

**Tech Stack:** Bun, TypeScript, Vercel sandbox SDK wrapper, Bun test, shell commands executed inside the sandbox.

---

## File structure

### New files
- `scripts/vercel-refresh-buildr-app-base-snapshot.ts` — Buildr-app-specific CLI entrypoint for snapshot creation.
- `scripts/lib/buildr-app-snapshot.ts` — pure helpers to collect staged files, build commands, and format output.
- `scripts/lib/buildr-app-snapshot.test.ts` — tests for file selection and command generation.

### Modified files
- `packages/sandbox/vercel/snapshot-refresh.ts` — add staged-file upload support to the generic snapshot refresh helper.
- `packages/sandbox/vercel/snapshot-refresh.test.ts` — add tests for staged-file upload and cleanup/failure behavior.
- `packages/sandbox/vercel/index.ts` — export any new types needed by the new script.
- `package.json` — add a script entry for the Buildr app snapshot builder.

### Existing files to reference
- `scripts/vercel-refresh-base-snapshot.ts`
- `apps/web/lib/sandbox/config.ts`
- `../app/Dockerfile`
- `../app/.forge/Dockerfile`
- `../app/.forge/setup.sh`
- `../app/.tool-versions`
- `../app/package.json`
- `../app/Gemfile`
- `../app/.npmrc`

---

### Task 1: Add failing tests for staged snapshot context support

**Files:**
- Modify: `packages/sandbox/vercel/snapshot-refresh.test.ts`
- Modify: `packages/sandbox/vercel/snapshot-refresh.ts`
- Test: `packages/sandbox/vercel/snapshot-refresh.test.ts`

- [ ] **Step 1: Write the failing test for staged file upload order**

```ts
test("writes staged files before running setup commands", async () => {
  const writes: Array<{ path: string; content: string }> = [];
  const execCalls: string[] = [];

  await refreshBaseSnapshot(
    {
      baseSnapshotId: "snap-current",
      sandboxTimeoutMs: 300_000,
      stagedFiles: [
        { path: "/tmp/buildr/Gemfile", content: "source 'https://rubygems.org'\n" },
      ],
      commands: ["test -f /tmp/buildr/Gemfile"],
    },
    {
      connectSandbox: async () =>
        createSandbox({
          writeFile: async (path, content) => {
            writes.push({ path, content });
          },
          exec: async (command) => {
            execCalls.push(command);
            return createExecResult();
          },
        }),
    },
  );

  expect(writes).toEqual([
    { path: "/tmp/buildr/Gemfile", content: "source 'https://rubygems.org'\n" },
  ]);
  expect(execCalls).toEqual(["test -f /tmp/buildr/Gemfile"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/sandbox/vercel/snapshot-refresh.test.ts`
Expected: FAIL because `stagedFiles` and sandbox file upload support do not exist yet.

- [ ] **Step 3: Write the failing test for upload failure cleanup**

```ts
test("stops the sandbox when staged file upload fails", async () => {
  const stop = mock(async () => {});

  const refreshPromise = refreshBaseSnapshot(
    {
      baseSnapshotId: "snap-current",
      sandboxTimeoutMs: 300_000,
      stagedFiles: [{ path: "/tmp/buildr/.npmrc", content: "token" }],
    },
    {
      connectSandbox: async () =>
        createSandbox({
          stop,
          writeFile: async () => {
            throw new Error("write failed");
          },
        }),
    },
  );

  await expect(refreshPromise).rejects.toThrow("write failed");
  expect(stop).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test packages/sandbox/vercel/snapshot-refresh.test.ts`
Expected: FAIL because upload failure path is not handled yet.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/vercel/snapshot-refresh.test.ts
git commit -m "test: cover staged snapshot refresh uploads"
```

### Task 2: Implement staged snapshot context support

**Files:**
- Modify: `packages/sandbox/vercel/snapshot-refresh.ts`
- Modify: `packages/sandbox/vercel/index.ts`
- Test: `packages/sandbox/vercel/snapshot-refresh.test.ts`

- [ ] **Step 1: Add staged file support to the option types**

```ts
export interface RefreshBaseSnapshotStagedFile {
  path: string;
  content: string;
}

export interface RefreshBaseSnapshotOptions {
  baseSnapshotId: string;
  stagedFiles?: RefreshBaseSnapshotStagedFile[];
  commands?: string[];
  // ...
}
```

- [ ] **Step 2: Extend the snapshot sandbox interface minimally**

```ts
interface SnapshotSandbox {
  workingDirectory: string;
  writeFile(path: string, content: string, encoding: "utf-8"): Promise<void>;
  exec(command: string, cwd: string, timeoutMs: number): Promise<ExecResult>;
  stop(): Promise<void>;
  snapshot?(): Promise<SnapshotResult>;
}
```

- [ ] **Step 3: Upload staged files before command execution**

```ts
for (const stagedFile of options.stagedFiles ?? []) {
  log(`Uploading staged file ${stagedFile.path}.`);
  await sandbox.writeFile(stagedFile.path, stagedFile.content, "utf-8");
}
```

- [ ] **Step 4: Keep current failure semantics unchanged**

Ensure:
- any upload failure rejects
- sandbox is stopped in `finally` when snapshot was not created
- command failure formatting remains unchanged

- [ ] **Step 5: Export the new staged-file type if needed by the script layer**

```ts
export type {
  RefreshBaseSnapshotStagedFile,
  RefreshBaseSnapshotOptions,
  RefreshBaseSnapshotResult,
} from "./snapshot-refresh";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/sandbox/vercel/snapshot-refresh.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/vercel/snapshot-refresh.ts packages/sandbox/vercel/index.ts packages/sandbox/vercel/snapshot-refresh.test.ts
git commit -m "feat: support staged files in snapshot refresh"
```

### Task 3: Add failing tests for the Buildr app snapshot recipe

**Files:**
- Create: `scripts/lib/buildr-app-snapshot.test.ts`
- Create: `scripts/lib/buildr-app-snapshot.ts`
- Test: `scripts/lib/buildr-app-snapshot.test.ts`

- [ ] **Step 1: Write the failing test for staged file collection**

```ts
test("collects the Buildr app install context", async () => {
  const result = await collectBuildrAppSnapshotInputs({
    appRoot: "../app",
    readTextFile: async (path) => `content:${path}`,
  });

  expect(result.stagedFiles.map((file) => file.path)).toEqual([
    "/tmp/buildr-app-snapshot/Gemfile",
    "/tmp/buildr-app-snapshot/Gemfile.lock",
    "/tmp/buildr-app-snapshot/package.json",
    "/tmp/buildr-app-snapshot/pnpm-lock.yaml",
    "/tmp/buildr-app-snapshot/pnpm-workspace.yaml",
    "/tmp/buildr-app-snapshot/.npmrc",
    "/tmp/buildr-app-snapshot/.tool-versions",
    "/tmp/buildr-app-snapshot/mise.toml",
    "/tmp/buildr-app-snapshot/gems/email_forward_parser/...",
  ]);
});
```

- [ ] **Step 2: Write the failing test for command generation**

```ts
test("builds commands that install system deps, services, toolchains, and warm caches", () => {
  const commands = buildBuildrAppSnapshotCommands();

  expect(commands.some((command) => command.includes("postgresql-18"))).toBe(true);
  expect(commands.some((command) => command.includes("redis-server"))).toBe(true);
  expect(commands.some((command) => command.includes("bundle install"))).toBe(true);
  expect(commands.some((command) => command.includes("pnpm install --frozen-lockfile"))).toBe(true);
  expect(commands.at(-1)).toContain("/vercel/sandbox");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test scripts/lib/buildr-app-snapshot.test.ts`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/buildr-app-snapshot.test.ts
git commit -m "test: define buildr app snapshot recipe"
```

### Task 4: Implement the Buildr app snapshot recipe helpers

**Files:**
- Create: `scripts/lib/buildr-app-snapshot.ts`
- Test: `scripts/lib/buildr-app-snapshot.test.ts`

- [ ] **Step 1: Implement install-context file collection with small pure helpers**

```ts
const BUILD_CONTEXT_ROOT = "/tmp/buildr-app-snapshot";

export async function collectBuildrAppSnapshotInputs(...) {
  return {
    stagedFiles: [
      await stageTextFile(appRoot, "Gemfile"),
      await stageTextFile(appRoot, "Gemfile.lock"),
      await stageTextFile(appRoot, "package.json"),
      // ...
    ],
  };
}
```

- [ ] **Step 2: Include local gem directories needed by `Gemfile` path dependencies**

```ts
const stagedDirectories = ["gems/email_forward_parser"];
```

Copy every file under those directories into `/tmp/buildr-app-snapshot/...`.

- [ ] **Step 3: Implement deterministic command generation**

```ts
export function buildBuildrAppSnapshotCommands(): string[] {
  return [
    "apt-get update -qq",
    "apt-get install --no-install-recommends -y ... postgresql-18 postgresql-18-postgis-3 postgresql-client-18 redis-server ...",
    "... install ruby 4.0.2 ...",
    "... install node 24.14.0 and enable pnpm ...",
    "cd /tmp/buildr-app-snapshot && bundle install",
    "cd /tmp/buildr-app-snapshot && pnpm install --frozen-lockfile",
    "rm -rf /tmp/buildr-app-snapshot",
    "test -z \"$(ls -A /vercel/sandbox)\"",
  ];
}
```

- [ ] **Step 4: Add cleanup commands for auth/config artifacts**

Ensure commands remove any temporary credentials before snapshotting.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test scripts/lib/buildr-app-snapshot.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/buildr-app-snapshot.ts scripts/lib/buildr-app-snapshot.test.ts
git commit -m "feat: add buildr app snapshot recipe helpers"
```

### Task 5: Add the Buildr app snapshot CLI entrypoint

**Files:**
- Create: `scripts/vercel-refresh-buildr-app-base-snapshot.ts`
- Modify: `package.json`
- Test: `scripts/lib/buildr-app-snapshot.test.ts`

- [ ] **Step 1: Implement CLI argument parsing by following the existing base snapshot script pattern**

```ts
interface CliOptions {
  baseSnapshotId?: string;
  sandboxTimeoutMs?: number;
  commandTimeoutMs?: number;
}
```

Support at minimum:
- `--from`
- `--sandbox-timeout-ms`
- `--command-timeout-ms`
- `--help`

- [ ] **Step 2: Wire the CLI to the helper module and generic refresh function**

```ts
const inputs = await collectBuildrAppSnapshotInputs({ appRoot: BUILD_APP_ROOT });
const result = await refreshBaseSnapshot({
  baseSnapshotId: parsed.baseSnapshotId ?? DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
  stagedFiles: inputs.stagedFiles,
  commands: buildBuildrAppSnapshotCommands(),
  sandboxTimeoutMs: parsed.sandboxTimeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS,
  commandTimeoutMs: parsed.commandTimeoutMs,
  ports: DEFAULT_SANDBOX_PORTS,
  log: (message) => console.log(message),
});
```

- [ ] **Step 3: Add a package script**

```json
{
  "scripts": {
    "sandbox:snapshot-buildr-app-base": "bun run scripts/vercel-refresh-buildr-app-base-snapshot.ts"
  }
}
```

- [ ] **Step 4: Print clear cutover instructions**

```ts
console.log(`New snapshot id: ${result.snapshotId}`);
console.log(`Update apps/web/lib/sandbox/config.ts or VERCEL_SANDBOX_BASE_SNAPSHOT_ID to ${result.snapshotId}`);
```

- [ ] **Step 5: Run targeted tests**

Run: `bun test packages/sandbox/vercel/snapshot-refresh.test.ts scripts/lib/buildr-app-snapshot.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/vercel-refresh-buildr-app-base-snapshot.ts package.json
git commit -m "feat: add buildr app base snapshot builder"
```

### Task 6: Verify end to end manually

**Files:**
- Modify: none
- Test: manual verification only

- [ ] **Step 1: Run the snapshot build script with credentials available**

Run:
```bash
bun run sandbox:snapshot-buildr-app-base
```

Expected: command logs for package install, toolchain setup, cache warming, cleanup, and a final printed snapshot id.

- [ ] **Step 2: Hard-cut to the new snapshot id locally**

Update one of:
- `apps/web/lib/sandbox/config.ts`
- `VERCEL_SANDBOX_BASE_SNAPSHOT_ID`

Expected: new sandboxes start from the new snapshot.

- [ ] **Step 3: Create a fresh sandbox and validate clone-readiness**

Run the app, create a sandbox, and verify:
- `/vercel/sandbox` starts empty
- cloning `../app` into `/vercel/sandbox` works

- [ ] **Step 4: Validate full local app boot inside the sandbox**

After clone, verify:
- PostgreSQL starts and is reachable locally
- Redis starts and is reachable locally
- `bundle install` is warm / fast
- `pnpm install --frozen-lockfile` is warm / fast
- the Buildr app can boot locally

- [ ] **Step 5: Run required repo verification for touched code**

Run:
```bash
bun test packages/sandbox/vercel/snapshot-refresh.test.ts scripts/lib/buildr-app-snapshot.test.ts
bun run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit final verification changes if any**

```bash
git add .
git commit -m "chore: verify buildr app base snapshot workflow"
```
