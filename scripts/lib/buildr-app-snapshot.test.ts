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
          "gems/email_forward_parser/README.md",
          "gems/email_forward_parser/email_forward_parser.gemspec",
          "gems/email_forward_parser/lib/email_forward_parser.rb",
          "gems/email_forward_parser/spec/email_forward_parser_spec.rb",
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
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/gems/email_forward_parser/README.md`,
        content: "content:../app/gems/email_forward_parser/README.md",
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
  test("builds commands that install runtime-compatible system deps, services, toolchains, and warm caches", () => {
    const commands = buildBuildrAppSnapshotCommands();

    expect(
      commands.some((command) => command.includes("sudo dnf install -y")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("sudo dnf install -y --allowerasing gnupg2"),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("postgresql17"))).toBe(
      true,
    );
    expect(
      commands.some((command) =>
        command.includes("sudo -u postgres initdb -D /var/lib/pgsql/data"),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("redis6"))).toBe(true);
    expect(
      commands.some((command) => command.includes("mise install ruby@4.0.2")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("mise install node@24.14.0")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("mise install python@3.13.3"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("/usr/local/bin/ruby")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("/usr/local/bin/pnpm")),
    ).toBe(true);
    expect(commands.some((command) => command.includes("apt-get"))).toBe(false);
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
      commands.some((command) =>
        command.includes("rm -f /home/vercel-sandbox/.npmrc"),
      ),
    ).toBe(true);
    expect(commands.at(-1)).toContain("/vercel/sandbox");
  });
});
