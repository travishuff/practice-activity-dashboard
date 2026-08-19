const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { readdir, rm } = require("node:fs/promises");
const path = require("node:path");

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
    osxSign: {
      identity: "-",
      identityValidation: false,
      continueOnError: false,
      optionsForFile: () => ({
        hardenedRuntime: false,
        timestamp: "none",
      }),
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
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "electron/main.ts",
            config: "vite.main.config.ts",
          },
          {
            entry: "electron/preload.ts",
            config: "vite.preload.config.ts",
          },
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.ts",
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
