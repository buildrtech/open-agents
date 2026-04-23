import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { listUserInstallationRepositories } from "./installation-repos";

const originalFetch = globalThis.fetch;

function createRepository(
  name: string,
  updatedAt: string,
  ownerLogin = "acme",
) {
  return {
    name,
    full_name: `${ownerLogin}/${name}`,
    description: null,
    private: false,
    clone_url: `https://github.com/${ownerLogin}/${name}.git`,
    updated_at: updatedAt,
    language: null,
    owner: {
      login: ownerLogin,
    },
  };
}

function createPage(
  repositories: ReturnType<typeof createRepository>[],
  page: number,
) {
  return [
    ...repositories,
    ...Array.from({ length: 50 - repositories.length }, (_, index) =>
      createRepository(
        `filler-${page}-${index}`,
        `2023-01-${`${(index % 28) + 1}`.padStart(2, "0")}T00:00:00Z`,
      ),
    ),
  ];
}

describe("installation-repos", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("stops paging once it has enough matches to satisfy the limit", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      const page = url.searchParams.get("page");

      expect(url.searchParams.get("per_page")).toBe("50");

      if (page === "1") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("app", "2024-03-01T00:00:00Z", "buildrtech"),
              createRepository("repo", "2024-02-01T00:00:00Z", "buildrtech"),
              createRepository("zeta", "2024-01-01T00:00:00Z", "buildrtech"),
            ],
            1,
          ),
        });
      }

      return Response.json({
        repositories: [
          createRepository("omega", "2024-04-01T00:00:00Z", "buildrtech"),
        ],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const repos = await listUserInstallationRepositories({
      installationId: 123,
      userToken: "token",
      owner: "buildrtech",
      limit: 1,
    });

    expect(repos.map((repo) => repo.name)).toEqual(["app"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("continues paging until a query has enough matches", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      const page = url.searchParams.get("page");

      expect(url.searchParams.get("per_page")).toBe("50");

      if (page === "1") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("docs", "2024-01-01T00:00:00Z", "buildrtech"),
              createRepository(
                "frontend",
                "2024-02-01T00:00:00Z",
                "buildrtech",
              ),
            ],
            1,
          ),
        });
      }

      if (page === "2") {
        return Response.json({
          repositories: createPage(
            [
              createRepository("app", "2024-03-01T00:00:00Z", "buildrtech"),
              createRepository("infra", "2024-04-01T00:00:00Z", "buildrtech"),
            ],
            2,
          ),
        });
      }

      return Response.json({
        repositories: [
          createRepository("docs-api", "2024-05-01T00:00:00Z", "buildrtech"),
        ],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const repos = await listUserInstallationRepositories({
      installationId: 123,
      userToken: "token",
      owner: "buildrtech",
      query: "app",
      limit: 1,
    });

    expect(repos.map((repo) => repo.name)).toEqual(["app"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("omits repositories outside the launch allowlist", async () => {
    const fetchMock = mock(async () =>
      Response.json({
        repositories: [
          createRepository("app", "2024-05-01T00:00:00Z", "buildrtech"),
          createRepository("repo", "2024-04-01T00:00:00Z", "buildrtech"),
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
});
