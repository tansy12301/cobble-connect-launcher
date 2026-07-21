// Assembles the java command and spawns Minecraft.
// Assumes `java` is on PATH. (For zero-Java installs, bundle Adoptium JRE.)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function mavenPath(name) {
  const [g, a, v] = name.split(":");
  return `${g.replace(/\./g, "/")}/${a}/${v}/${a}-${v}.jar`;
}

function collectLibs(gameDir, vanilla, fabricProfile) {
  const paths = [];
  const seen = new Set();
  const push = (rel) => {
    const abs = path.join(gameDir, "libraries", rel);
    if (!seen.has(abs)) { seen.add(abs); paths.push(abs); }
  };
  if (fabricProfile) {
    for (const l of fabricProfile.libraries) push(mavenPath(l.name));
  }
  for (const l of vanilla.libraries) {
    if (l.downloads?.artifact) push(l.downloads.artifact.path);
  }
  const clientJar = path.join(gameDir, "versions", vanilla.id, `${vanilla.id}.jar`);
  paths.push(clientJar);
  return paths;
}

async function launch({ modpack, gameDir, tokens, ramGb }) {
  const versionsDir = path.join(gameDir, "versions");
  const vanilla = JSON.parse(
    fs.readFileSync(path.join(versionsDir, modpack.minecraftVersion, `${modpack.minecraftVersion}.json`), "utf8"),
  );
  let fabricProfile = null;
  let mainClass = vanilla.mainClass;
  if (modpack.loader === "fabric") {
    const fabricId = `fabric-loader-${modpack.fabricLoaderVersion}-${modpack.minecraftVersion}`;
    fabricProfile = JSON.parse(
      fs.readFileSync(path.join(versionsDir, fabricId, `${fabricId}.json`), "utf8"),
    );
    mainClass = fabricProfile.mainClass;
  }

  const classpath = collectLibs(gameDir, vanilla, fabricProfile).join(process.platform === "win32" ? ";" : ":");

  const assetsDir = path.join(gameDir, "assets");
  const nativesDir = path.join(gameDir, "natives", vanilla.id);
  fs.mkdirSync(nativesDir, { recursive: true });

  const jvmArgs = [
    `-Xmx${ramGb}G`,
    `-Xms${Math.min(2, ramGb)}G`,
    `-Djava.library.path=${nativesDir}`,
    "-cp", classpath,
  ];

  const gameArgs = [
    "--username", tokens.mcProfile.name,
    "--version", vanilla.id,
    "--gameDir", gameDir,
    "--assetsDir", assetsDir,
    "--assetIndex", vanilla.assetIndex.id,
    "--uuid", tokens.mcProfile.id,
    "--accessToken", tokens.mcAccessToken,
    "--userType", "msa",
    "--versionType", "release",
  ];

  // Auto-join server: append --server / --port
  if (modpack.server?.ip) {
    gameArgs.push("--server", modpack.server.ip);
    if (modpack.server.port) gameArgs.push("--port", String(modpack.server.port));
  }

  const args = [...jvmArgs, mainClass, ...gameArgs];

  const javaCmd = process.platform === "win32" ? "javaw" : "java";
  const child = spawn(javaCmd, args, {
    cwd: gameDir,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", (err) => console.error("Java 실행 오류:", err));
  child.unref();
}

module.exports = { launch };
