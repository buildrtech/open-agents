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

const BUILDR_APP_BDEV_DIRECTORY = "packages/bdev";

const BUILDR_APP_BUILD_PACKAGES = [
  "diffutils",
  "gcc",
  "gcc-c++",
  "libffi-devel",
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
  "perl",
  "qpdf",
] as const;

const BUILDR_APP_SERVICE_PACKAGES = [
  "postgresql17",
  "postgresql17-contrib",
  "postgresql17-server",
  "valkey",
] as const;

const BUILDR_APP_POSTGIS_BUILD_PACKAGES = [
  "geos",
  "geos-devel",
  "json-c-devel",
  "libxml2-devel",
  "libxslt",
  "libxslt-devel",
  "postgresql17-server-devel",
  "proj",
  "proj-devel",
  "protobuf-c",
  "protobuf-c-devel",
  "protobuf-c-compiler",
] as const;

const BUILDR_APP_LIBVIPS_BUILD_PACKAGES = [
  "expat-devel",
  "glib2-devel",
  "lcms2-devel",
  "libexif-devel",
  "libjpeg-turbo-devel",
  "libpng-devel",
  "libtiff-devel",
  "libwebp-devel",
  "meson",
  "ninja-build",
] as const;

const BUILDR_APP_RUNTIME_HOME = "/home/vercel-sandbox";
const BUILDR_APP_RUNTIME_PATH =
  "/home/vercel-sandbox/.local/share/mise/shims:/home/vercel-sandbox/.local/bin:$PATH";
const BUILDR_APP_MISE_INSTALLS_DIRECTORY =
  "/home/vercel-sandbox/.local/share/mise/installs";
const BUILDR_APP_POSTGRES_DATA_DIRECTORY = "/var/lib/pgsql/data";
const BUILDR_APP_POSTGRES_SOCKET_DIRECTORY = "/tmp";
const BUILDR_APP_RUBY_VERSION = "4.0.2";
const BUILDR_APP_NODE_VERSION = "24.14.0";
const BUILDR_APP_GO_VERSION = "1.25.0";
const BUILDR_APP_PYTHON_VERSION = "3.13.3";
const BUILDR_APP_AST_GREP_VERSION = "0.40.5";
const BUILDR_APP_PNPM_VERSION = "10.28.2";
const BUILDR_APP_AST_GREP_ARCHIVE_NAME = "app-x86_64-unknown-linux-gnu.zip";
const BUILDR_APP_AST_GREP_DOWNLOAD_PATH = "/tmp/ast-grep.zip";
const BUILDR_APP_AST_GREP_EXTRACTED_PATH = "/tmp/ast-grep";
const BUILDR_APP_AST_GREP_DOWNLOAD_URL = `https://github.com/ast-grep/ast-grep/releases/download/${BUILDR_APP_AST_GREP_VERSION}/${BUILDR_APP_AST_GREP_ARCHIVE_NAME}`;
const BUILDR_APP_AST_GREP_SHA256 =
  "9715cb5933a4d7fe9e4d8c2be870a9a82840c3f2ec4a57bdff7f15d0912cc676";
const BUILDR_APP_POSTGIS_VERSION = "3.5.6";
const BUILDR_APP_POSTGIS_ARCHIVE_NAME = `postgis-${BUILDR_APP_POSTGIS_VERSION}.tar.gz`;
const BUILDR_APP_POSTGIS_DOWNLOAD_PATH = `/tmp/${BUILDR_APP_POSTGIS_ARCHIVE_NAME}`;
const BUILDR_APP_POSTGIS_SOURCE_DIRECTORY = `/tmp/postgis-${BUILDR_APP_POSTGIS_VERSION}`;
const BUILDR_APP_POSTGIS_DOWNLOAD_URL = `https://download.osgeo.org/postgis/source/${BUILDR_APP_POSTGIS_ARCHIVE_NAME}`;
const BUILDR_APP_POSTGIS_SHA256 =
  "4f3e51f14c19ba5408c87ef2339eac8f3fa1cc297573dae574d9908d6d597766";
const BUILDR_APP_POSTGIS_VERIFY_DATABASE = "buildr_snapshot_postgis_verify";
const BUILDR_APP_POSTGIS_VERIFY_LOG_PATH = "/tmp/buildr-postgis-verify.log";
const BUILDR_APP_LIBVIPS_VERSION = "8.17.3";
const BUILDR_APP_LIBVIPS_ARCHIVE_NAME = `vips-${BUILDR_APP_LIBVIPS_VERSION}.tar.xz`;
const BUILDR_APP_LIBVIPS_DOWNLOAD_PATH = `/tmp/${BUILDR_APP_LIBVIPS_ARCHIVE_NAME}`;
const BUILDR_APP_LIBVIPS_SOURCE_DIRECTORY = `/tmp/vips-${BUILDR_APP_LIBVIPS_VERSION}`;
const BUILDR_APP_LIBVIPS_DOWNLOAD_URL = `https://github.com/libvips/libvips/releases/download/v${BUILDR_APP_LIBVIPS_VERSION}/${BUILDR_APP_LIBVIPS_ARCHIVE_NAME}`;
const BUILDR_APP_LIBVIPS_SHA256 =
  "41e9a1439cd57dcc6d4435a085e2cfe181d9da1962fa84a484f09e8b536e4b77";
const BUILDR_APP_EXIFTOOL_VERSION = "13.57";
const BUILDR_APP_EXIFTOOL_ARCHIVE_NAME = `Image-ExifTool-${BUILDR_APP_EXIFTOOL_VERSION}.tar.gz`;
const BUILDR_APP_EXIFTOOL_DOWNLOAD_PATH = `/tmp/${BUILDR_APP_EXIFTOOL_ARCHIVE_NAME}`;
const BUILDR_APP_EXIFTOOL_SOURCE_DIRECTORY = `/tmp/Image-ExifTool-${BUILDR_APP_EXIFTOOL_VERSION}`;
const BUILDR_APP_EXIFTOOL_DOWNLOAD_URL = `https://sourceforge.net/projects/exiftool/files/${BUILDR_APP_EXIFTOOL_ARCHIVE_NAME}/download`;
const BUILDR_APP_EXIFTOOL_SHA256 =
  "58f74f5cf84350693a00c4df236fd4810e5abaf25fab2d15eaa9dcc4872d4481";
const BUILDR_APP_LIBREOFFICE_VERSION = "26.2.2";
const BUILDR_APP_LIBREOFFICE_ARCHIVE_NAME = `LibreOffice_${BUILDR_APP_LIBREOFFICE_VERSION}_Linux_x86-64_rpm.tar.gz`;
const BUILDR_APP_LIBREOFFICE_DOWNLOAD_PATH = `/tmp/${BUILDR_APP_LIBREOFFICE_ARCHIVE_NAME}`;
const BUILDR_APP_LIBREOFFICE_DOWNLOAD_URL = `https://download.documentfoundation.org/libreoffice/stable/${BUILDR_APP_LIBREOFFICE_VERSION}/rpm/x86_64/${BUILDR_APP_LIBREOFFICE_ARCHIVE_NAME}`;
const BUILDR_APP_LIBREOFFICE_SHA256 =
  "c510b6a83e14125fb079cd2fb5510eaf01464bd4956443a73a5f5fff23cfb911";
const BUILDR_APP_MEILISEARCH_VERSION = "1.12.0";
const BUILDR_APP_MEILISEARCH_BINARY_NAME = "meilisearch-linux-amd64";
const BUILDR_APP_MEILISEARCH_DOWNLOAD_PATH = `/tmp/${BUILDR_APP_MEILISEARCH_BINARY_NAME}`;
const BUILDR_APP_MEILISEARCH_DOWNLOAD_URL = `https://github.com/meilisearch/meilisearch/releases/download/v${BUILDR_APP_MEILISEARCH_VERSION}/${BUILDR_APP_MEILISEARCH_BINARY_NAME}`;
const BUILDR_APP_MEILISEARCH_SHA256 =
  "865a3fc222e3b3bd1f4b64346cb114b9669af691aae28d71fa68dbf39427abcf";
const BUILDR_APP_BDEV_BINARY_BUILD_PATH = "/tmp/bdev";
const BUILDR_APP_RUBY_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/ruby/${BUILDR_APP_RUBY_VERSION}/bin`;
const BUILDR_APP_NODE_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/node/${BUILDR_APP_NODE_VERSION}/bin`;
const BUILDR_APP_GO_BIN_DIRECTORY = `${BUILDR_APP_MISE_INSTALLS_DIRECTORY}/go/${BUILDR_APP_GO_VERSION}/bin`;
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

function shouldStageBdevFile(relativePath: string): boolean {
  if (!relativePath.startsWith(`${BUILDR_APP_BDEV_DIRECTORY}/`)) {
    return false;
  }

  return (
    relativePath.endsWith(".md") ||
    relativePath.endsWith("go.mod") ||
    relativePath.endsWith("go.sum") ||
    (relativePath.endsWith(".go") && !relativePath.endsWith("_test.go"))
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

  const bdevFiles = await listFiles(
    path.join(options.appRoot, BUILDR_APP_BDEV_DIRECTORY),
  );
  const bdevRelativePaths = bdevFiles
    .map((filePath) => normalizeRelativePath(filePath, options.appRoot))
    .filter((relativePath) => shouldStageBdevFile(relativePath))
    .sort();

  for (const relativePath of bdevRelativePaths) {
    stagedFiles.push(
      await stageRelativeFile(options.appRoot, relativePath, readTextFile),
    );
  }

  return { stagedFiles };
}

export function buildBuildrAppSnapshotCommands(): string[] {
  return [
    "sudo dnf install -y --allowerasing gnupg2",
    `sudo dnf install -y ${BUILDR_APP_BUILD_PACKAGES.join(" ")}`,
    `sudo dnf install -y ${BUILDR_APP_SYSTEM_PACKAGES.join(" ")}`,
    `sudo dnf install -y ${BUILDR_APP_SERVICE_PACKAGES.join(" ")}`,
    `sudo dnf install -y --allowerasing ${BUILDR_APP_POSTGIS_BUILD_PACKAGES.join(" ")}`,
    `sudo dnf install -y ${BUILDR_APP_LIBVIPS_BUILD_PACKAGES.join(" ")}`,
    `curl -fsSL -o ${BUILDR_APP_POSTGIS_DOWNLOAD_PATH} ${BUILDR_APP_POSTGIS_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_POSTGIS_SHA256}  ${BUILDR_APP_POSTGIS_DOWNLOAD_PATH}" | sha256sum -c -`,
    `cd /tmp && tar -xzf ${BUILDR_APP_POSTGIS_DOWNLOAD_PATH}`,
    `cd ${BUILDR_APP_POSTGIS_SOURCE_DIRECTORY} && ./configure --with-pgconfig=/usr/bin/pg_config --without-raster --without-topology --with-gettext=no && make -j2 && sudo make install`,
    `rm -rf ${BUILDR_APP_POSTGIS_SOURCE_DIRECTORY} ${BUILDR_APP_POSTGIS_DOWNLOAD_PATH}`,
    `curl -fsSL -o ${BUILDR_APP_LIBVIPS_DOWNLOAD_PATH} ${BUILDR_APP_LIBVIPS_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_LIBVIPS_SHA256}  ${BUILDR_APP_LIBVIPS_DOWNLOAD_PATH}" | sha256sum -c -`,
    `cd /tmp && tar -xJf ${BUILDR_APP_LIBVIPS_DOWNLOAD_PATH}`,
    `cd ${BUILDR_APP_LIBVIPS_SOURCE_DIRECTORY} && meson setup build --prefix=/usr/local --libdir=lib -Dintrospection=disabled && meson compile -C build && sudo meson install -C build && sudo ldconfig`,
    `rm -rf ${BUILDR_APP_LIBVIPS_SOURCE_DIRECTORY} ${BUILDR_APP_LIBVIPS_DOWNLOAD_PATH}`,
    "vips --version",
    `curl -fsSL -o ${BUILDR_APP_EXIFTOOL_DOWNLOAD_PATH} ${BUILDR_APP_EXIFTOOL_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_EXIFTOOL_SHA256}  ${BUILDR_APP_EXIFTOOL_DOWNLOAD_PATH}" | sha256sum -c -`,
    `cd /tmp && tar -xzf ${BUILDR_APP_EXIFTOOL_DOWNLOAD_PATH} && cd Image-ExifTool-${BUILDR_APP_EXIFTOOL_VERSION} && perl Makefile.PL && make && sudo make install`,
    `rm -rf ${BUILDR_APP_EXIFTOOL_SOURCE_DIRECTORY} ${BUILDR_APP_EXIFTOOL_DOWNLOAD_PATH}`,
    `curl -fsSL -o ${BUILDR_APP_LIBREOFFICE_DOWNLOAD_PATH} ${BUILDR_APP_LIBREOFFICE_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_LIBREOFFICE_SHA256}  ${BUILDR_APP_LIBREOFFICE_DOWNLOAD_PATH}" | sha256sum -c -`,
    `cd /tmp && tar -xzf ${BUILDR_APP_LIBREOFFICE_DOWNLOAD_PATH}`,
    "sudo dnf install -y /tmp/LibreOffice_*_Linux_x86-64_rpm/RPMS/*.rpm",
    "sudo ln -sf /opt/libreoffice*/program/soffice /usr/local/bin/soffice",
    `rm -rf /tmp/LibreOffice_*_Linux_x86-64_rpm ${BUILDR_APP_LIBREOFFICE_DOWNLOAD_PATH}`,
    "sudo dnf clean all",
    `sudo install -d -o postgres -g postgres ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}`,
    `test -f ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/PG_VERSION || (sudo rm -rf ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} && sudo install -d -o postgres -g postgres ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} && sudo -u postgres initdb -D ${BUILDR_APP_POSTGRES_DATA_DIRECTORY})`,
    `sudo sed -i "s/^#listen_addresses = .*/listen_addresses = '127.0.0.1'/" ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/postgresql.conf`,
    `sudo sed -i "s|^#unix_socket_directories = .*|unix_socket_directories = '${BUILDR_APP_POSTGRES_SOCKET_DIRECTORY}'|" ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/postgresql.conf`,
    `sudo sed -i 's/^local\\s\\+all\\s\\+all\\s\\+peer$/local all all trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    `sudo sed -i 's/^host\\s\\+all\\s\\+all\\s\\+127\\.0\\.0\\.1\\/32\\s\\+scram-sha-256$/host all all 127.0.0.1\\/32 trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    `sudo sed -i 's/^host\\s\\+all\\s\\+all\\s\\+::1\\/128\\s\\+scram-sha-256$/host all all ::1\\/128 trust/' ${BUILDR_APP_POSTGRES_DATA_DIRECTORY}/pg_hba.conf`,
    `sudo rm -f ${BUILDR_APP_POSTGIS_VERIFY_LOG_PATH}`,
    `sudo -u postgres pg_ctl -D ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} -l ${BUILDR_APP_POSTGIS_VERIFY_LOG_PATH} start`,
    `sudo -u postgres createdb -h ${BUILDR_APP_POSTGRES_SOCKET_DIRECTORY} ${BUILDR_APP_POSTGIS_VERIFY_DATABASE}`,
    `sudo -u postgres psql -h ${BUILDR_APP_POSTGRES_SOCKET_DIRECTORY} -d ${BUILDR_APP_POSTGIS_VERIFY_DATABASE} -c "CREATE EXTENSION postgis;"`,
    `sudo -u postgres dropdb -h ${BUILDR_APP_POSTGRES_SOCKET_DIRECTORY} ${BUILDR_APP_POSTGIS_VERIFY_DATABASE}`,
    `sudo -u postgres pg_ctl -D ${BUILDR_APP_POSTGRES_DATA_DIRECTORY} stop -m fast`,
    `sudo rm -f ${BUILDR_APP_POSTGIS_VERIFY_LOG_PATH}`,
    "sudo ln -sf /usr/bin/valkey-server /usr/local/bin/redis-server",
    "sudo ln -sf /usr/bin/valkey-cli /usr/local/bin/redis-cli",
    "redis-server --version",
    "curl https://mise.run | sh",
    `sudo ln -sf ${BUILDR_APP_RUNTIME_HOME}/.local/bin/mise /usr/local/bin/mise`,
    `sudo sh -c "printf '%s\\n' 'export PATH=${BUILDR_APP_RUNTIME_PATH}' > /etc/profile.d/mise-path.sh"`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install ruby@${BUILDR_APP_RUBY_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/ruby /usr/local/bin/ruby && sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/bundle /usr/local/bin/bundle && sudo ln -sf ${BUILDR_APP_RUBY_BIN_DIRECTORY}/gem /usr/local/bin/gem`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install node@${BUILDR_APP_NODE_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/node /usr/local/bin/node && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/npm /usr/local/bin/npm && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/npx /usr/local/bin/npx && sudo ln -sf ${BUILDR_APP_NODE_BIN_DIRECTORY}/corepack /usr/local/bin/corepack`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install go@${BUILDR_APP_GO_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_GO_BIN_DIRECTORY}/go /usr/local/bin/go`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise install python@${BUILDR_APP_PYTHON_VERSION}`,
    `sudo ln -sf ${BUILDR_APP_PYTHON_BIN_DIRECTORY}/python3 /usr/local/bin/python3 && sudo ln -sf ${BUILDR_APP_PYTHON_BIN_DIRECTORY}/python3 /usr/local/bin/python`,
    `export PATH="${BUILDR_APP_RUNTIME_PATH}" && mise use -g ruby@${BUILDR_APP_RUBY_VERSION} node@${BUILDR_APP_NODE_VERSION} go@${BUILDR_APP_GO_VERSION} python@${BUILDR_APP_PYTHON_VERSION}`,
    `corepack install --global pnpm@${BUILDR_APP_PNPM_VERSION}`,
    'sudo ln -sf "$(command -v pnpm)" /usr/local/bin/pnpm',
    `curl -fsSL -o ${BUILDR_APP_AST_GREP_DOWNLOAD_PATH} ${BUILDR_APP_AST_GREP_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_AST_GREP_SHA256}  ${BUILDR_APP_AST_GREP_DOWNLOAD_PATH}" | sha256sum -c -`,
    `python3 -c "import zipfile; zipfile.ZipFile('${BUILDR_APP_AST_GREP_DOWNLOAD_PATH}').extract('ast-grep', '/tmp')"`,
    `sudo install -m 0755 ${BUILDR_APP_AST_GREP_EXTRACTED_PATH} /usr/local/bin/ast-grep`,
    `rm -f ${BUILDR_APP_AST_GREP_DOWNLOAD_PATH} ${BUILDR_APP_AST_GREP_EXTRACTED_PATH}`,
    `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/${BUILDR_APP_BDEV_DIRECTORY} && go build -o ${BUILDR_APP_BDEV_BINARY_BUILD_PATH} .`,
    `sudo install -m 0755 ${BUILDR_APP_BDEV_BINARY_BUILD_PATH} /usr/local/bin/bdev`,
    `rm -f ${BUILDR_APP_BDEV_BINARY_BUILD_PATH}`,
    `curl -fsSL -o ${BUILDR_APP_MEILISEARCH_DOWNLOAD_PATH} ${BUILDR_APP_MEILISEARCH_DOWNLOAD_URL}`,
    `echo "${BUILDR_APP_MEILISEARCH_SHA256}  ${BUILDR_APP_MEILISEARCH_DOWNLOAD_PATH}" | sha256sum -c -`,
    `sudo install -m 0755 ${BUILDR_APP_MEILISEARCH_DOWNLOAD_PATH} /usr/local/bin/meilisearch`,
    `rm -f ${BUILDR_APP_MEILISEARCH_DOWNLOAD_PATH}`,
    "meilisearch --version",
    'for tool in go bdev meilisearch vips pg_config psql createdb dropdb pg_ctl redis-server exiftool soffice; do command -v "$tool" >/dev/null || exit 1; done',
    `install -d ${BUILDR_APP_RUNTIME_HOME}/.bundle ${BUILDR_APP_RUNTIME_HOME}/.local/share/pnpm/store`,
    `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && /usr/local/bin/bundle install --jobs 1 --retry 3`,
    `cd ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT} && /usr/local/bin/pnpm install --frozen-lockfile --store-dir ${BUILDR_APP_RUNTIME_HOME}/.local/share/pnpm/store`,
    `rm -f ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}/.npmrc`,
    `rm -f ${BUILDR_APP_RUNTIME_HOME}/.npmrc ${BUILDR_APP_RUNTIME_HOME}/.bundle/config ${BUILDR_APP_RUNTIME_HOME}/.gem/credentials`,
    `rm -rf ${BUILDR_APP_SNAPSHOT_CONTEXT_ROOT}`,
    'test -z "$(ls -A /vercel/sandbox)"',
  ];
}
