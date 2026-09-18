const { spawnSync } = require("node:child_process");

/**
 * Notarize and staple the .dmg artifacts produced by `electron-forge make`.
 *
 * Forge notarizes and staples the .app during packaging, but the disk image
 * that ships to users is built afterwards and carries no ticket of its own.
 * Stapling the DMG means Gatekeeper can clear it without a network round trip,
 * which is what keeps a freshly downloaded installer from being challenged.
 */
function credentialArguments(notarize) {
  if (notarize.appleApiKey) {
    return [
      "--key", notarize.appleApiKey,
      "--key-id", notarize.appleApiKeyId,
      "--issuer", notarize.appleApiIssuer,
    ];
  }

  return [
    "--apple-id", notarize.appleId,
    "--password", notarize.appleIdPassword,
    "--team-id", notarize.teamId,
  ];
}

function run(command, args, description) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status}`);
  }
}

async function notarizeDiskImages(makeResults, notarize) {
  const diskImages = makeResults
    .flatMap(result => result.artifacts)
    .filter(artifact => artifact.endsWith(".dmg"));

  if (!diskImages.length) return;

  const credentials = credentialArguments(notarize);
  for (const diskImage of diskImages) {
    console.log(`\nNotarizing ${diskImage}`);
    run(
      "xcrun",
      ["notarytool", "submit", diskImage, ...credentials, "--wait"],
      "notarytool submit",
    );
    run("xcrun", ["stapler", "staple", diskImage], "stapler staple");
    // Proves the ticket is actually attached rather than merely accepted.
    run("xcrun", ["stapler", "validate", diskImage], "stapler validate");
  }
}

module.exports = { notarizeDiskImages };
