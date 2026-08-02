# Cobblemon Launcher — 로컬 빌드 & 패키징 가이드

Lovable 미리보기는 웹 UI만 보여줍니다. 실제 로그인 / 모드 다운로드 / 게임 실행은 아래 절차로 로컬 PC(Windows 권장)에서 확인하세요.

## 1. 사전 준비

- Node.js LTS: https://nodejs.org
- Git: https://git-scm.com
- Java 17+: https://adoptium.net

## 2. 코드 받아서 VS Code 열기

```bash
git clone https://github.com/<내계정>/<저장소이름>.git
cd <저장소이름>
code .
```

## 3. 패키지 설치 (VS Code 터미널: Ctrl + `)

```bash
npm install
npm install --save-dev electron electron-packager
```

> `vite.config.ts` / `package.json` 수정은 이미 적용되어 있습니다. 따로 손댈 필요 없습니다.

## 4. 개발 실행 (창 띄워서 테스트)

```bash
npm run electron
```

`npm run build:electron`(Electron 전용 정적 화면 빌드)이 자동 실행된 뒤 Electron 창이 뜹니다.
여기서 Microsoft 로그인 → 플레이까지 실제로 동작합니다.

## 5. `electron/modpack.json` 채우기

- `minecraftVersion`, `fabricLoaderVersion` 확인
- `server.ip` / `server.port`에 실제 서버 주소 입력
- `mods[]`에 코블몬 및 원하는 모드의 **직접 다운로드 URL** 과 파일명, (권장) SHA1 채우기
  - Modrinth: 모드 페이지 → Files → 우클릭 "링크 복사"
  - Fabric API 는 코블몬 필수 의존

수정 후 다시 `npm run package:win` 하면 플레이어는 새 exe로 새 모드/버전을 자동 사용합니다.

## 6. Windows 배포 파일(exe) 만들기

```bash
npm run package:win
```

만들어지는 위치:

```
<저장소폴더>/release/CobblemonLauncher-win32-x64/CobblemonLauncher.exe
```

`CobblemonLauncher-win32-x64` **폴더 전체**를 zip으로 압축해 배포하세요.
(exe 하나만 보내면 실행되지 않습니다. 같은 폴더의 dll/resources가 필요합니다.)

## 7. 플레이어가 준비할 것

- Java 17+ 설치 (Adoptium 권장: https://adoptium.net/)
- 정품 마인크래프트 계정 (Microsoft)

## 8. 프로덕션용 Azure AD 앱 (선택)

`electron/auth.cjs`의 `CLIENT_ID`는 마인크래프트 공식 런처 값입니다. 자체 앱을 원하면:

1. https://portal.azure.com → "앱 등록" → 새 등록
2. 리디렉션 URI: `https://login.live.com/oauth20_desktop.srf` (Public client)
3. API 권한: `XboxLive.signin`, `offline_access`
4. 클라이언트 ID를 `auth.cjs`에 반영
