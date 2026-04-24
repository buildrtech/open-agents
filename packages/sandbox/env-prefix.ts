const SANDBOX_ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export function buildSandboxEnvFromPrefix(
  envPrefix: string | undefined,
  sourceEnv: Record<string, string | undefined> = process.env,
): Record<string, string> {
  if (!envPrefix) {
    return {};
  }

  const keyPrefix = `${envPrefix}_`;
  const sandboxEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (typeof value !== "string" || !key.startsWith(keyPrefix)) {
      continue;
    }

    const sandboxKey = key.slice(keyPrefix.length);
    if (!SANDBOX_ENV_NAME_PATTERN.test(sandboxKey)) {
      continue;
    }

    sandboxEnv[sandboxKey] = value;
  }

  return sandboxEnv;
}

export function mergeSandboxEnv(
  prefixedEnv: Record<string, string>,
  explicitEnv: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const mergedEnv = {
    ...prefixedEnv,
    ...explicitEnv,
  };

  return Object.keys(mergedEnv).length > 0 ? mergedEnv : undefined;
}
