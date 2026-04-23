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

const BUILDR_APP_BUILD_PACKAGES = [
  "gcc",
  "gcc-c++",
  "libffi-devel",
  "libpq-devel",
  "libyaml-devel",
  "make",
  "openssl-devel",
  "pkgconf-pkg-config",
] as const;

const BUILDR_APP_SYSTEM_PACKAGES = [
  "ImageMagick",
  "jq",
  "libheif",
  "libheif-devel",
  "qpdf",
] as const;

const BUILDR_APP_SERVICE_PACKAGES = [
  "postgresql17",
  "postgresql17-server",
  "redis6",
] as const;

const BUILDR_APP_RUNTIME_HOME = "/home/vercel-sandbox";
const BUILDR_APP_RUNTIME_PATH =
  "/home/vercel-sandbox/.local/share/mise/shims:/home/vercel-sandbox/.local/bin:$PATH";
const BUILDR_APP_MISE_INSTALLS_DIRECTORY =
  "/home/vercel-sandbox/.local/share/mise/installs";
const BUILDR_APP_POSTGRES_DATA_DIRECTORY = "/var/lib/pgsql/data";
const BUILDR_APP_RUBY_VERSION = "4.0.2";
const BUILDR_APP_NODE_VERSION = "24.14.0";
const BUILDR_APP_PYTHON_VERSION = "3.13.3";
const BUILDR_APP_AST_GREP_VERSION = "0.40.5";
const BUILDR_APP_PNPM_VERSION = "10.28.2";
const BUILDR_APP_RUBY_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/ruby/${BUILDR_APP_RUBY_VERSION}/bin`;
const BUILDR_APP_NODE_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/node/${BUILDR_APP_NODE_VERSION}/bin`;
const BUILDR_APP_PYTHON_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/python/${BUILDR_APP_PYTHON_VERSION}/bin`;

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

function shouldStageLocalGemFile(relativePath: string): boolean {
  return (
    relativePath.endsWith(".gemspec") ||
    relativePath.endsWith("/README.md") ||
    relativePath.includes("/lib/")
  );
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
      .filter((relativePath) => shouldStageLocalGemFile(relativePath))
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
    "sudo dnf install -y --allowerasing gnupg2",
    `sudo dnf install -y ${BUILDR_APP_BUILD_PACKAGES.join(" ")}`,
    `sudo dnf install -y ${BUILDR_APP_SYSTEM_PACKAGES.join(" ")}`,
    `sudo dnf install -y ${BUILDR_APP_SERVICE_PACKAGES.join(" ")}`,
    "sudo dnf clean all",
    `sudo install -d -o postgres -g postgres ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}`,
    `test -f ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/PG_VERSION || (sudo rm -rf ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} && sudo install -d -o postgres -g postgres ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} && sudo -u postgres initdb -D ${BUILDR_APP_POSTGRES_DATA_DIRECTORY})`,
    `sudo sed -i "s/^#listen_addresses = .*/listen_addresses = '127.0.0.1'/" ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/postgresql.conf`,
    `sudo sed -i 's/^local\\s\\+all\\s\\+all\\s\\+peer$/local all all trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    `sudo sed -i 's/^host\\s\\+all\\s\\+all\\s\\+127\\.0\\.0\\.1\\/32\\s\\+scram-sha-256$/host all all 127.0.0.1\\/32 trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    `sudo sed -i 's/^host\\s\\+all\\s\\+all\\s\\+::1\\/128\\s\\+scram-sha-256$/host all all ::1\\/128 trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    "sudo ln -sf /usr/bin/redis6-server /usr/local/bin/redis-server",
    "sudo ln -sf /usr/bin/redis6-cli /usr/local/bin/redis-cli",
    "curl https://mise.run | sh",
    `sudo ln -sf ${BUILDR_APP_RUNTIME_HOME}/.local/bin/mise /usr/local/bin/mise`,
    `sudo sh -c "printf '%s\\n' 'export PATH=${BUILDR_APP_RUNTIME_PATH}' > /etc/profile.d/mise-path.sh"`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install ruby@${BUILDR_APP_RUBY_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/ruby /usr/local/bin/ruby && sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/bundle /usr/local/bin/bundle && sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/gem /usr/local/bin/gem`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install node@${BUILDR_APP_NODE_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/node /usr/local/bin/node && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/npm /usr/local/bin/npm && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/npx /usr/local/bin/npx && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/corepack /usr/local/bin/corepack`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install python@${BUILDR_APP_PYTHON_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_PYTHON_BIN_DIRECTORY}/python3 /usr/local/bin/python3 && sudo ln -sf ${BUILDR_APP_PYTHON_BIN_DIRECTORY}/python3 /usr/local/bin/python`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise use -g ruby@${BUILDR_APP_RUBY_VERSION} node@${BUILDR_APP_NODE_VERSION} python@${BUILDR_APP_PYTHON_VERSION}`,
    `npm install -g pnpm@${BUILDR_APP_PNPM_VERSION} @ast-grep/cli@${BUILDR_APP_AST_GREP_VERSION} && sudo ln -sf "$(command -v pnpm)" /usr/local/bin/pnpm && sudo ln -sf "$(command -v ast-grep)" /usr/local/bin/ast-grep`,
    `install -d ${BUILDR_APP_RUNTIME_HOME}/.bundle ${BUILDR_APP_RUNTIME_HOME}/.local/share/pnpm/store`,
    `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && /usr/local/bin/bundle install --jobs 1 --retry 3`,
    `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && /usr/local/bin/pnpm install --frozen-lockfile --store-dir ${BUILDR_APP_RUNTIME_HOME}/.local/share/pnpm/store`,
    `rm -f ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/.npmrc`,
    `rm -f ${BUILDR_APP_RUNTIME_HOME}/.npmrc ${BUILDR_APP_RUNTIME_HOME}/.bundle/config ${BUILDR_APP_RUNTIME_HOME}/.gem/credentials`,
    `rm -rf ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}`,
    'test -z "$(ls -A /vercel/sandbox)"',
  ];
}
