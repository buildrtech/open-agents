import { beforeEach, describe, expect, mock, test } from "bun:test";

const NOT_FOUND_ERROR = new Error("not-found");

mock.module("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND_ERROR;
  },
  redirect: () => {
    throw new Error("redirect should not be called");
  },
}));

mock.module("next/headers", () => ({
  headers: async () => new Headers(),
}));

mock.module("@/lib/session/get-server-session", () => ({
  getServerSession: async () => ({
    user: {
      id: "user-1",
      username: "nico",
      name: "Nico",
    },
  }),
}));

mock.module("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => {
    throw new Error("getUserPreferences should not be called");
  },
}));

mock.module("@/lib/db/vercel-project-links", () => ({
  getVercelProjectLinkByRepo: async () => {
    throw new Error("getVercelProjectLinkByRepo should not be called");
  },
}));

mock.module("@/lib/github/token", () => ({
  getUserGitHubToken: async () => {
    throw new Error("getUserGitHubToken should not be called");
  },
}));

mock.module("@/lib/db/sessions", () => ({
  createSessionWithInitialChat: async () => {
    throw new Error("createSessionWithInitialChat should not be called");
  },
  getUsedSessionTitles: async () => new Set<string>(),
}));

mock.module("@/lib/model-access", () => ({
  sanitizeUserPreferencesForSession: () => {
    throw new Error("sanitizeUserPreferencesForSession should not be called");
  },
}));

mock.module("@/lib/random-city", () => ({
  getRandomCityName: () => "Oslo",
}));

const pageModulePromise = import("./page");

describe("/[username]/[repo] page", () => {
  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("fetch should not be called");
    }) as unknown as typeof fetch;
  });

  test("blocked repos return notFound before session creation", async () => {
    const { default: RepoPage } = await pageModulePromise;

    await expect(
      RepoPage({
        params: Promise.resolve({ username: "acme", repo: "repo" }),
      }),
    ).rejects.toThrow("not-found");
  });
});
