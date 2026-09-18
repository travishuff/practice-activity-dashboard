const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { readdir, rm } = require("node:fs/promises");
const path = require("node:path");
const { notarizeDiskImages } = require("./scripts/notarize-disk-images.cjs");

// Real Developer ID signing is opt-in through the environment so that everyday
// `pnpm make` on a machine without a certificate still produces a runnable
// ad-hoc-signed build. Release builds set APPLE_SIGNING_IDENTITY.
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;

/**
 * Notarization credentials, if the environment carries a usable set.
 * An App Store Connect API key is preferred; an Apple ID with an
 * app-specific password is accepted as a fallback.
 */
function notarizeOptions() {
  const {
    APPLE_API_KEY,
    APPLE_API_KEY_ID,
    APPLE_API_ISSUER,
    APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD,
    APPLE_TEAM_ID,
  } = process.env;

  if (APPLE_API_KEY && APPLE_API_KEY_ID && APPLE_API_ISSUER) {
    return {
      appleApiKey: APPLE_API_KEY,
      appleApiKeyId: APPLE_API_KEY_ID,
      appleApiIssuer: APPLE_API_ISSUER,
    };
  }

  if (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
    return {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    };
  }

  return undefined;
}

const notarize = notarizeOptions();

if (signingIdentity && !notarize) {
  throw new Error(
    "APPLE_SIGNING_IDENTITY is set but no notarization credentials were found. "
      + "Set APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER, or APPLE_ID, "
      + "APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID. Shipping a signed but "
      + "un-notarized build still warns users, which defeats the point.",
  );
}

async function stripSliceSignatures(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === "_CodeSignature") {
      await rm(entryPath, { recursive: true, force: true });
      return;
    }
    if (entry.isDirectory()) await stripSliceSignatures(entryPath);
  }));
}

module.exports = {
  packagerConfig: {
    asar: true,
    name: "Practice Activity",
    executableName: "Practice Activity",
    icon: "assets/app-icon",
    appBundleId: "com.practiceactivity.desktop",
    appCategoryType: "public.app-category.lifestyle",
    afterExtract: [(buildPath, _electronVersion, platform, _arch, callback) => {
      if (platform !== "darwin") {
        callback();
        return;
      }
      stripSliceSignatures(buildPath).then(() => callback(), callback);
    }],
    // With a real identity, @electron/osx-sign's defaults are what we want:
    // hardened runtime on, a secure timestamp, and the Electron entitlements
    // (JIT, unsigned executable memory) applied to the app and its helpers.
    // Notarization requires all of those, so do not override them here.
    osxSign: signingIdentity
      ? { identity: signingIdentity, identityValidation: true, continueOnError: false }
      : {
        identity: "-",
        identityValidation: false,
        continueOnError: false,
        optionsForFile: () => ({
          hardenedRuntime: false,
          timestamp: "none",
        }),
      },
    ...(notarize && signingIdentity ? { osxNotarize: notarize } : {}),
  },
  hooks: {
    // Forge notarizes and staples the .app; the disk image that wraps it is a
    // separate artifact and needs its own ticket, or a downloaded DMG can still
    // be challenged before the app inside is ever reached.
    postMake: async (_forgeConfig, makeResults) => {
      if (signingIdentity && notarize) {
        await notarizeDiskImages(makeResults, notarize, signingIdentity);
      }
      return makeResults;
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "Practice Activity",
        format: "ULFO",
        icon: "assets/app-icon.icns",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        authors: "Travis Huff",
        iconUrl: "https://raw.githubusercontent.com/travishuff/practice-activity-dashboard/main/assets/app-icon.ico",
        setupExe: "Practice Activity Setup.exe",
        setupIcon: path.resolve(__dirname, "assets/app-icon.ico"),
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "electron/main.ts",
            config: "config/vite.node.config.ts",
          },
          {
            entry: "electron/preload.ts",
            config: "config/vite.node.config.ts",
          },
        ],
        renderer: [
          {
            name: "main_window",
            config: "config/vite.renderer.config.ts",
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
