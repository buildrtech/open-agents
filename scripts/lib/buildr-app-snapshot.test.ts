import { describe, expect, test } from "bun:test";
import {
  BUILDR_APP_SNAPSHOT_CONTEXT_ROOT,
  buildBuildrAppSnapshotCommands,
  collectBuildrAppSnapshotInputs,
} from "./buildr-app-snapshot";

describe("collectBuildrAppSnapshotInputs", () => {
  test("collects the Buildr app install context", async () => {
    const result = await collectBuildrAppSnapshotInputs({
      appRoot: "../app",
      readTextFile: async (path) => `content:${path}`,
      listFiles: async (directory) => {
        if (!directory.endsWith("gems/email_forward_parser")) {
          return [];
        }

        return [
          "gems/email_forward_parser/Gemfile",
          "gems/email_forward_parser/email_forward_parser.gemspec",
          "gems/email_forward_parser/lib/email_forward_parser.rb",
        ];
      },
    });

    expect(result.stagedFiles).toEqual([
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/Gemfile`,
        content: "content:../app/Gemfile",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/Gemfile.lock`,
        content: "content:../app/Gemfile.lock",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/package.json`,
        content: "content:../app/package.json",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/pnpm-lock.yaml`,
        content: "content:../app/pnpm-lock.yaml",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/pnpm-workspace.yaml`,
        content: "content:../app/pnpm-workspace.yaml",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/.npmrc`,
        content: "content:../app/.npmrc",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/.tool-versions`,
        content: "content:../app/.tool-versions",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/mise.toml`,
        content: "content:../app/mise.toml",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/gems/email_forward_parser/Gemfile`,
        content: "content:../app/gems/email_forward_parser/Gemfile",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/gems/email_forward_parser/email_forward_parser.gemspec`,
        content:
          "content:../app/gems/email_forward_parser/email_forward_parser.gemspec",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/gems/email_forward_parser/lib/email_forward_parser.rb`,
        content:
          "content:../app/gems/email_forward_parser/lib/email_forward_parser.rb",
      },
    ]);
  });
});

describe("buildBuildrAppSnapshotCommands", () => {
  test("builds commands that install system deps, services, toolchains, and warm caches", () => {
    const commands = buildBuildrAppSnapshotCommands();

    expect(commands.some((command) => command.includes("postgresql-18"))).toBe(
      true,
    );
    expect(commands.some((command) => command.includes("redis-server"))).toBe(
      true,
    );
    expect(commands.some((command) => command.includes("bundle install"))).toBe(
      true,
    );
    expect(
      commands.some((command) =>
        command.includes("pnpm install --frozen-lockfile"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(`rm -rf ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}`),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("rm -f /root/.npmrc")),
    ).toBe(true);
    expect(commands.at(-1)).toContain("/vercel/sandbox");
  });
});
