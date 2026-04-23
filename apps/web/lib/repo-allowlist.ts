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
