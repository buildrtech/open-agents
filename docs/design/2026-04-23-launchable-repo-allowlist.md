# Launchable Repo Allowlist

## Date
- 2026-04-23

## Status
- Approved

## Problem

The app currently limits repository selection mostly through GitHub App installation access. That controls what appears in the repo picker, but it does not establish an app-owned policy for which repositories may launch sessions.

This leaves multiple gaps:
- the repo picker depends on GitHub installation state rather than a checked-in app policy
- `POST /api/sessions` can create repo-backed sessions without checking an internal allowlist
- `POST /api/sandbox` can clone a GitHub repo without checking an internal allowlist
- direct `/{owner}/{repo}` launch URLs can create sessions for repos outside the intended set

The result is that repository visibility and repository launchability are not the same thing. The product needs a hard backend boundary for launchable repos.

## Goal

Implement a hard, repo-backed allowlist for launchable GitHub repositories.

The allowlist must:
- be checked into the repository
- define exactly which repos may launch sessions
- apply to all repo-backed launch entry points
- hide disallowed repos from the repo picker
- use a hard cutover with no backward-compatibility layer

For the initial cutover, the only allowed repository is `buildrtech/app`.

## Non-goals

This design does not:
- add admin UI for editing the allowlist
- add per-user or per-environment repo policies
- rewrite historical sessions that already point at blocked repos
- remove GitHub App selected-repository installation support
- change empty non-repo chat session behavior

## Decision Summary

1. Add a checked-in launchable-repo allowlist module with `buildrtech/app` as the only allowed repo.
2. Normalize owner and repo names case-insensitively before policy checks.
3. Enforce the allowlist in every repo-backed launch path:
   - `POST /api/sessions`
   - `POST /api/sandbox`
   - direct `/{owner}/{repo}` launch page
4. Filter installation repository results through the same allowlist so the picker only shows launchable repos.
5. Return `403` from API entry points for blocked repos and use `notFound()` for blocked direct launch URLs.

## Why this approach

The codebase already has a pattern for repo-backed policy in the model allowlist work: one checked-in module owns the rule, and callers ask shared helpers instead of duplicating policy.

Applying the same shape here keeps the system simple:
- one source of truth for allowed repos
- one helper path for normalization and checks
- one consistent backend enforcement boundary

Relying only on GitHub App selected repositories is not sufficient because the app still has direct repo launch paths that bypass the picker. UI-only filtering is also not sufficient because it leaves the APIs unenforced.

## Policy Shape

Add a single module for launchable repo policy, with:
- `ALLOWED_REPOSITORY_FULL_NAMES`
- helper(s) to normalize owner/repo pairs
- helper(s) to check whether a repo is allowlisted
- helper(s) to filter repository lists

Rules:
- repository matching is case-insensitive
- a repo is launchable only if its normalized `owner/repo` is in the allowlist
- unknown repos are blocked by default

## Behavior

### API launch paths

- `POST /api/sessions` returns `403` when a repo-backed session targets a blocked repo
- `POST /api/sandbox` returns `403` when a repo sandbox targets a blocked repo
- the error message should be explicit and stable so UI and tests can rely on it

### Direct repo launch

- `/{owner}/{repo}` must not create a session for blocked repos
- blocked direct launches use `notFound()` rather than creating a session and failing later

### Repo picker

- installation repo results are filtered through the allowlist before returning to the client
- disallowed repos do not appear in the picker even if the GitHub installation can access them
- accounts may still appear with zero launchable repos; filtering accounts is not required for this cutover

## Affected Surfaces

- `apps/web/lib/github/installation-repos.ts`
- `apps/web/app/api/sessions/route.ts`
- `apps/web/app/api/sandbox/route.ts`
- `apps/web/app/[username]/[repo]/page.tsx`
- repo-selector UI indirectly, through filtered installation repo responses

## Error Semantics

Use a shared constant for blocked repo API responses:
- `Repository is not allowlisted for session launch`

Use silent omission for repo list filtering and `notFound()` for direct repo page launches.

## Testing

Add focused tests around the allowlist behavior:

### Policy tests

- `buildrtech/app` is allowlisted
- other repos are rejected
- case-insensitive owner/repo matching works
- repository list filtering removes disallowed entries

### Session and sandbox tests

- `POST /api/sessions` rejects blocked repos with `403`
- `POST /api/sandbox` rejects blocked repos with `403`

### Direct launch tests

- `/{owner}/{repo}` returns `notFound()` for blocked repos

## Hard cutover

This is a hard cutover:
- do not keep a second source of truth
- do not add compatibility flags
- do not allow blocked repos to continue launching because they were previously visible in the picker

After this change, only `buildrtech/app` is launchable anywhere in the app.
