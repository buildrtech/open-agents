import { describe, expect, test } from "bun:test";
import { buildSandboxEnvFromPrefix } from "./env-prefix";

describe("sandbox env prefix", () => {
  test("strips the namespace prefix from matching env keys", () => {
    expect(
      buildSandboxEnvFromPrefix("BUILDRTECH_APP", {
        BUILDRTECH_APP_RAILS_MASTER_KEY: "master-key",
        BUILDRTECH_APP_STRIPE_SECRET_KEY: "stripe-secret",
        OTHER_APP_RAILS_MASTER_KEY: "wrong-repo",
      }),
    ).toEqual({
      RAILS_MASTER_KEY: "master-key",
      STRIPE_SECRET_KEY: "stripe-secret",
    });
  });

  test("requires an exact prefix boundary and valid stripped env names", () => {
    expect(
      buildSandboxEnvFromPrefix("BUILDRTECH_APP", {
        BUILDRTECH_APP: "not-prefixed",
        BUILDRTECH_APPLICATION_KEY: "wrong-boundary",
        BUILDRTECH_APP_1INVALID: "invalid-name",
        BUILDRTECH_APP_VALID_NAME: "valid",
      }),
    ).toEqual({
      VALID_NAME: "valid",
    });
  });

  test("returns an empty env map when the prefix is missing", () => {
    expect(
      buildSandboxEnvFromPrefix(undefined, {
        BUILDRTECH_APP_SECRET: "secret",
      }),
    ).toEqual({});
  });
});
