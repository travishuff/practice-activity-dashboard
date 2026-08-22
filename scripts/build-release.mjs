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

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid release version: ${version}`);
}

const build = spawnSync(
  "pnpm",
  ["make:mac"],
  { cwd: repositoryRoot, stdio: "inherit" },
);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const sourceDmg = path.join(repositoryRoot, "out", "make", "Practice Activity.dmg");
const releaseDirectory = path.join(
  repositoryRoot,
  "out",
  "release",
  `v${version}`,
);
const assetName = `Practice-Activity-v${version}-macOS-universal.dmg`;
const releaseDmg = path.join(releaseDirectory, assetName);

await mkdir(releaseDirectory, { recursive: true });
await copyFile(sourceDmg, releaseDmg);

const digest = createHash("sha256")
  .update(await readFile(releaseDmg))
  .digest("hex");
const checksumFile = `${releaseDmg}.sha256`;

await writeFile(checksumFile, `${digest}  ${assetName}\n`, "utf8");

console.log(`\nRelease artifacts for v${version}:`);
console.log(releaseDmg);
console.log(checksumFile);
