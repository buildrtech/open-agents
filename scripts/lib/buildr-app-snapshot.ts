import { readdir } from "node:fs/promises";
import path from "node:path";
import type { RefreshBaseSnapshotStagedFile } from "@open-agents/sandbox/vercel";

export const BUILDR_APP_SNAPSHOT_CONTEXT_ROOT = "/tmp/buildr-app-snapshot";

const BUILDR_APP_INSTALL_INPUTS = [
  "Gemfile",
  "Gemfile.lock",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  ".tool-versions",
  "mise.toml",
] as const;

const BUILDR_APP_LOCAL_GEM_DIRECTORIES = ["gems/email_forward_parser"] as const;

const BUILDR_APP_BASE_PACKAGES = [
  "build-essential",
  "ca-certificates",
  "curl",
  "exiftool",
  "git",
  "gnupg",
  "imagemagick",
  "jq",
  "libffi-dev",
  "libheif-dev",
  "libheif1",
  "libjemalloc2",
  "libreoffice",
  "libssl-dev",
  "libvips",
  "libyaml-dev",
  "openssl",
  "pkg-config",
  "qpdf",
  "redis-server",
  "unzip",
] as const;

const BUILDR_APP_POSTGRES_PACKAGES = [
  "postgresql-18",
  "postgresql-18-postgis-3",
  "postgresql-18-postgis-3-scripts",
  "postgresql-client-18",
] as const;

const BUILDR_APP_RUNTIME_PATH =
  "/root/.local/share/mise/shims:/root/.local/bin:$PATH";
const BUILDR_APP_RUBY_VERSION = "4.0.2";
const BUILDR_APP_NODE_VERSION = "24.14.0";
const BUILDR_APP_PYTHON_VERSION = "3.13.3";
const BUILDR_APP_AST_GREP_VERSION = "0.40.5";
const BUILDR_APP_PNPM_VERSION = "10.28.2";

export interface CollectBuildrAppSnapshotInputsOptions {
  appRoot: string;
  readTextFile?: (path: string) => Promise<string>;
  listFiles?: (directory: string) => Promise<string[]>;
}

export interface BuildrAppSnapshotInputs {
  stagedFiles: RefreshBaseSnapshotStagedFile[];
}

async function defaultReadTextFile(filePath: string): Promise<string> {
  return Bun.file(filePath).text();
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }

      if (entry.isFile()) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat().sort();
}

function normalizeRelativePath(filePath: string, appRoot: string): string {
  const normalizedFilePath = path.normalize(filePath);
  const absoluteAppRoot = path.resolve(appRoot);

  if (path.isAbsolute(normalizedFilePath)) {
    return path.relative(absoluteAppRoot, normalizedFilePath);
  }

  return normalizedFilePath;
}

function toSnapshotPath(relativePath: string): string {
  return path.posix.join(
    BUILDR_APP_SNAPSHOT_CONTEXT_ROOT,
    relativePath.split(path.sep).join(path.posix.sep),
  );
}

async function stageRelativeFile(
  appRoot: string,
  relativePath: string,
  readTextFile: (path: string) => Promise<string>,
): Promise<RefreshBaseSnapshotStagedFile> {
  return {
    path: toSnapshotPath(relativePath),
    content: await readTextFile(path.join(appRoot, relativePath)),
  };
}

export async function collectBuildrAppSnapshotInputs(
  options: CollectBuildrAppSnapshotInputsOptions,
): Promise<BuildrAppSnapshotInputs> {
  const readTextFile = options.readTextFile ?? defaultReadTextFile;
  const listFiles = options.listFiles ?? walkFiles;

  const stagedFiles = await Promise.all(
    BUILDR_APP_INSTALL_INPUTS.map((relativePath) =>
      stageRelativeFile(options.appRoot, relativePath, readTextFile),
    ),
  );

  for (const directory of BUILDR_APP_LOCAL_GEM_DIRECTORIES) {
    const directoryFiles = await listFiles(
      path.join(options.appRoot, directory),
    );
    const relativePaths = directoryFiles
      .map((filePath) => normalizeRelativePath(filePath, options.appRoot))
      .sort();

    for (const relativePath of relativePaths) {
      stagedFiles.push(
        await stageRelativeFile(options.appRoot, relativePath, readTextFile),
      );
    }
  }

  return { stagedFiles };
}

export function buildBuildrAppSnapshotCommands(): string[] {
  return [
    "apt-get update -qq",
    `DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y ${BUILDR_APP_BASE_PACKAGES.join(" ")}`,
    "install -d /usr/share/postgresql-common/pgdg",
    "curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg",
    `. /etc/os-release && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt \${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list`,
    "apt-get update -qq",
    `DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y ${BUILDR_APP_POSTGRES_PACKAGES.join(" ")}`,
    "rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*",
    "curl https://mise.run | sh",
    "ln -sf /root/.local/bin/mise /usr/local/bin/mise",
    `printf '%s\n' 'export PATH=${BUILDR_APP_RUNTIME_PATH}' > /etc/profile.d/mise-path.sh`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install ruby@${BUILDR_APP_RUBY_VERSION} node@${BUILDR_APP_NODE_VERSION} python@${BUILDR_APP_PYTHON_VERSION}`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise use -g ruby@${BUILDR_APP_RUBY_VERSION} node@${BUILDR_APP_NODE_VERSION} python@${BUILDR_APP_PYTHON_VERSION}`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && corepack prepare pnpm@${BUILDR_APP_PNPM_VERSION} --activate && npm install -g @ast-grep/cli@${BUILDR_APP_AST_GREP_VERSION}`,
    "install -d /root/.bundle /root/.local/share/pnpm/store",
    `pg_lsclusters -h | awk 'NR > 1 { print $1":"$2 }' | while IFS=: read -r version cluster; do pg_hba="/etc/postgresql/$version/$cluster/pg_hba.conf"; sed -i 's/^local\\s\\+all\\s\\+all\\s\\+peer$/local all all trust/' "$pg_hba"; sed -i 's/^host\\s\\+all\\s\\+all\\s\\+127\\.0\\.0\\.1\\/32\\s\\+scram-sha-256$/host all all 127.0.0.1\\/32 trust/' "$pg_hba"; sed -i 's/^host\\s\\+all\\s\\+all\\s\\+::1\\/128\\s\\+scram-sha-256$/host all all ::1\\/128 trust/' "$pg_hba"; done`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && bundle install --jobs 1 --retry 3`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && pnpm install --frozen-lockfile --store-dir /root/.local/share/pnpm/store`,
    `rm -f ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/.npmrc`,
    "rm -f /root/.npmrc /root/.config/pnpm/rc /root/.bundle/config /root/.gem/credentials",
    `rm -rf ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}`,
    'test -z "$(ls -A /vercel/sandbox)"',
  ];
}
