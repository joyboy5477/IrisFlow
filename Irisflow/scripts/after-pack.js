const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const entitlements = path.join(__dirname, "..", "entitlements.mac.plist");
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
};
