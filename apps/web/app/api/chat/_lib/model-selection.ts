import {
  mergeProviderOptions,
  type AgentModelSelection,
  type ProviderOptionsByProvider,
} from "@open-agents/agent";
import {
  getRequiredProviderOptionsForModel,
  resolveAvailableModelId,
} from "@/lib/model-availability";
import { type ModelVariant, resolveModelSelection } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";

interface ResolveChatModelSelectionParams {
  selectedModelId: string | null | undefined;
  modelVariants: ModelVariant[];
  missingVariantLabel: string;
}

function createAgentModelSelection(
  modelId: string,
  providerOptionsOverrides?: ProviderOptionsByProvider,
): AgentModelSelection {
  const requiredProviderOptions = getRequiredProviderOptionsForModel(modelId);
  const mergedProviderOptions = requiredProviderOptions
    ? mergeProviderOptions(requiredProviderOptions, providerOptionsOverrides)
    : providerOptionsOverrides;

  return {
    id: modelId as AgentModelSelection["id"],
    ...(mergedProviderOptions
      ? {
          providerOptionsOverrides: mergedProviderOptions,
        }
      : {}),
  };
}

export function resolveChatModelSelection({
  selectedModelId,
  modelVariants,
  missingVariantLabel,
}: ResolveChatModelSelectionParams): AgentModelSelection {
  const requestedModelId = selectedModelId ?? APP_DEFAULT_MODEL_ID;
  const selection = resolveModelSelection(requestedModelId, modelVariants);

  if (selection.isMissingVariant) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" was not found. Falling back to default model.`,
    );
    return createAgentModelSelection(APP_DEFAULT_MODEL_ID);
  }

  const availableModelId = resolveAvailableModelId(selection.resolvedModelId);
  if (availableModelId !== selection.resolvedModelId) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" resolves to disallowed model "${selection.resolvedModelId}". Falling back to default model.`,
    );
    return createAgentModelSelection(APP_DEFAULT_MODEL_ID);
  }

  return createAgentModelSelection(
    availableModelId,
    selection.providerOptionsByProvider as ProviderOptionsByProvider | undefined,
  );
}
