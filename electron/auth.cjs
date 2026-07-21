// Microsoft → Xbox Live → XSTS → Minecraft authentication.
// Uses the Minecraft Launcher public client ID (00000000402b5328).
// For production, register your own Azure AD app and replace CLIENT_ID.
const { BrowserWindow } = require("electron");

const CLIENT_ID = "00000000402b5328";
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";
const SCOPE = "XboxLive.signin offline_access";

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

// 1) Interactive MS OAuth via a popup BrowserWindow
async function getMsAuthCode() {
  const authUrl =
    `https://login.live.com/oauth20_authorize.srf` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&prompt=select_account`;

  return await new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 500, height: 700, autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    let done = false;
    const finish = (fn, arg) => { if (!done) { done = true; try { win.close(); } catch {} ; fn(arg); } };

    win.webContents.on("will-redirect", (_e, url) => handle(url));
    win.webContents.on("will-navigate", (_e, url) => handle(url));
    win.on("closed", () => { if (!done) reject(new Error("로그인이 취소되었습니다.")); });

    function handle(url) {
      if (!url.startsWith(REDIRECT_URI)) return;
      const u = new URL(url);
      const code = u.searchParams.get("code");
      const err = u.searchParams.get("error");
      if (code) finish(resolve, code);
      else if (err) finish(reject, new Error(u.searchParams.get("error_description") || err));
    }
    win.loadURL(authUrl);
  });
}

async function msTokenFromCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  });
  return fetchJson("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function msRefresh(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  });
  return fetchJson("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function xblAuth(accessToken) {
  return fetchJson("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${accessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });
}

async function xstsAuth(xblToken) {
  const res = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j.XErr === 2148916233) msg = "이 Microsoft 계정에는 Xbox 프로필이 없습니다. xbox.com에서 프로필을 먼저 만들어주세요.";
      else if (j.XErr === 2148916238) msg = "미성년자 계정입니다. 부모 계정의 가족 그룹에 추가되어야 합니다.";
    } catch {}
    throw new Error(msg);
  }
  return JSON.parse(text);
}

async function mcLogin(userHash, xstsToken) {
  return fetchJson("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  });
}

async function mcProfile(mcAccessToken) {
  return fetchJson("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });
}

async function fullChain(msTokens) {
  const xbl = await xblAuth(msTokens.access_token);
  const xsts = await xstsAuth(xbl.Token);
  const userHash = xsts.DisplayClaims.xui[0].uhs;
  const mc = await mcLogin(userHash, xsts.Token);
  const profile = await mcProfile(mc.access_token);
  if (!profile.id) throw new Error("이 계정은 마인크래프트를 소유하지 않았습니다.");
  return {
    ms: {
      access_token: msTokens.access_token,
      refresh_token: msTokens.refresh_token,
      expires_at: Date.now() + (msTokens.expires_in - 60) * 1000,
    },
    mcAccessToken: mc.access_token,
    mcExpiresAt: Date.now() + (mc.expires_in - 60) * 1000,
    mcProfile: { id: profile.id, name: profile.name },
  };
}

async function loginInteractive() {
  const code = await getMsAuthCode();
  const msTokens = await msTokenFromCode(code);
  return fullChain(msTokens);
}

async function ensureFresh(tokens) {
  if (tokens.mcExpiresAt && tokens.mcExpiresAt > Date.now() + 5 * 60 * 1000) return tokens;
  const msTokens = await msRefresh(tokens.ms.refresh_token);
  return fullChain(msTokens);
}

module.exports = { loginInteractive, ensureFresh };
