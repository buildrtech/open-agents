import { describe, expect, test } from "bun:test";
import {
  ALLOWED_REPOSITORY_FULL_NAMES,
  REPOSITORY_LAUNCH_ALLOWLIST_ERROR,
  filterAllowedRepositories,
  getRepositoryEnvPrefix,
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

  test("provides explicit env prefixes for allowlisted repos", () => {
    expect(getRepositoryEnvPrefix("buildrtech", "app")).toBe("BUILDRTECH_APP");
    expect(getRepositoryEnvPrefix("BuildrTech", "App")).toBe("BUILDRTECH_APP");
    expect(getRepositoryEnvPrefix("acme", "repo")).toBeNull();
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
