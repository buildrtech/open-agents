import { describe, expect, test } from "bun:test";
import { clearSandboxResumeState, clearSandboxState } from "./utils";

describe("sandbox state utils", () => {
  test("clearSandboxState preserves non-secret env prefix for resumed sandboxes", () => {
    expect(
      clearSandboxState({
        type: "vercel",
        sandboxName: "session_123",
        expiresAt: Date.now() + 60_000,
        envPrefix: "BUILDRTECH_APP",
      }),
    ).toEqual({
      type: "vercel",
      sandboxName: "session_123",
      envPrefix: "BUILDRTECH_APP",
    });
  });

  test("clearSandboxResumeState removes env prefix with the resume handle", () => {
    expect(
      clearSandboxResumeState({
        type: "vercel",
        sandboxName: "session_123",
        envPrefix: "BUILDRTECH_APP",
      }),
    ).toEqual({ type: "vercel" });
  });
});
