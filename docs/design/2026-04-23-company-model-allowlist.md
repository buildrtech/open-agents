# Company Model Allowlist

## Date
- 2026-04-23

## Status
- Approved

## Problem

The app currently lets users customize which models appear in the model picker through `enabledModelIds` in user preferences. That is only a soft UI filter. It does not establish a company-owned, repo-backed policy for which providers and models are allowed across the product.

This creates several problems:
- users can curate their own picker instead of seeing a company-approved set
- saved defaults, existing chats, and custom variants can still reference models outside the intended company policy
- enforcement is split across multiple places, including a small disabled-model list and separate managed-template restrictions
- there is no single checked-in source of truth for allowed providers and allowed models

The result is inconsistent model access. The picker can hide models without actually making them unavailable, while older saved state can continue to reference models the company does not want exposed.

## Goal

Implement a hard, repo-backed allowlist for both providers and models that is enforced everywhere model selection enters or leaves the system.

The allowlist must:
- be checked into the repository
- remove disallowed providers and models from all pickers and APIs
- prevent users from customizing their visible model list
- sanitize existing saved selections to the repo default model
- block custom variants whose base provider or base model is not allowlisted

## Non-goals

This design does not:
- introduce per-environment allowlists
- add admin UI for changing the allowlist
- preserve backward compatibility for `enabledModelIds`
- eagerly rewrite every historical database row up front
- change the product to support provider-level wildcards without explicit model IDs

## Decision Summary

1. Replace the current disabled-model mechanism with a repo-backed company allowlist policy.
2. Define the allowlist in one checked-in module that owns both allowed provider IDs and allowed model IDs.
3. Remove user-controlled model list customization from preferences and settings UI.
4. Enforce the allowlist across model discovery, preferences, chat/session APIs, runtime model resolution, and model variants.
5. Sanitize stale saved model selections to `APP_DEFAULT_MODEL_ID`.
6. Treat variants as available only when their base model is allowlisted.
7. Keep the managed-template restriction only if it still adds an extra constraint beyond the allowlist; otherwise fold it into the same policy path.

## Why this approach

The codebase already has a natural seam for model gating in `apps/web/lib/model-availability.ts`, but today that module only disables a single model id. Separately, model access logic in `apps/web/lib/model-access.ts` handles managed-template restrictions, while user preferences handle soft picker filtering through `enabledModelIds`.

Expanding the existing availability seam into a real allowlist policy is simpler than introducing another parallel policy layer. It gives one source of truth and lets every call site ask the same questions:
- is this provider allowed?
- is this model id allowed?
- should this saved selection fall back to the app default?

That keeps the architecture direct:
- one repo-backed company policy
- one set of helper functions
- one consistent fallback behavior

## Policy Shape

Add a single policy module in `apps/web/lib/model-availability.ts` that defines:
- `ALLOWED_PROVIDER_IDS`
- `ALLOWED_MODEL_IDS`

And exports helpers for:
- checking whether a provider id is allowed
- checking whether a model id is allowed
- filtering model lists to allowed entries
- filtering model variants to those whose base model is allowed
- sanitizing a selected model id to `APP_DEFAULT_MODEL_ID`
- asserting that `APP_DEFAULT_MODEL_ID` itself is allowlisted

Rules:
- a model is available only if its provider is allowlisted and its full model id is allowlisted
- a variant is available only if its base model id is allowlisted
- unknown providers and unknown models are disallowed by default

## Behavior

### Base models

- `/api/models` returns only allowlisted base models
- all model pickers consume only allowlisted base models
- disallowed models never appear in UI or model-selection APIs

### Preferences

- remove `enabledModelIds` from preferences, normalization logic, update routes, and settings UI
- `defaultModelId` may only resolve to an allowlisted model or variant
- `defaultSubagentModelId` may only resolve to an allowlisted model or variant
- if a previously saved preference points to a disallowed model or variant, it falls back on read to `APP_DEFAULT_MODEL_ID` or `null` for subagent-as-auto where appropriate
- new preference writes that explicitly request a disallowed model or variant return `400` instead of silently rewriting the request

### Chats and sessions

- creating a session or chat uses the sanitized default model from preferences
- reading a chat sanitizes any stale stored `chat.modelId`
- updating a chat model with a disallowed model id returns `400`
- runtime model resolution falls back to `APP_DEFAULT_MODEL_ID` for any disallowed model or variant

### Variants

- built-in variants only exist if their base model is allowlisted
- user-defined variants are returned only if their base model is allowlisted
- creating or updating a variant whose base model is disallowed returns an error
- if a previously stored variant points at a model that is no longer allowlisted, it becomes unavailable and callers fall back to `APP_DEFAULT_MODEL_ID`

### Settings UI

- keep `Default Model` and `Subagent Model`
- remove the `Custom Model Set` UI entirely
- users no longer have a per-account way to narrow or broaden the picker contents

## Affected Surfaces

### Policy and model discovery

- `apps/web/lib/model-availability.ts`
- `apps/web/lib/models-with-context.ts`
- `apps/web/app/api/models/route.ts`

### Access and sanitization

- `apps/web/lib/model-access.ts`
- `apps/web/app/api/chat/_lib/model-selection.ts`
- `apps/web/app/api/chat/route.ts`
- `apps/web/app/api/sessions/route.ts`
- `apps/web/app/api/sessions/[sessionId]/chats/route.ts`
- `apps/web/app/api/sessions/[sessionId]/chats/[chatId]/route.ts`

### Preferences and settings

- `apps/web/lib/db/user-preferences.ts`
- `apps/web/hooks/use-user-preferences.ts`
- `apps/web/app/api/settings/preferences/route.ts`
- `apps/web/app/settings/preferences-section.tsx`
- `apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-context.tsx`

### Variants

- `apps/web/lib/model-variants.ts`
- `apps/web/app/api/settings/model-variants/route.ts`

## Fallback Semantics

Fallbacks must be strict and predictable:
- saved disallowed base model -> `APP_DEFAULT_MODEL_ID`
- saved disallowed variant id -> `APP_DEFAULT_MODEL_ID`
- saved disallowed subagent model -> `null`
- disallowed built-in variant -> omitted from the available list

The app default model is a hard prerequisite. If `APP_DEFAULT_MODEL_ID` is not allowlisted, code should fail fast in tests and local development rather than silently selecting an arbitrary fallback.

## Data Cutover

Use a hard cutover approach:
- remove `enabledModelIds` from code
- remove any persistence of `enabledModelIds` from the preferences API
- remove the field from the DB schema and generate a migration if the schema changes

Do not add compatibility shims. Old saved values should be handled through sanitization at read/write boundaries:
- preference reads sanitize stale defaults
- chat reads sanitize stale `modelId`
- preference writes reject disallowed incoming ids
- chat updates reject disallowed incoming ids
- runtime model resolution sanitizes again before execution

This keeps the system safe immediately without requiring a one-time rewrite of every existing row.

## Managed-template restrictions

There is already separate session-dependent gating for hosted managed-template restrictions. After introducing the company allowlist:
- if managed-template restrictions are still narrower than the allowlist for some accounts, keep them as an additional filter
- if they become redundant, collapse them into the shared allowlist path to avoid duplicate policy logic

The implementation should prefer a single policy flow where possible, but this design does not require removing managed-template behavior if it still serves a distinct product rule.

## Testing

Add focused tests around the allowlist behavior rather than broad end-to-end rewrites.

### Policy tests

- allowed provider + allowed model passes
- allowed provider + disallowed model fails
- disallowed provider fails even if the model id is listed incorrectly elsewhere
- `APP_DEFAULT_MODEL_ID` is asserted to be allowlisted

### Model discovery tests

- `/api/models` returns only allowlisted models
- model option builders do not surface filtered models indirectly

### Preference and access tests

- preference sanitization falls back when `defaultModelId` is disallowed
- preference sanitization falls back when `defaultSubagentModelId` is disallowed
- disallowed variants are removed from available preference state
- preference writes reject disallowed model ids
- `enabledModelIds` is no longer accepted or returned

### Chat and runtime tests

- creating a session/chat uses the sanitized allowlisted default
- reading a chat with a stale disallowed model returns the fallback model
- updating a chat with a disallowed model returns `400`
- runtime model resolution falls back when asked to run a disallowed model

### Variant tests

- allowlisted variants are returned
- built-in variants based on disallowed models are hidden
- creating a variant with a disallowed base model is rejected
- updating a variant to a disallowed base model is rejected

## Rollout

1. Add the repo-backed allowlist policy and tests.
2. Remove user model-list customization from preferences and UI.
3. Apply allowlist sanitization across preferences, chats, variants, and runtime selection.
4. Generate and commit any required schema migration.
5. Run focused tests for the touched policy surfaces.
6. Hard-cut the product to the allowlisted model set.

## Risks

- forgetting one API surface could leave a stale path that still accepts disallowed ids
- allowing built-in variants to bypass the base-model policy would reintroduce inconsistent access
- leaving `enabledModelIds` in schema or API responses would preserve a dead configuration path and confuse future contributors

The main mitigation is centralizing the allowlist helpers and reusing them everywhere instead of encoding policy in route-local conditionals.
