const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  execFileSync("codesign", [
    "--sign",
    "-",
    "--force",
    "--deep",
    "--identifier",
    "com.irisflow.app",
    appPath,
  ]);
};
