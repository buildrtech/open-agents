import { describe, expect, test } from "bun:test";
import { BUILT_IN_VARIANTS, type ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { resolveChatModelSelection } from "./model-selection";

describe("resolveChatModelSelection", () => {
  test("applies required gateway routing for direct allowlisted model ids", () => {
    expect(
      resolveChatModelSelection({
        selectedModelId: "openai/gpt-5.5",
        modelVariants: [],
        missingVariantLabel: "Selected model variant",
      }),
    ).toEqual({
      id: "openai/gpt-5.5",
      providerOptionsOverrides: {
        gateway: {
          only: ["openai"],
          order: ["openai"],
        },
      },
    });

    expect(
      resolveChatModelSelection({
        selectedModelId: "moonshotai/kimi-k2.6",
        modelVariants: [],
        missingVariantLabel: "Selected model variant",
      }),
    ).toEqual({
      id: "moonshotai/kimi-k2.6",
      providerOptionsOverrides: {
        gateway: {
          only: ["fireworks"],
          order: ["fireworks"],
        },
      },
    });
  });

  test("merges variant provider options with required gateway routing", () => {
    const modelVariants: ModelVariant[] = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5.5",
        providerOptions: {
          reasoningEffort: "medium",
        },
      },
    ];

    const selection = resolveChatModelSelection({
      selectedModelId: "variant:openai-medium",
      modelVariants,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5.5",
      providerOptionsOverrides: {
        gateway: {
          only: ["openai"],
          order: ["openai"],
        },
        openai: {
          reasoningEffort: "medium",
          store: false,
        },
      },
    });
  });

  test("resolves built-in OpenAI variants with store false", () => {
    const selection = resolveChatModelSelection({
      selectedModelId: "variant:builtin:gpt-5.5-xhigh",
      modelVariants: BUILT_IN_VARIANTS,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5.5",
      providerOptionsOverrides: {
        gateway: {
          only: ["openai"],
          order: ["openai"],
        },
        openai: {
          reasoningEffort: "xhigh",
          reasoningSummary: "auto",
          store: false,
        },
      },
    });
  });

  test("falls back to the default model and warns when a variant is missing", () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const selection = resolveChatModelSelection({
        selectedModelId: "variant:missing",
        modelVariants: [],
        missingVariantLabel: "Selected model variant",
      });

      expect(selection).toEqual({
        id: APP_DEFAULT_MODEL_ID,
        providerOptionsOverrides: {
          gateway: {
            only: ["openai"],
            order: ["openai"],
          },
        },
      });
      expect(warnings).toEqual([
        [
          'Selected model variant "variant:missing" was not found. Falling back to default model.',
        ],
      ]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("uses the default model when no model id is provided", () => {
    const selection = resolveChatModelSelection({
      selectedModelId: null,
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: APP_DEFAULT_MODEL_ID,
      providerOptionsOverrides: {
        gateway: {
          only: ["openai"],
          order: ["openai"],
        },
      },
    });
  });
});
