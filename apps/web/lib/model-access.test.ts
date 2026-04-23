import { describe, expect, test } from "bun:test";
import type { UserPreferencesData } from "@/lib/db/user-preferences";
import type { ModelVariant } from "@/lib/model-variants";
import {
  filterModelsForSession,
  filterModelVariantsForSession,
  sanitizeSelectedModelIdForSession,
  sanitizeUserPreferencesForSession,
} from "./model-access";

const managedTrialSession = {
  authProvider: "vercel" as const,
  user: {
    id: "user-1",
    username: "alice",
    email: "alice@example.com",
    avatar: "",
  },
};

const vercelSession = {
  authProvider: "vercel" as const,
  user: {
    id: "user-2",
    username: "vercel-user",
    email: "dev@vercel.com",
    avatar: "",
  },
};

const requestUrl = "https://open-agents.dev/api/test";

const userKimiVariant: ModelVariant = {
  id: "variant:user-kimi",
  name: "User Kimi",
  baseModelId: "moonshotai/kimi-k2.6",
  providerOptions: {},
};

const userOpusVariant: ModelVariant = {
  id: "variant:user-opus",
  name: "User Opus",
  baseModelId: "anthropic/claude-opus-4.6",
  providerOptions: { effort: "high" },
};

const basePreferences: UserPreferencesData = {
  defaultModelId: "moonshotai/kimi-k2.6",
  defaultSubagentModelId: "openai/gpt-5.4",
  defaultSandboxType: "vercel",
  defaultDiffMode: "unified",
  autoCommitPush: false,
  autoCreatePr: false,
  alertsEnabled: true,
  alertSoundEnabled: true,
  publicUsageEnabled: false,
  globalSkillRefs: [],
  modelVariants: [userKimiVariant],
};

describe("model access gating", () => {
  test("filters base models to the company allowlist", () => {
    const result = filterModelsForSession(
      [
        { id: "openai/gpt-5.4" },
        { id: "moonshotai/kimi-k2.6" },
        { id: "anthropic/claude-opus-4.6" },
      ],
      vercelSession,
      requestUrl,
    );

    expect(result).toEqual([
      { id: "openai/gpt-5.4" },
      { id: "moonshotai/kimi-k2.6" },
    ]);
  });

  test("filters variants whose base model is not allowlisted", () => {
    const result = filterModelVariantsForSession(
      [
        userKimiVariant,
        userOpusVariant,
      ],
      vercelSession,
      requestUrl,
    );

    expect(result.map((variant) => variant.id)).toEqual(["variant:user-kimi"]);
  });

  test("falls back to the app default when a selected model is not allowlisted", () => {
    const result = sanitizeSelectedModelIdForSession(
      "variant:user-opus",
      [userKimiVariant, userOpusVariant],
      vercelSession,
      requestUrl,
    );

    expect(result).toBe("openai/gpt-5.4");
  });

  test("sanitizes preferences by removing disallowed selections", () => {
    const result = sanitizeUserPreferencesForSession(
      {
        ...basePreferences,
        defaultModelId: "anthropic/claude-opus-4.6",
        defaultSubagentModelId: "variant:user-opus",
        modelVariants: [userKimiVariant, userOpusVariant],
      },
      vercelSession,
      requestUrl,
    );

    expect(result).toMatchObject({
      defaultModelId: "openai/gpt-5.4",
      defaultSubagentModelId: null,
      modelVariants: [userKimiVariant],
    });
  });

  test("leaves already-allowlisted preferences unchanged", () => {
    const result = sanitizeUserPreferencesForSession(
      basePreferences,
      vercelSession,
      requestUrl,
    );

    expect(result).toEqual(basePreferences);
  });
});
