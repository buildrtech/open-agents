import { describe, expect, test } from "bun:test";
import type { ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import {
  ALLOWED_MODEL_IDS,
  ALLOWED_PROVIDER_IDS,
  assertDefaultModelIsAllowed,
  filterAllowedModelVariants,
  filterAllowedModels,
  getRequiredProviderOptionsForModel,
  isModelAllowed,
  resolveAvailableModelId,
} from "./model-availability";

describe("model availability", () => {
  test("allows only the company-approved model ids", () => {
    expect(Array.from(ALLOWED_MODEL_IDS)).toEqual([
      "openai/gpt-5.4",
      "moonshotai/kimi-k2.6",
    ]);

    expect(isModelAllowed("openai/gpt-5.4")).toBe(true);
    expect(isModelAllowed("moonshotai/kimi-k2.6")).toBe(true);
    expect(isModelAllowed("openai/gpt-5")).toBe(false);
    expect(isModelAllowed("anthropic/claude-sonnet-4.6")).toBe(false);
  });

  test("tracks the runtime provider allowlist", () => {
    expect(Array.from(ALLOWED_PROVIDER_IDS)).toEqual(["openai", "fireworks"]);
  });

  test("filters model lists and model variants through the allowlist", () => {
    const variants: ModelVariant[] = [
      {
        id: "variant:kimi-fast",
        name: "Kimi Fast",
        baseModelId: "moonshotai/kimi-k2.6",
        providerOptions: {},
      },
      {
        id: "variant:blocked",
        name: "Blocked",
        baseModelId: "anthropic/claude-sonnet-4.6",
        providerOptions: {},
      },
    ];

    expect(
      filterAllowedModels([
        { id: "openai/gpt-5.4" },
        { id: "moonshotai/kimi-k2.6" },
        { id: "anthropic/claude-sonnet-4.6" },
      ]),
    ).toEqual([{ id: "openai/gpt-5.4" }, { id: "moonshotai/kimi-k2.6" }]);

    expect(filterAllowedModelVariants(variants)).toEqual([
      {
        id: "variant:kimi-fast",
        name: "Kimi Fast",
        baseModelId: "moonshotai/kimi-k2.6",
        providerOptions: {},
      },
    ]);
  });

  test("returns required provider routing overrides for allowed models", () => {
    expect(getRequiredProviderOptionsForModel("openai/gpt-5.4")).toEqual({
      gateway: {
        only: ["openai"],
        order: ["openai"],
      },
    });

    expect(getRequiredProviderOptionsForModel("moonshotai/kimi-k2.6")).toEqual({
      gateway: {
        only: ["fireworks"],
        order: ["fireworks"],
      },
    });

    expect(
      getRequiredProviderOptionsForModel("anthropic/claude-sonnet-4.6"),
    ).toBeUndefined();
  });

  test("falls back to the repo default for disallowed model ids", () => {
    expect(resolveAvailableModelId("openai/gpt-5.4")).toBe("openai/gpt-5.4");
    expect(resolveAvailableModelId("moonshotai/kimi-k2.6")).toBe(
      "moonshotai/kimi-k2.6",
    );
    expect(resolveAvailableModelId("anthropic/claude-sonnet-4.6")).toBe(
      APP_DEFAULT_MODEL_ID,
    );
  });

  test("asserts the repo default model remains allowlisted", () => {
    expect(() => assertDefaultModelIsAllowed()).not.toThrow();
  });
});
