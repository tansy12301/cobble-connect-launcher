// Downloads vanilla Minecraft, Fabric loader, and configured mods into gameDir.
// Idempotent: skips files that already exist with matching size/SHA1.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

async function download(url, dest, onBytes) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`다운로드 실패: ${url} (${res.status})`);
  const out = fs.createWriteStream(dest);
  let downloaded = 0;
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out.write(value);
    downloaded += value.length;
    if (onBytes) onBytes(downloaded);
  }
  await new Promise((r) => out.end(r));
}

async function sha1(file) {
  const h = crypto.createHash("sha1");
  await pipeline(fs.createReadStream(file), h);
  return h.digest("hex");
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function ensureFile(url, dest, expectedSha1) {
  if (fs.existsSync(dest)) {
    if (!expectedSha1 || (await sha1(dest)) === expectedSha1) return;
  }
  await download(url, dest);
  if (expectedSha1 && (await sha1(dest)) !== expectedSha1) {
    throw new Error(`SHA1 불일치: ${dest}`);
  }
}

async function ensureVanilla({ mcVersion, gameDir, onProgress }) {
  const manifest = await fetchJson("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
  const entry = manifest.versions.find((v) => v.id === mcVersion);
  if (!entry) throw new Error(`알 수 없는 마인크래프트 버전: ${mcVersion}`);
  const versionJson = await fetchJson(entry.url);

  const versionsDir = path.join(gameDir, "versions", mcVersion);
  fs.mkdirSync(versionsDir, { recursive: true });
  fs.writeFileSync(path.join(versionsDir, `${mcVersion}.json`), JSON.stringify(versionJson));

  // Client jar
  onProgress?.("클라이언트 다운로드", 10);
  await ensureFile(
    versionJson.downloads.client.url,
    path.join(versionsDir, `${mcVersion}.jar`),
    versionJson.downloads.client.sha1,
  );

  // Libraries
  const libs = versionJson.libraries.filter((l) => l.downloads?.artifact);
  for (let i = 0; i < libs.length; i++) {
    const a = libs[i].downloads.artifact;
    await ensureFile(a.url, path.join(gameDir, "libraries", a.path), a.sha1);
    onProgress?.("라이브러리 다운로드", 10 + Math.floor((i / libs.length) * 30));
  }

  // Asset index + assets
  onProgress?.("에셋 인덱스", 42);
  const assetIndex = await fetchJson(versionJson.assetIndex.url);
  const assetIndexPath = path.join(gameDir, "assets", "indexes", `${versionJson.assetIndex.id}.json`);
  fs.mkdirSync(path.dirname(assetIndexPath), { recursive: true });
  fs.writeFileSync(assetIndexPath, JSON.stringify(assetIndex));

  const objects = Object.values(assetIndex.objects);
  for (let i = 0; i < objects.length; i++) {
    const { hash } = objects[i];
    const sub = hash.slice(0, 2);
    const dest = path.join(gameDir, "assets", "objects", sub, hash);
    if (!fs.existsSync(dest)) {
      await download(`https://resources.download.minecraft.net/${sub}/${hash}`, dest);
    }
    if (i % 50 === 0) {
      onProgress?.("에셋 다운로드", 45 + Math.floor((i / objects.length) * 25));
    }
  }

  return versionJson;
}

async function ensureFabric({ mcVersion, loaderVersion, gameDir, onProgress }) {
  onProgress?.("Fabric 설치", 75);
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
  const profile = await fetchJson(profileUrl);

  const dir = path.join(gameDir, "versions", profile.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${profile.id}.json`), JSON.stringify(profile));

  // Fabric libraries (name → maven path)
  const libs = profile.libraries || [];
  for (const lib of libs) {
    const url = (lib.url || "https://libraries.minecraft.net/") + mavenPath(lib.name);
    const dest = path.join(gameDir, "libraries", mavenPath(lib.name));
    if (!fs.existsSync(dest)) await download(url, dest);
  }
  return profile;
}

function mavenPath(name) {
  const [g, a, v] = name.split(":");
  return `${g.replace(/\./g, "/")}/${a}/${v}/${a}-${v}.jar`;
}

async function ensureMods({ mods, gameDir, onProgress }) {
  const modsDir = path.join(gameDir, "mods");
  fs.mkdirSync(modsDir, { recursive: true });

  // IMPORTANT: remove stale jars that are no longer in the manifest.
  // Without this, an old mod version keeps loading next to the new one and
  // crashes the game (e.g. rctmod 0.16.6 + rctmod 0.18.1 both present).
  const wanted = new Set(mods.map((m) => m.filename));
  for (const f of fs.readdirSync(modsDir)) {
    if (f.toLowerCase().endsWith(".jar") && !wanted.has(f)) {
      onProgress?.(`구버전 모드 제거: ${f}`, 84);
      try { fs.unlinkSync(path.join(modsDir, f)); } catch {}
    }
  }

  for (let i = 0; i < mods.length; i++) {
    const m = mods[i];
    const dest = path.join(modsDir, m.filename);
    onProgress?.(`모드 다운로드: ${m.name}`, 85 + Math.floor((i / mods.length) * 10));
    try {
      await ensureFile(m.url, dest, m.sha1 || undefined);
    } catch (e) {
      throw new Error(`모드 다운로드 실패 (${m.name}): ${e.message}`);
    }
  }
}

// Downloads a list of { name, url, filename, sha1 } into gameDir/<subdir>,
// pruning any file that is no longer in the list.
async function ensurePack({ items, gameDir, subdir, label, gameDirBase, from, to, onProgress }) {
  if (!items || items.length === 0) return;
  const dir = path.join(gameDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const wanted = new Set(items.map((i) => i.filename));
  for (const f of fs.readdirSync(dir)) {
    if (/\.(zip|jar)$/i.test(f) && !wanted.has(f)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    onProgress?.(`${label} 다운로드: ${it.name}`, from + Math.floor((i / items.length) * (to - from)));
    try {
      await ensureFile(it.url, path.join(dir, it.filename), it.sha1 || undefined);
    } catch (e) {
      throw new Error(`${label} 다운로드 실패 (${it.name}): ${e.message}`);
    }
  }
}

async function ensureModpack({ modpack, gameDir, onProgress }) {
  onProgress?.("마인크래프트 준비", 5);
  const vanilla = await ensureVanilla({ mcVersion: modpack.minecraftVersion, gameDir, onProgress });
  let fabricProfile = null;
  if (modpack.loader === "fabric") {
    fabricProfile = await ensureFabric({
      mcVersion: modpack.minecraftVersion,
      loaderVersion: modpack.fabricLoaderVersion,
      gameDir,
      onProgress,
    });
  }
  await ensureMods({ mods: modpack.mods || [], gameDir, onProgress });
  await ensurePack({ items: modpack.shaders, gameDir, subdir: "shaderpacks", label: "셰이더", from: 95, to: 96, onProgress });
  await ensurePack({ items: modpack.resourcepacks, gameDir, subdir: "resourcepacks", label: "리소스팩", from: 96, to: 97, onProgress });
  onProgress?.("준비 완료", 97);
  return { vanilla, fabricProfile };
}

module.exports = { ensureModpack };

