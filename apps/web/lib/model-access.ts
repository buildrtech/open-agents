import type { UserPreferencesData } from "@/lib/db/user-preferences";
import { isManagedTemplateTrialUser } from "@/lib/managed-template-trial";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import {
  filterAllowedModelVariants,
  filterAllowedModels,
  isModelAllowed,
} from "@/lib/model-availability";
import {
  getAllVariants,
  MODEL_VARIANT_ID_PREFIX,
  type ModelVariant,
} from "@/lib/model-variants";
import type { Session } from "@/lib/session/types";

const RESTRICTED_MODEL_PREFIXES = ["anthropic/claude-opus-"];

export const MANAGED_TEMPLATE_TRIAL_MODEL_ACCESS_ERROR =
  "This hosted deployment does not allow Claude Opus models for non-Vercel trial accounts. Deploy your own copy for full model access.";

type SessionLike = Pick<Session, "authProvider" | "user"> | null | undefined;

function hasManagedTemplateModelRestrictions(
  session: SessionLike,
  url: string | URL,
): boolean {
  return isManagedTemplateTrialUser(session, url);
}

export function isRestrictedModelIdForSession(
  modelId: string,
  session: SessionLike,
  url: string | URL,
): boolean {
  if (!hasManagedTemplateModelRestrictions(session, url)) {
    return false;
  }

  return RESTRICTED_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

export function filterModelsForSession<T extends { id: string }>(
  models: T[],
  session: SessionLike,
  url: string | URL,
): T[] {
  const companyAllowedModels = filterAllowedModels(models);
  if (!hasManagedTemplateModelRestrictions(session, url)) {
    return companyAllowedModels;
  }

  return companyAllowedModels.filter(
    (model) =>
      !RESTRICTED_MODEL_PREFIXES.some((prefix) => model.id.startsWith(prefix)),
  );
}

export function filterModelVariantsForSession(
  modelVariants: ModelVariant[],
  session: SessionLike,
  url: string | URL,
): ModelVariant[] {
  const companyAllowedVariants = filterAllowedModelVariants(modelVariants);
  if (!hasManagedTemplateModelRestrictions(session, url)) {
    return companyAllowedVariants;
  }

  return companyAllowedVariants.filter(
    (variant) =>
      !RESTRICTED_MODEL_PREFIXES.some((prefix) =>
        variant.baseModelId.startsWith(prefix),
      ),
  );
}

export function sanitizeSelectedModelIdForSession(
  modelId: string | null | undefined,
  modelVariants: ModelVariant[],
  session: SessionLike,
  url: string | URL,
): string | null | undefined {
  if (!modelId) {
    return modelId;
  }

  if (
    !modelId.startsWith(MODEL_VARIANT_ID_PREFIX) &&
    !isModelAllowed(modelId)
  ) {
    return APP_DEFAULT_MODEL_ID;
  }

  if (
    modelId.startsWith(MODEL_VARIANT_ID_PREFIX) &&
    !filterModelVariantsForSession(modelVariants, session, url).some(
      (variant) => variant.id === modelId,
    )
  ) {
    return APP_DEFAULT_MODEL_ID;
  }

  if (
    hasManagedTemplateModelRestrictions(session, url) &&
    RESTRICTED_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix))
  ) {
    return APP_DEFAULT_MODEL_ID;
  }

  return modelId;
}

export function sanitizeUserPreferencesForSession(
  preferences: UserPreferencesData,
  session: SessionLike,
  url: string | URL,
): UserPreferencesData {
  const filteredModelVariants = filterModelVariantsForSession(
    preferences.modelVariants,
    session,
    url,
  );
  const availableModelVariants = filterModelVariantsForSession(
    getAllVariants(filteredModelVariants),
    session,
    url,
  );

  return {
    ...preferences,
    defaultModelId:
      sanitizeSelectedModelIdForSession(
        preferences.defaultModelId,
        availableModelVariants,
        session,
        url,
      ) ?? APP_DEFAULT_MODEL_ID,
    defaultSubagentModelId:
      sanitizeSelectedModelIdForSession(
        preferences.defaultSubagentModelId,
        availableModelVariants,
        session,
        url,
      ) !== preferences.defaultSubagentModelId
        ? null
        : preferences.defaultSubagentModelId,
    modelVariants: filteredModelVariants,
    enabledModelIds: preferences.enabledModelIds.filter(
      (modelId) =>
        isModelAllowed(modelId) &&
        !isRestrictedModelIdForSession(modelId, session, url),
    ),
  };
}
