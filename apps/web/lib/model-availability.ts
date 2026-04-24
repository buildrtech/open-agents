import type { ProviderOptionsByProvider } from "@open-agents/agent";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";

export const ALLOWED_PROVIDER_IDS = new Set(["openai", "fireworks"]);

export const ALLOWED_MODEL_IDS = new Set([
  APP_DEFAULT_MODEL_ID,
  "moonshotai/kimi-k2.6",
]);

export function assertDefaultModelIsAllowed(): void {
  if (!ALLOWED_MODEL_IDS.has(APP_DEFAULT_MODEL_ID)) {
    throw new Error(
      `APP_DEFAULT_MODEL_ID must be allowlisted: ${APP_DEFAULT_MODEL_ID}`,
    );
  }
}

export function isModelAllowed(modelId: string): boolean {
  return ALLOWED_MODEL_IDS.has(modelId);
}

export function filterAllowedModels<T extends { id: string }>(
  models: T[],
): T[] {
  return models.filter((model) => isModelAllowed(model.id));
}

export function filterAllowedModelVariants<T extends { baseModelId: string }>(
  variants: T[],
): T[] {
  return variants.filter((variant) => isModelAllowed(variant.baseModelId));
}

export function getRequiredProviderOptionsForModel(
  modelId: string,
): ProviderOptionsByProvider | undefined {
  if (modelId === "openai/gpt-5.5") {
    return {
      gateway: {
        only: ["openai"],
        order: ["openai"],
      },
    };
  }

  if (modelId === "moonshotai/kimi-k2.6") {
    return {
      gateway: {
        only: ["fireworks"],
        order: ["fireworks"],
      },
    };
  }

  return undefined;
}

export function resolveAvailableModelId(modelId: string): string {
  return isModelAllowed(modelId) ? modelId : APP_DEFAULT_MODEL_ID;
}
