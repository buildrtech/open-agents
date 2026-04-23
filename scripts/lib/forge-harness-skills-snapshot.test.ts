import { describe, expect, test } from "bun:test";
import {
  FORGE_HARNESS_SKILLS_INSTALL_ROOT,
  FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT,
  buildForgeHarnessSkillSnapshotCommands,
  collectForgeHarnessSkillSnapshotInputs,
} from "./forge-harness-skills-snapshot";

describe("collectForgeHarnessSkillSnapshotInputs", () => {
  test("collects the full Forge harness skill tree", async () => {
    const result = await collectForgeHarnessSkillSnapshotInputs({
      skillsRoot: "../forge/harness/skills",
      readTextFile: async (filePath) => `content:${filePath}`,
      listFiles: async (directory) => {
        if (!directory.endsWith("../forge/harness/skills")) {
          return [];
        }

        return [
          "../forge/harness/skills/buildkite-build/SKILL.md",
          "../forge/harness/skills/buildkite-build/references/buildkite.md",
          "../forge/harness/skills/buildkite-build/scripts/fetch_buildkite_failures.py",
          "../forge/harness/skills/systematic-debugging/SKILL.md",
          "../forge/harness/skills/systematic-debugging/find-polluter.sh",
        ];
      },
    });

    expect(result.stagedFiles).toEqual([
      {
        path: `${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/buildkite-build/SKILL.md`,
        content: "content:../forge/harness/skills/buildkite-build/SKILL.md",
      },
      {
        path: `${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/buildkite-build/references/buildkite.md`,
        content:
          "content:../forge/harness/skills/buildkite-build/references/buildkite.md",
      },
      {
        path: `${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/buildkite-build/scripts/fetch_buildkite_failures.py`,
        content:
          "content:../forge/harness/skills/buildkite-build/scripts/fetch_buildkite_failures.py",
      },
      {
        path: `${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/systematic-debugging/SKILL.md`,
        content:
          "content:../forge/harness/skills/systematic-debugging/SKILL.md",
      },
      {
        path: `${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/systematic-debugging/find-polluter.sh`,
        content:
          "content:../forge/harness/skills/systematic-debugging/find-polluter.sh",
      },
    ]);
  });
});

describe("buildForgeHarnessSkillSnapshotCommands", () => {
  test("builds commands that install the Forge harness skills into the base snapshot", () => {
    const commands = buildForgeHarnessSkillSnapshotCommands();

    expect(commands).toEqual([
      `sudo rm -rf ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
      `sudo install -d ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
      `sudo cp -R ${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}/. ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}`,
      `sudo chmod +x ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}/buildkite-build/scripts/fetch_buildkite_failures.py`,
      `sudo chmod +x ${FORGE_HARNESS_SKILLS_INSTALL_ROOT}/systematic-debugging/find-polluter.sh`,
      `rm -rf ${FORGE_HARNESS_SKILLS_SNAPSHOT_CONTEXT_ROOT}`,
    ]);
  });
});
