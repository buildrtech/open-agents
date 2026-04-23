import { readdir } from "node:fs/promises";
import path from "node:path";
import type { RefreshBaseSnapshotStagedFile } from "@open-agents/sandbox/vercel";

export const FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT =
  "/tmp/forge-harness-skills";
export const FORGE_HARNESS_SKILLS_INSTALL_ROOT = "/forge/skills";

export interface CollectForgeHarnessSkillSnapshotInputsOptions {
  skillsRoot: string;
  readTextFile?: (path: string) => Promise<string>;
  listFiles?: (directory: string) => Promise<string[]>;
}

export interface ForgeHarnessSkillSnapshotInputs {
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

function toSnapshotPath(relativePath: string): string {
  return path.posix.join(
    FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT,
    relativePath.split(path.sep).join(path.posix.sep),
  );
}

export async function collectForgeHarnessSkillSnapshotInputs(
  options: CollectForgeHarnessSkillSnapshotInputsOptions,
): Promise<ForgeHarnessSkillSnapshotInputs> {
  const readTextFile = options.readTextFile ?? defaultReadTextFile;
  const listFiles = options.listFiles ?? walkFiles;
  const skillsRoot = path.normalize(options.skillsRoot);
  const files = await listFiles(skillsRoot);

  const stagedFiles = await Promise.all(
    files
      .map((filePath) => path.relative(skillsRoot, path.normalize(filePath)))
      .sort()
      .map(async (relativePath) => ({
        path: toSnapshotPath(relativePath),
        content: await readTextFile(path.join(skillsRoot, relativePath)),
      })),
  );

  return { stagedFiles };
}

export function buildForgeHarnessSkillSnapshotCommands(): string[] {
  return [
    `sudo rm -rf ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
    `sudo install -d ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
    `sudo cp -R ${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/. ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
    `sudo chmod +x ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}/buildkite-build/scripts/fetch_buildkite_failures.py`,
    `sudo chmod +x ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}/systematic-debugging/find-polluter.sh`,
    `rm -rf ${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}`,
  ];
}
