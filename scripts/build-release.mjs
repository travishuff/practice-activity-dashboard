import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
);
const version = packageJson.version;
const target = process.argv[2];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid release version: ${version}`);
}

if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error(
    `Git tag ${process.env.GITHUB_REF_NAME} does not match package.json version v${version}`,
  );
}

const targets = {
  mac: {
    buildScript: "make:mac",
    source: path.join("out", "make", "Practice Activity.dmg"),
    assetName: `Practice-Activity-v${version}-macOS-universal.dmg`,
  },
  win: {
    buildScript: "make:win",
    source: path.join(
      "out",
      "make",
      "squirrel.windows",
      "x64",
      "Practice Activity Setup.exe",
    ),
    assetName: `Practice-Activity-v${version}-Windows-x64-Setup.exe`,
  },
};

const releaseTarget = targets[target];
if (!releaseTarget) {
  throw new Error("Choose a release target: mac or win");
}

const buildCommand = process.platform === "win32"
  ? {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", "pnpm.cmd", releaseTarget.buildScript],
  }
  : {
    command: "pnpm",
    args: [releaseTarget.buildScript],
  };
const build = spawnSync(
  buildCommand.command,
  buildCommand.args,
  { cwd: repositoryRoot, stdio: "inherit" },
);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const releaseDirectory = path.join(
  repositoryRoot,
  "out",
  "release",
  `v${version}`,
);
const releaseArtifact = path.join(releaseDirectory, releaseTarget.assetName);

await mkdir(releaseDirectory, { recursive: true });
await copyFile(path.join(repositoryRoot, releaseTarget.source), releaseArtifact);

const digest = createHash("sha256")
  .update(await readFile(releaseArtifact))
  .digest("hex");
const checksumFile = `${releaseArtifact}.sha256`;

await writeFile(
  checksumFile,
  `${digest}  ${releaseTarget.assetName}\n`,
  "utf8",
);

console.log(`\n${target} release artifacts for v${version}:`);
console.log(releaseArtifact);
console.log(checksumFile);
