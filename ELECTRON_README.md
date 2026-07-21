# Cobblemon Launcher — 로컬 빌드 & 패키징 가이드

Lovable 미리보기는 웹 UI만 보여줍니다. 실제 로그인 / 모드 다운로드 / 게임 실행은 아래 절차로 로컬에서 확인하세요.

## 1. Electron 셋업 (최초 1회)

로컬 PC에서 저장소를 클론한 뒤:

```bash
npm install
npm install --save-dev electron @electron/packager
```

`vite.config.ts`에 다음을 추가해 Electron이 `file://`로 로드할 때 자산이 깨지지 않게 하세요:

```ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: { base: "./" },   // ← 추가
});
```

`package.json`에 아래 두 줄 추가:

```json
"main": "electron/main.cjs",
"scripts": {
  "electron": "electron .",
  "package:win": "electron-packager . CobblemonLauncher --platform=win32 --arch=x64 --out=release --overwrite --ignore='^/src' --ignore='^/public' --ignore='^/release'"
}
```

## 2. 개발 실행

```bash
npm run build           # dist/ 생성
npm run electron        # Electron 창이 뜨고 로그인 → 플레이 테스트 가능
```

## 3. `electron/modpack.json` 채우기

- `minecraftVersion`, `fabricLoaderVersion` 확인
- `server.ip` / `server.port`에 실제 서버 주소 입력
- `mods[]`에 코블몬 및 원하는 모드의 **직접 다운로드 URL** 과 파일명, (권장) SHA1 채우기
  - Modrinth: 모드 페이지 → Files → 우클릭 "링크 복사"
  - Fabric API 는 코블몬 필수 의존

## 4. Windows 배포 파일 만들기

```bash
npm run package:win
```

`release/CobblemonLauncher-win32-x64/CobblemonLauncher.exe` 를 zip으로 압축해 플레이어들에게 배포하면 됩니다.

## 5. 플레이어가 준비할 것

- Java 17+ 설치 (Adoptium 권장: https://adoptium.net/)
- 정품 마인크래프트 계정 (Microsoft)

## 6. 프로덕션용 Azure AD 앱 (선택)

`electron/auth.cjs`의 `CLIENT_ID`는 마인크래프트 공식 런처 값입니다. 자체 앱을 원하면:

1. https://portal.azure.com → "앱 등록" → 새 등록
2. 리디렉션 URI: `https://login.live.com/oauth20_desktop.srf` (Public client)
3. API 권한: `XboxLive.signin`, `offline_access`
4. 클라이언트 ID를 `auth.cjs`에 반영
