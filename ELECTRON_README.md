# 경준의 놀이동산 런처 — 빌드 & 배포 가이드

## 0. 이번 버전에서 바뀐 것

- **원격 매니페스트 자동 업데이트**: 런처가 실행될 때마다 GitHub의
  `electron/modpack.json`을 읽어옵니다. 모드/버전/서버 IP를 GitHub에서 고치면
  친구는 **런처 재설치 없이** 다음 실행 때 자동 반영됩니다.
  (인터넷이 안 되면 마지막으로 받은 내용을 사용합니다.)
- **구버전 모드 자동 삭제**: 매니페스트에 없는 jar/zip은 mods, shaderpacks,
  resourcepacks 폴더에서 자동으로 지워집니다 → 모드 충돌 크래시 방지.
- **크래시 감지**: 게임이 죽으면 원인 줄을 런처 화면에 빨간 박스로 표시하고
  "로그 폴더 열기" 버튼을 제공합니다.
- 실제 모드팩(모드 96개 + 셰이더 + 리소스팩 5개), Fabric 0.19.3,
  서버 `211.177.97.174:25565` 가 매니페스트에 들어가 있습니다.

## 1. 사전 준비 (개발자 = 나)

- Node.js LTS: https://nodejs.org
- Git: https://git-scm.com
- Java 21 (Adoptium): https://adoptium.net

## 2. Step by step — 처음부터

```bash
# 1) 코드 받기
git clone https://github.com/tansy12301/cobble-connect-launcher.git
cd cobble-connect-launcher
code .

# 2) 패키지 설치 (VS Code 터미널을 Command Prompt로 열 것. PowerShell은 정책 오류)
npm install
npm install --save-dev electron @electron/packager

# 3) 창 띄워 테스트 (진짜 로그인/다운로드/플레이 됨)
npm run electron

# 4) 배포용 exe 만들기
npm run package:win

```

**exe 위치**

```
cobble-connect-launcher\release\CobblemonLauncher-win32-x64\CobblemonLauncher.exe
```

`CobblemonLauncher-win32-x64` **폴더 전체를 zip으로** 압축해서 배포하세요
(exe 하나만 보내면 실행 안 됩니다).

## 3. 배포 후 모드/버전 바꾸기 (재배포 불필요)

1. GitHub에서 `electron/modpack.json` 수정 → 커밋 (main 브랜치)
2. 끝. 친구가 런처를 켜면 자동으로 새 모드를 받고 구버전은 삭제됩니다.

단, **런처 자체 코드(.cjs / UI)를 고쳤을 때**는 새 zip을 다시 배포해야 합니다.

## 4. 모드 추가하는 법

Modrinth 모드 페이지 → Versions → 파일 우클릭 "링크 복사". 그리고
`electron/modpack.json`의 `mods[]`에 추가:

```json
{
  "name": "모드이름",
  "url": "https://cdn.modrinth.com/data/.../파일.jar",
  "filename": "파일.jar",
  "sha1": ""
}
```

`filename`은 URL 끝 파일명과 똑같이. `sha1`은 비워도 동작합니다.
셰이더는 `shaders[]`, 리소스팩/데이터팩 zip은 `resourcepacks[]`에 같은 형식으로.

> Modrinth에 없는 모드(직접 가진 jar)는 URL이 필요합니다. 저장소에
> `mods-host/` 폴더를 만들어 jar를 올리고
> `https://github.com/tansy12301/cobble-connect-launcher/raw/main/mods-host/파일.jar`
> 를 url로 쓰면 됩니다. (파일당 100MB 미만)

## 5. 플레이어(친구)가 할 일

1. zip 다운로드 → 압축 풀기
2. Java 21 설치 (https://adoptium.net)
3. `CobblemonLauncher.exe` 실행 → Microsoft 로그인 → 플레이
4. 이후 모드가 바뀌어도 그냥 실행만 하면 됨

## 6. 프로덕션용 Azure AD 앱 (선택)

`electron/auth.cjs`의 `CLIENT_ID`는 마인크래프트 공식 런처 값입니다. 자체 앱을 원하면:

1. https://portal.azure.com → "앱 등록" → 새 등록
2. 리디렉션 URI: `https://login.live.com/oauth20_desktop.srf` (Public client)
3. API 권한: `XboxLive.signin`, `offline_access`
4. 클라이언트 ID를 `auth.cjs`에 반영
