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
          if (!directory.endsWith("packages/bdev")) {
            return [];
          }

          return [
            "packages/bdev/cmd/agent_context.md",
            "packages/bdev/cmd/root.go",
            "packages/bdev/cmd/root_test.go",
            "packages/bdev/go.mod",
            "packages/bdev/go.sum",
            "packages/bdev/internal/devenv/devenv.go",
            "packages/bdev/internal/devenv/devenv_test.go",
            "packages/bdev/main.go",
          ];
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
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/cmd/agent_context.md`,
        content: "content:../app/packages/bdev/cmd/agent_context.md",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/cmd/root.go`,
        content: "content:../app/packages/bdev/cmd/root.go",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/go.mod`,
        content: "content:../app/packages/bdev/go.mod",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/go.sum`,
        content: "content:../app/packages/bdev/go.sum",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/internal/devenv/devenv.go`,
        content: "content:../app/packages/bdev/internal/devenv/devenv.go",
      },
      {
        path: `${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev/main.go`,
        content: "content:../app/packages/bdev/main.go",
      },
    ]);
  });
});

describe("buildBuildrAppSnapshotCommands", () => {
  test("builds commands that install the buildr qa runtime contract", () => {
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
      commands.some((command) => command.includes("postgresql17-contrib")),
    ).toBe(true);
    expect(commands.some((command) => command.includes("spal-release"))).toBe(
      false,
    );
    expect(
      commands.some((command) => command.includes("postgresql17-server-devel")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "https://download.osgeo.org/postgis/source/postgis-3.5.6.tar.gz",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "./configure --with-pgconfig=/usr/bin/pg_config --without-raster --without-topology --with-gettext=no",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("CREATE EXTENSION postgis;")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("vips-8.17.3.tar.xz")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("meson setup build")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("/etc/ld.so.conf.d/local-libvips.conf"),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("xz"))).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("sudo ln -sf /usr/local/bin/vips /usr/bin/vips"),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("vips --version"))).toBe(
      true,
    );
    expect(
      commands.some((command) =>
        command.includes(
          "sudo install -d -o postgres -g postgres /var/lib/pgsql/data",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "test -f /var/lib/pgsql/data/PG_VERSION || (sudo rm -rf /var/lib/pgsql/data && sudo install -d -o postgres -g postgres /var/lib/pgsql/data && sudo -u postgres initdb -D /var/lib/pgsql/data)",
        ),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("valkey"))).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "sudo ln -sf /usr/bin/valkey-server /usr/bin/redis-server",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("redis-server --version")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("mise install ruby@4.0.2")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("mise install node@24.14.0")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("mise install go@1.25.0")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("mise install python@3.13.3"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("/usr/local/bin/go")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("unix_socket_directories = '/tmp'"),
      ),
    ).toBe(true);
    expect(commands.some((command) => command.includes("exiftool"))).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("LibreOffice_26.2.2_Linux_x86-64_rpm.tar.gz"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("/usr/local/bin/ruby")),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("/usr/local/bin/pnpm")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/packages/bdev && go build -o /tmp/bdev .`,
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("sudo install -m 0755 /tmp/bdev /usr/bin/bdev"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "https://github.com/meilisearch/meilisearch/releases/download/v1.12.0/meilisearch-linux-amd64",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "865a3fc222e3b3bd1f4b64346cb114b9669af691aae28d71fa68dbf39427abcf",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "sudo install -m 0755 /tmp/meilisearch-linux-amd64 /usr/bin/meilisearch",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("meilisearch --version")),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes("corepack install --global pnpm@10.28.2"),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          "https://github.com/ast-grep/ast-grep/releases/download/0.40.5/app-x86_64-unknown-linux-gnu.zip",
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes('python3 -c "import zipfile;'),
      ),
    ).toBe(true);
    expect(
      commands.some((command) =>
        command.includes(
          'for tool in go bdev meilisearch vips pg_config psql createdb dropdb pg_ctl redis-server exiftool soffice; do command -v "$tool" >/dev/null || exit 1',
        ),
      ),
    ).toBe(true);
    expect(
      commands.some((command) => command.includes("postgresql17-postgis")),
    ).toBe(false);
    expect(commands.some((command) => command.includes("apt-get"))).toBe(false);
    expect(
      commands.some((command) =>
        command.includes("npm install -g pnpm@10.28.2 @ast-grep/cli@0.40.5"),
      ),
    ).toBe(false);
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
