# Launchable Repo Allowlist Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hard repo-backed allowlist for launchable GitHub repositories, with `buildrtech/app` as the only allowed repo, enforced across picker data, API launch paths, and direct repo launch URLs.

**Architecture:** Add one checked-in repo allowlist module that owns normalization, membership checks, shared filtering, and the shared API error string. Route every repo-backed launch entry point and installation repo list through that module so blocked repos are hidden in the UI and rejected server-side.

**Tech Stack:** Bun, TypeScript, Next.js route handlers/pages, Bun test.

---

## Preconditions

- The initial allowlist contains exactly one repo: `buildrtech/app`.
- Matching is case-insensitive.
- Empty non-repo chats remain allowed.

## File structure

### New files
- `apps/web/lib/repo-allowlist.ts` — checked-in launchable repo policy helpers and shared error string.
- `apps/web/lib/repo-allowlist.test.ts` — focused unit tests for repo normalization, membership, and filtering.
- `apps/web/app/[username]/[repo]/page.test.ts` — direct launch denial test.
- `docs/design/2026-04-23-launchable-repo-allowlist.md` — design doc for this policy.
- `docs/plans/2026-04-23-launchable-repo-allowlist.md` — this implementation plan.

### Modified files
- `apps/web/lib/github/installation-repos.ts` — filter installation repositories through the allowlist.
- `apps/web/lib/github/installation-repos.test.ts` — verify disallowed repos are removed.
- `apps/web/app/api/sessions/route.ts` — reject blocked repo-backed session creation.
- `apps/web/app/api/sessions/route.test.ts` — add blocked-repo coverage.
- `apps/web/app/api/sandbox/route.ts` — reject blocked repo sandboxes.
- `apps/web/app/api/sandbox/route.test.ts` — add blocked-repo coverage.
- `apps/web/app/[username]/[repo]/page.tsx` — deny blocked direct launches with `notFound()`.

### Existing files to reference while implementing
- `docs/design/2026-04-23-launchable-repo-allowlist.md`
- `apps/web/lib/model-availability.ts`
- `apps/web/app/api/sessions/route.ts`
- `apps/web/app/api/sandbox/route.ts`
- `apps/web/lib/github/installation-repos.ts`

## Task 1: Add the repo allowlist policy module

**Files:**
- Create: `apps/web/lib/repo-allowlist.ts`
- Create: `apps/web/lib/repo-allowlist.test.ts`
- Test: `apps/web/lib/repo-allowlist.test.ts`

- [ ] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  ALLOWED_REPOSITORY_FULL_NAMES,
  REPOSITORY_LAUNCH_ALLOWLIST_ERROR,
  filterAllowedRepositories,
  isRepositoryAllowed,
  normalizeRepositoryFullName,
} from "./repo-allowlist";

describe("repo allowlist", () => {
  test("allows only buildrtech/app", () => {
    expect(Array.from(ALLOWED_REPOSITORY_FULL_NAMES)).toEqual([
      "buildrtech/app",
    ]);
    expect(isRepositoryAllowed("buildrtech", "app")).toBe(true);
    expect(isRepositoryAllowed("BuildrTech", "App")).toBe(true);
    expect(isRepositoryAllowed("acme", "repo")).toBe(false);
  });

  test("normalizes owner and repo names into a stable full name", () => {
    expect(normalizeRepositoryFullName("BuildrTech", "App")).toBe(
      "buildrtech/app",
    );
  });

  test("filters repository lists through the allowlist", () => {
    expect(
      filterAllowedRepositories([
        { full_name: "buildrtech/app" },
        { full_name: "acme/repo" },
      ]).map((repo) => repo.full_name),
    ).toEqual(["buildrtech/app"]);
  });

  test("exports the shared rejection error", () => {
    expect(REPOSITORY_LAUNCH_ALLOWLIST_ERROR).toBe(
      "Repository is not allowlisted for session launch",
    );
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `bun test apps/web/lib/repo-allowlist.test.ts`
Expected: FAIL because the policy module does not exist yet.

- [ ] **Step 3: Write the minimal policy module**

```ts
export const REPOSITORY_LAUNCH_ALLOWLIST_ERROR =
  "Repository is not allowlisted for session launch";

export const ALLOWED_REPOSITORY_FULL_NAMES = new Set(["buildrtech/app"]);

export function normalizeRepositoryFullName(
  owner: string,
  repo: string,
): string {
  return `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}

export function isRepositoryAllowed(owner: string, repo: string): boolean {
  return ALLOWED_REPOSITORY_FULL_NAMES.has(
    normalizeRepositoryFullName(owner, repo),
  );
}

export function isRepositoryFullNameAllowed(fullName: string): boolean {
  const [owner = "", repo = ""] = fullName.split("/", 2);
  return isRepositoryAllowed(owner, repo);
}

export function filterAllowedRepositories<T extends { full_name: string }>(
  repositories: T[],
): T[] {
  return repositories.filter((repository) =>
    isRepositoryFullNameAllowed(repository.full_name),
  );
}
```

- [ ] **Step 4: Run the unit test again**

Run: `bun test apps/web/lib/repo-allowlist.test.ts`
Expected: PASS

## Task 2: Filter repo picker data through the allowlist

**Files:**
- Modify: `apps/web/lib/github/installation-repos.ts`
- Modify: `apps/web/lib/github/installation-repos.test.ts`
- Test: `apps/web/lib/github/installation-repos.test.ts`

- [ ] **Step 1: Add a failing repository-list test**

```ts
test("omits repositories outside the launch allowlist", async () => {
  const fetchMock = mock(async () =>
    Response.json({
      repositories: [
        createRepository("app", "2024-05-01T00:00:00Z"),
        createRepository("repo", "2024-04-01T00:00:00Z"),
      ],
    }),
  );

  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const repos = await listUserInstallationRepositories({
    installationId: 123,
    userToken: "token",
    owner: "buildrtech",
  });

  expect(repos.map((repo) => repo.full_name)).toEqual(["buildrtech/app"]);
});
```

- [ ] **Step 2: Run the repository-list test to verify it fails**

Run: `bun test apps/web/lib/github/installation-repos.test.ts`
Expected: FAIL because the list helper still returns every matched repo.

- [ ] **Step 3: Filter the matched repos through the allowlist**

Apply `filterAllowedRepositories(...)` immediately before sorting/returning the matched repo list.

- [ ] **Step 4: Run the repository-list test again**

Run: `bun test apps/web/lib/github/installation-repos.test.ts`
Expected: PASS

## Task 3: Enforce the allowlist in session and sandbox APIs

**Files:**
- Modify: `apps/web/app/api/sessions/route.ts`
- Modify: `apps/web/app/api/sessions/route.test.ts`
- Modify: `apps/web/app/api/sandbox/route.ts`
- Modify: `apps/web/app/api/sandbox/route.test.ts`
- Test: `apps/web/app/api/sessions/route.test.ts`
- Test: `apps/web/app/api/sandbox/route.test.ts`

- [ ] **Step 1: Add failing API rejection tests**

```ts
test("rejects repo-backed sessions for blocked repos", async () => {
  const { POST } = await routeModulePromise;

  const response = await POST(
    createJsonRequest({
      repoOwner: "acme",
      repoName: "repo",
      branch: "main",
      cloneUrl: "https://github.com/acme/repo",
    }),
  );
  const body = (await response.json()) as { error: string };

  expect(response.status).toBe(403);
  expect(body.error).toBe(REPOSITORY_LAUNCH_ALLOWLIST_ERROR);
  expect(createCalls).toHaveLength(0);
});

test("rejects repo sandboxes for blocked repos", async () => {
  const { POST } = await routeModulePromise;

  const response = await POST(
    new Request("http://localhost/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl: "https://github.com/acme/repo",
        branch: "main",
        sandboxType: "vercel",
      }),
    }),
  );
  const body = (await response.json()) as { error: string };

  expect(response.status).toBe(403);
  expect(body.error).toBe(REPOSITORY_LAUNCH_ALLOWLIST_ERROR);
  expect(connectConfigs).toHaveLength(0);
});
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `bun test apps/web/app/api/sessions/route.test.ts apps/web/app/api/sandbox/route.test.ts`
Expected: FAIL because the API routes do not enforce the allowlist yet.

- [ ] **Step 3: Implement shared allowlist enforcement in both routes**

Session route:
- if both `repoOwner` and `repoName` are present and blocked, return `403`

Sandbox route:
- parse `repoUrl`
- if parsed owner/repo is blocked, return `403`
- only continue to GitHub token checks and sandbox connection for allowed repos

- [ ] **Step 4: Run the API tests again**

Run: `bun test apps/web/app/api/sessions/route.test.ts apps/web/app/api/sandbox/route.test.ts`
Expected: PASS

## Task 4: Enforce the allowlist for direct repo launch URLs

**Files:**
- Create: `apps/web/app/[username]/[repo]/page.test.ts`
- Modify: `apps/web/app/[username]/[repo]/page.tsx`
- Test: `apps/web/app/[username]/[repo]/page.test.ts`

- [ ] **Step 1: Add the failing direct-launch denial test**

```ts
test("blocked repos return notFound before session creation", async () => {
  const { default: RepoPage } = await pageModulePromise;

  await expect(
    RepoPage({
      params: Promise.resolve({ username: "acme", repo: "repo" }),
    }),
  ).rejects.toThrow("not-found");
});
```

- [ ] **Step 2: Run the direct-launch test to verify it fails**

Run: `bun test "apps/web/app/[username]/[repo]/page.test.ts"`
Expected: FAIL because blocked direct launches are not denied yet.

- [ ] **Step 3: Deny blocked repos in the page before fetching repo info**

```ts
if (!isRepositoryAllowed(username, repo)) {
  notFound();
}
```

- [ ] **Step 4: Run the direct-launch test again**

Run: `bun test "apps/web/app/[username]/[repo]/page.test.ts"`
Expected: PASS

## Task 5: Run focused verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused allowlist test set**

Run:
`bun test apps/web/lib/repo-allowlist.test.ts apps/web/lib/github/installation-repos.test.ts apps/web/app/api/sessions/route.test.ts apps/web/app/api/sandbox/route.test.ts "apps/web/app/[username]/[repo]/page.test.ts"`

Expected:
- PASS
- repo allowlist helper tests prove the shared policy
- installation repo tests prove picker data is filtered
- session and sandbox route tests prove backend rejection
- direct launch page test proves blocked URLs cannot create sessions

- [ ] **Step 2: Run repo-wide quality checks required by the repository instructions**

Run: `bun run ci`
Expected: PASS
