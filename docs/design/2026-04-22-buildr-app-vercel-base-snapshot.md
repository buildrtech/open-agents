# Buildr App Vercel Base Snapshot

## Date
- 2026-04-22

## Status
- Approved

## Problem

We need a repeatable way to build a Vercel base snapshot that can launch a generic, clone-ready sandbox capable of fully booting `../app` locally. The current base snapshot flow supports running setup commands and snapshotting the result, but it does not support staging repo-specific install inputs into the sandbox, warming private Ruby and JavaScript dependency caches, or installing the service/toolchain set needed for Buildr app local boot.

The snapshot must remain generic:
- `/vercel/sandbox` must stay empty and clone-ready
- the snapshot must not bake in a checkout of `../app`
- private dependency credentials may be assumed at build time, but must not persist into the final snapshot

## Goal

Add a reusable staged-context snapshot refresh path, then build a Buildr-app-specific snapshot script that:
- starts from the current configured Vercel base snapshot
- installs the system packages, toolchains, and local services required by `../app`
- warms Bundler and pnpm caches using a temporary staged build context from `../app`
- removes the temporary context and credential artifacts before snapshotting
- emits a new Vercel snapshot id ready to hard-cut over to in app config/env

## Non-goals

This design does not:
- auto-update `apps/web/lib/sandbox/config.ts`
- bake `../app` into the snapshot
- create a general-purpose Docker build system for snapshots
- guarantee every optional local integration from `../app/README.md` is fully provisioned
- run the full Buildr app as part of unit tests

## Decision Summary

1. Extend `refreshBaseSnapshot()` to support staging arbitrary files into the sandbox before setup commands run.
2. Keep the existing base-snapshot flow as the generic primitive.
3. Add a new Buildr-app-specific script that stages only install inputs from `../app` into a temporary directory.
4. Install Buildr-app-required OS packages and toolchains in the sandbox using shell commands inspired by `../app/Dockerfile` and `../app/.forge/Dockerfile`.
5. Warm Bundler and pnpm caches using the staged install context.
6. Remove staged files and any temporary auth/config before creating the snapshot.
7. Keep `/vercel/sandbox` empty and clone-ready by continuing to use `skipGitWorkspaceBootstrap: true`.

## Why this approach

The repo already has a working snapshot refresh mechanism:
- `scripts/vercel-refresh-base-snapshot.ts`
- `packages/sandbox/vercel/snapshot-refresh.ts`

We should build on that seam instead of adding a one-off shell script. The missing capability is staged build context upload. Once that exists, the Buildr app snapshot can be expressed as a small repo-specific orchestration layer on top of the generic helper.

This keeps the architecture simple:
- generic snapshot refresh helper in `packages/sandbox`
- repo-specific snapshot recipe in `scripts/`

## Buildr app dependency shape

Based on `../app/Dockerfile`, `../app/.forge/Dockerfile`, `.tool-versions`, and setup scripts, the snapshot recipe needs:

### System packages
- `ca-certificates`
- `curl`
- `exiftool`
- `gnupg`
- `imagemagick`
- `jq`
- `libffi-dev`
- `libheif-dev`
- `libheif1`
- `libjemalloc2`
- `libreoffice`
- `libssl-dev`
- `libvips`
- `libyaml-dev`
- `openssl`
- `pkg-config`
- `qpdf`
- `redis-server`
- `unzip`
- PostgreSQL 18 packages including local server, client, and PostGIS

### Toolchains
- Ruby `4.0.2`
- Node `24.14.0`
- pnpm
- optionally Python `3.13.3` and `ast-grep` for parity with `.tool-versions`

### Local services for sandbox boot
- PostgreSQL 18 with a local cluster that can be started in-sandbox
- Redis server

### Cache warming inputs
Stage only the files required to resolve/install dependencies, for example:
- `../app/Gemfile`
- `../app/Gemfile.lock`
- `../app/package.json`
- `../app/pnpm-lock.yaml`
- `../app/pnpm-workspace.yaml`
- `../app/.npmrc`
- `../app/.tool-versions`
- `../app/mise.toml`
- `../app/gems/**`

The staged context lives in a temporary directory outside `/vercel/sandbox` and is deleted before snapshotting.

## Architecture

### 1. Generic staged snapshot refresh

Extend `packages/sandbox/vercel/snapshot-refresh.ts` with optional staged files support.

Recommended option shape:
- `stagedFiles?: Array<{ path: string; content: string }>`
- `commandWorkingDirectory?: string`

Flow:
1. create sandbox from `baseSnapshotId`
2. write staged files into the sandbox
3. run setup commands
4. snapshot sandbox
5. on failure, stop sandbox

The generic helper should not know anything about `../app`. It only stages files and runs commands.

### 2. Buildr app snapshot recipe

Add a dedicated script:
- `scripts/vercel-refresh-buildr-app-base-snapshot.ts`

Responsibilities:
- parse CLI args (`--from`, `--sandbox-timeout-ms`, `--command-timeout-ms`, maybe `--no-cache-warm` if we want an escape hatch)
- read the Buildr app install-context files from `../app`
- build the setup command list
- call `refreshBaseSnapshot()` with staged files and logging
- print the new snapshot id and the required config update

### 3. Service/bootstrap setup inside the snapshot

The setup commands should:
- install apt packages and PostgreSQL apt repo keys
- install Ruby and Node toolchains
- enable pnpm
- prepare service startup behavior for local Postgres and Redis
- create cache directories for Bundler/pnpm
- run cache-warming installs using the staged context
- scrub temporary auth/config files and staged worktree
- verify `/vercel/sandbox` is empty before snapshotting

Because the sandbox must remain clone-ready, we should never leave repo content in `/vercel/sandbox`.

## Credential handling

We can assume build-time secrets are available for private gems and private npm packages.

Rules:
- pass secrets through env or temporary auth files only for warmup
- do not write long-lived credentials into the final image
- remove temporary auth files before snapshotting
- do not leave a staged `.npmrc` or bundler credentials in persistent locations unless they are explicitly sanitized

## Command strategy

The Buildr script should generate the command sequence in code instead of embedding one giant shell blob. Each command should be independently logged by the generic refresh helper.

Broad command groups:
1. apt repository + package install
2. runtime/toolchain install
3. PostgreSQL local-cluster preparation
4. Redis availability check/setup
5. temporary build-context setup
6. Bundler cache warmup
7. pnpm cache warmup
8. cleanup and clone-readiness verification

This keeps failure reporting actionable because `refreshBaseSnapshot()` already surfaces the failing command and captured stdout/stderr.

## Why not bake in `../app`

Baking in the app checkout would violate the clone-ready requirement and would couple the base snapshot to one repo state. The snapshot should accelerate future clones, not replace them.

A clone-ready base image also preserves the current Open Agents flow where a sandbox can clone an arbitrary repo into `/vercel/sandbox` after the snapshot boots.

## Error handling

- If staged file upload fails, abort and stop the sandbox.
- If any setup command fails, surface the failing command with stdout/stderr and stop the sandbox.
- If cleanup fails, treat it as fatal rather than snapshotting a dirty image.
- If snapshot support is unavailable, fail exactly as the current helper does.

## Testing

### Unit tests in `packages/sandbox`
- staged files are written before commands run
- staged file paths are respected
- command working directory is configurable if introduced
- sandbox is stopped on staged-file write failure
- existing failure reporting behavior remains intact

### Unit tests for the Buildr app script
- derives the expected staged file set from `../app`
- builds the expected command list for package/toolchain/service/cache setup
- prints the expected snapshot update instructions
- avoids baking `../app` into `/vercel/sandbox`

### Manual verification
- run the new script with build-time credentials available
- confirm it prints a new snapshot id
- update `VERCEL_SANDBOX_BASE_SNAPSHOT_ID` or `apps/web/lib/sandbox/config.ts`
- create a fresh sandbox from the new snapshot
- clone `../app` into `/vercel/sandbox`
- confirm local Postgres and Redis can start in the sandbox
- confirm `bundle install`, `pnpm install`, and app boot are materially faster and that the app can fully boot locally

## Rollout

1. land staged-context support with tests
2. land the Buildr app snapshot script with tests
3. run the script manually with credentials
4. hard-cut config to the new snapshot id
5. validate fresh sandbox creation and local Buildr app boot

## Follow-up work

Potential follow-ups after this lands:
- factor common staged-context CLI helpers out of `scripts/vercel-refresh-base-snapshot.ts`
- add a machine-readable manifest for snapshot recipes
- add a smoke-test script that clones `../app` into a fresh sandbox and exercises service start + app boot
