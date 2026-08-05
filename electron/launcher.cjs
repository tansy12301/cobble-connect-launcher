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

async function launch({ modpack, gameDir, tokens, ramGb, onExit }) {
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

  // Keep the process attached so we can detect crashes (Prism-style).
  const logDir = path.join(gameDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "launcher-latest.log");
  const logStream = fs.createWriteStream(logPath, { flags: "w" });

  const child = spawn(javaCmd, args, { cwd: gameDir, stdio: ["ignore", "pipe", "pipe"] });

  const ring = [];
  const capture = (chunk) => {
    const text = chunk.toString();
    logStream.write(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      ring.push(line);
      if (ring.length > 400) ring.shift();
    }
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  child.on("error", (err) => {
    logStream.end();
    onExit?.({
      code: -1,
      crashed: true,
      message:
        err.code === "ENOENT"
          ? "Java를 찾을 수 없습니다. Java 21(Adoptium)을 설치한 뒤 다시 시도하세요."
          : `Java 실행 오류: ${err.message}`,
      logPath,
    });
  });

  child.on("exit", (code) => {
    logStream.end();
    const crashed = code !== 0;
    let message = null;
    if (crashed) {
      const cause =
        ring.find((l) => l.includes("NoClassDefFoundError") || l.includes("NoSuchMethodError")) ||
        ring.find((l) => l.includes("Caused by:")) ||
        ring.find((l) => l.includes("Exception") || l.includes("Error")) ||
        ring[ring.length - 1] ||
        "";
      message = `마인크래프트가 종료되었습니다 (코드 ${code}).\n${cause.trim().slice(0, 300)}`;
    }
    onExit?.({ code, crashed, message, logPath });
  });

  // Give the JVM a moment: an instant failure is almost always a bad setup.
  await new Promise((r) => setTimeout(r, 1200));
}

module.exports = { launch };
