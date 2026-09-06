const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function identityNames(validOnly) {
  const args = validOnly
    ? ["find-identity", "-v", "-p", "codesigning"]
    : ["find-identity", "-p", "codesigning"];
  const out = execFileSync("security", args, { encoding: "utf8" });
  return [...out.matchAll(/^\s*\d+\)\s+[A-F0-9]+\s+"([^"]+)"/gm)].map((match) => match[1]);
}

function pickIdentity() {
  if (process.env.IRISFLOW_CODESIGN_IDENTITY) {
    return process.env.IRISFLOW_CODESIGN_IDENTITY;
  }
  const names = [...identityNames(true), ...identityNames(false)];
  return (
    names.find((name) => name.startsWith("Developer ID Application:")) ||
    names.find((name) => name.startsWith("Apple Development:")) ||
    names.find((name) => /Irisflow/i.test(name)) ||
    null
  );
}

function extraBinaries(appPath) {
  const unpacked = path.join(appPath, "Contents/Resources/app.asar.unpacked/bin");
  return ["libiriskeys.dylib", "MacKeyServer"]
    .map((name) => path.join(unpacked, name))
    .filter((file) => fs.existsSync(file));
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const entitlements = path.join(__dirname, "..", "entitlements.mac.plist");
  const identity = pickIdentity();

  if (!identity) {
    console.warn(
      "[irisflow] No stable codesign identity found. Ad-hoc signing will make Accessibility reset on every rebuild."
    );
    execFileSync("codesign", [
      "--sign",
      "-",
      "--force",
      "--identifier",
      "com.irisflow.app",
      "--entitlements",
      entitlements,
      appPath,
    ]);
    return;
  }

  console.log(`[irisflow] Signing with stable identity: ${identity}`);
  const { signAsync } = require("@electron/osx-sign");
  await signAsync({
    app: appPath,
    identity,
    platform: "darwin",
    type: "development",
    hardenedRuntime: false,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    gatekeeperAssess: false,
    strictVerify: false,
    entitlements,
    entitlementsInherit: entitlements,
    binaries: extraBinaries(appPath),
    optionsForFile: () => ({
      entitlements,
      hardenedRuntime: false,
      timestamp: "none",
    }),
  });

  const requirement = execFileSync("codesign", ["-d", "-r-", appPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(`[irisflow] Designated requirement:\n${requirement.trim()}`);
};
