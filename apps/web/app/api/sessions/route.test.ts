import { beforeEach, describe, expect, mock, test } from "bun:test";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { REPOSITORY_LAUNCH_ALLOWLIST_ERROR } from "@/lib/repo-allowlist";
import type { VercelProjectSelection } from "@/lib/vercel/types";

const ALLOWED_REPO_OWNER = "buildrtech";
const ALLOWED_REPO_NAME = "app";
const ALLOWED_CLONE_URL = "https://github.com/buildrtech/app";

let currentSession: {
  authProvider?: "vercel" | "github";
  user: {
    id: string;
    username: string;
    name: string;
    email?: string;
  };
} | null = {
  user: {
    id: "user-1",
    username: "nico",
    name: "Nico",
  },
};
let existingSessionCount = 0;
let savedLink: VercelProjectSelection | null = null;
let currentVercelToken: string | null = "vercel-token";
let matchingProjects: VercelProjectSelection[] = [];
const createCalls: Array<Record<string, unknown>> = [];
const upsertCalls: Array<Record<string, unknown>> = [];

mock.module("@/lib/session/get-server-session", () => ({
  getServerSession: async () => currentSession,
}));

mock.module("@/lib/random-city", () => ({
  getRandomCityName: () => "Oslo",
}));

mock.module("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => ({
    defaultModelId: "anthropic/claude-haiku-4.5",
    defaultSubagentModelId: null,
    defaultSandboxType: "vercel",
    defaultDiffMode: "unified",
    autoCommitPush: false,
    autoCreatePr: false,
    alertsEnabled: true,
    alertSoundEnabled: true,
    publicUsageEnabled: false,
    globalSkillRefs: [{ source: "vercel/ai", skillName: "ai-sdk" }],
    modelVariants: [],
  }),
}));

mock.module("@/lib/db/vercel-project-links", () => ({
  getVercelProjectLinkByRepo: async () => savedLink,
  upsertVercelProjectLink: async (input: Record<string, unknown>) => {
    upsertCalls.push(input);
  },
}));

mock.module("@/lib/vercel/token", () => ({
  getUserVercelToken: async () => currentVercelToken,
}));

mock.module("@/lib/vercel/projects", () => ({
  listMatchingVercelProjects: async () => matchingProjects,
}));

mock.module("@/lib/db/sessions", () => ({
  countSessionsByUserId: async () => existingSessionCount,
  createSessionWithInitialChat: async (input: {
    session: Record<string, unknown>;
    initialChat: Record<string, unknown>;
  }) => {
    createCalls.push(input.session);
    return {
      session: {
        ...input.session,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      chat: {
        id: String(input.initialChat.id),
        sessionId: String(input.session.id),
        title: String(input.initialChat.title),
        modelId: String(input.initialChat.modelId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },
  getArchivedSessionCountByUserId: async () => 0,
  getSessionsWithUnreadByUserId: async () => [],
  getUsedSessionTitles: async () => new Set<string>(),
}));

const routeModulePromise = import("./route");

function createJsonRequest(
  body: unknown,
  url = "http://localhost/api/sessions",
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/sessions POST vercel project linking", () => {
  beforeEach(() => {
    currentSession = {
      user: {
        id: "user-1",
        username: "nico",
        name: "Nico",
      },
    };
    existingSessionCount = 0;
    savedLink = null;
    currentVercelToken = "vercel-token";
    matchingProjects = [];
    createCalls.length = 0;
    upsertCalls.length = 0;
  });

  test("blocks additional sessions for non-Vercel trial users on the managed deployment", async () => {
    const { POST } = await routeModulePromise;

    currentSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        username: "nico",
        name: "Nico",
        email: "person@example.com",
      },
    };
    existingSessionCount = 1;

    const response = await POST(
      createJsonRequest(
        {
          branch: "main",
          cloneUrl: ALLOWED_CLONE_URL,
          repoOwner: ALLOWED_REPO_OWNER,
          repoName: ALLOWED_REPO_NAME,
        },
        "https://open-agents.dev/api/sessions",
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "This hosted deployment includes 1 trial session for non-Vercel accounts. Deploy your own copy to start more.",
    );
    expect(createCalls).toHaveLength(0);
  });

  test("uses the repo default model when the saved default is not allowlisted", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
      }),
    );
    const body = (await response.json()) as {
      chat: {
        modelId: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.chat.modelId).toBe(APP_DEFAULT_MODEL_ID);
  });

  test("explicit Vercel project is validated against live repo matches before it is persisted", async () => {
    const { POST } = await routeModulePromise;

    const vercelProject: VercelProjectSelection = {
      projectId: "project-1",
      projectName: "tampered-name",
      teamId: "team-x",
      teamSlug: "tampered-team",
    };
    matchingProjects = [
      {
        projectId: "project-1",
        projectName: "app",
        teamId: "team-1",
        teamSlug: "acme",
      },
    ];

    const response = await POST(
      createJsonRequest({
        repoOwner: "BuildrTech",
        repoName: "App",
        branch: "main",
        cloneUrl: "https://github.com/BuildrTech/App",
        vercelProject,
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(upsertCalls).toEqual([
      {
        userId: "user-1",
        repoOwner: "BuildrTech",
        repoName: "App",
        project: matchingProjects[0],
      },
    ]);
    expect(createCalls[0]).toMatchObject({
      repoOwner: "BuildrTech",
      repoName: "App",
      vercelProjectId: "project-1",
      vercelProjectName: "app",
      vercelTeamId: "team-1",
      vercelTeamSlug: "acme",
    });
    expect(body.session.vercelProjectId).toBe("project-1");
    expect(body.session.vercelProjectName).toBe("app");
  });

  test("rejects explicit Vercel projects that are not a live match for the repo", async () => {
    const { POST } = await routeModulePromise;

    matchingProjects = [
      {
        projectId: "project-2",
        projectName: "dashboard",
        teamId: null,
        teamSlug: null,
      },
    ];

    const response = await POST(
      createJsonRequest({
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
        vercelProject: {
          projectId: "project-999",
          projectName: "rogue-project",
          teamId: null,
          teamSlug: null,
        },
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Selected Vercel project no longer matches this repository",
    );
    expect(upsertCalls).toHaveLength(0);
    expect(createCalls).toHaveLength(0);
  });

  test("omitting vercelProject falls back to the saved repo link", async () => {
    const { POST } = await routeModulePromise;

    savedLink = {
      projectId: "project-2",
      projectName: "dashboard",
      teamId: null,
      teamSlug: null,
    };

    const response = await POST(
      createJsonRequest({
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(upsertCalls).toHaveLength(0);
    expect(createCalls[0]).toMatchObject({
      vercelProjectId: "project-2",
      vercelProjectName: "dashboard",
      vercelTeamId: null,
      vercelTeamSlug: null,
    });
    expect(body.session.vercelProjectName).toBe("dashboard");
  });

  test("explicit null suppresses Vercel linking for that session", async () => {
    const { POST } = await routeModulePromise;

    savedLink = {
      projectId: "project-2",
      projectName: "dashboard",
      teamId: null,
      teamSlug: null,
    };

    const response = await POST(
      createJsonRequest({
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
        vercelProject: null,
      }),
    );
    const body = (await response.json()) as {
      session: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(upsertCalls).toHaveLength(0);
    expect(createCalls[0]).toMatchObject({
      vercelProjectId: null,
      vercelProjectName: null,
      vercelTeamId: null,
      vercelTeamSlug: null,
    });
    expect(body.session.vercelProjectId).toBeNull();
  });

  test("new sessions snapshot the user global skill refs", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
      }),
    );

    expect(response.status).toBe(200);
    expect(createCalls[0]).toMatchObject({
      globalSkillRefs: [{ source: "vercel/ai", skillName: "ai-sdk" }],
    });
  });

  test("rejects invalid repository owners", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: 'vercel" && echo nope && "',
        repoName: ALLOWED_REPO_NAME,
        branch: "main",
        cloneUrl: ALLOWED_CLONE_URL,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid repository owner");
    expect(createCalls).toHaveLength(0);
  });

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

  test("rejects blocked cloneUrl requests even when owner and repo are omitted", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        cloneUrl: "https://github.com/acme/repo",
        branch: "main",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(REPOSITORY_LAUNCH_ALLOWLIST_ERROR);
    expect(createCalls).toHaveLength(0);
  });

  test("persists autoCreatePr when autoCommitPush is enabled", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      createJsonRequest({
        repoOwner: ALLOWED_REPO_OWNER,
        repoName: ALLOWED_REPO_NAME,
        branch: "feature/auto-pr",
        cloneUrl: ALLOWED_CLONE_URL,
        autoCommitPush: true,
        autoCreatePr: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(createCalls[0]).toMatchObject({
      autoCommitPushOverride: true,
      autoCreatePrOverride: true,
    });
  });
});
