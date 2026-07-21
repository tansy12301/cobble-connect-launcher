# 코블몬 커스텀 런처 계획

## 결론 먼저

이건 **Electron 데스크톱 앱**으로 만들어야 합니다. 브라우저는 로컬 파일 다운로드/자바 실행 권한이 없기 때문에 웹 앱만으로는 "플레이 버튼 하나로 마크 실행"이 불가능합니다.

Lovable에서 UI + Electron 메인 프로세스 코드를 함께 개발하고, 완성되면 `.exe`/`.dmg`로 패키징해서 플레이어들에게 배포합니다. Lovable 미리보기에서는 UI만 확인 가능하고, **실제 런처 동작(로그인, 다운로드, 게임 실행)은 패키징 후 로컬에서 테스트**해야 합니다.

## 사용자 흐름

```text
1. 플레이어가 CobblemonLauncher.exe 다운로드 & 실행
2. "Microsoft 로그인" 클릭 → 브라우저 열림 → MS 계정 로그인
3. 런처가 자동으로: Xbox Live → XSTS → Minecraft 토큰 → 프로필 확인
4. 첫 실행 시: Fabric(또는 Forge) + 코블몬 + 지정 모드/셰이더 자동 다운로드
5. "플레이" 버튼 → javaw 실행 → 마크 창 뜨고 서버 접속 가능
```

Java는 사용자가 미리 설치되어 있다고 가정합니다(원하면 나중에 Adoptium JRE 자동 다운로드도 추가 가능).

## 기술 구성

**프론트엔드 (Lovable에서 개발)**

- TanStack Start + React UI: 로그인 화면, 프로필 표시, 진행률 바, 플레이 버튼, 설정 화면(RAM 할당, 폴더 위치)
- 서버 UI 부분만 — 브라우저에서 정상 동작

**Electron 메인 프로세스 (Lovable에서 함께 작성, Node.js)**

- `electron/main.cjs`: BrowserWindow 생성, IPC 핸들러
- `electron/auth.cjs`: MS OAuth Device Code Flow
  - Azure AD 앱 등록 필요 (Client ID) — Minecraft launcher용 공식 client ID `00000000402b5328` 사용 가능
  - `login.microsoftonline.com` → Xbox Live (`user.auth.xboxlive.com`) → XSTS (`xsts.auth.xboxlive.com`) → Minecraft (`api.minecraftservices.com/authentication/login_with_xbox`) → 프로필
- `electron/installer.cjs`: 
  - Fabric Loader 설치 (`meta.fabricmc.net` API)
  - 코블몬 `.jar` 다운로드 (Modrinth API: `api.modrinth.com/v2/project/cobblemon`)
  - 추가 모드/셰이더 목록을 JSON으로 관리
  - `.minecraft/cobblemon-launcher/mods/`에 저장
- `electron/launcher.cjs`: 
  - Minecraft version manifest에서 vanilla jar + libraries 다운로드
  - `javaw` classpath 조립 후 spawn
  - 서버 IP를 `servers.dat`에 자동 등록

**로컬 저장**

- 토큰: Electron `safeStorage` API로 암호화하여 `userData/tokens.enc`
- 설정: `userData/config.json`
- 게임 파일: `%APPDATA%/.cobblemon-launcher/`

## 개발 단계

1. **런처 UI 스켈레톤** — 로그인/홈/진행률/설정 화면 목업 (Lovable 미리보기에서 확인 가능)
2. **Electron 셸 세팅** — `electron/main.cjs`, `vite.config.ts`에 `base: './'`, IPC 브리지
3. **MS 인증 구현** — device code flow, 토큰 저장, 프로필 표시
4. **모드팩 매니페스트** — 모드/셰이더 목록 JSON, 서버 정보를 개발자가 관리
5. **다운로드 & 무결성 체크** — SHA1 검증, 진행률 IPC로 UI 전달
6. **게임 실행** — javaw 명령 조립, 자식 프로세스 관리
7. **패키징** — `@electron/packager`로 Windows/Mac 빌드 → 배포용 파일 생성

## 필요한 결정사항 (지금 알려주시면 좋음)

- **모드로더**: Fabric
- **마인크래프트 버전**: 예) 1.20.1
- **서버 주소**: 자동 등록할 IP:포트
- **추가 모드 목록**: 코블몬 외에 넣을 모드(성능 개선 Sodium, Lithium 등)와 셰이더
- **런처 이름/아이콘**

## 제약 및 주의사항

- Lovable 미리보기는 웹만 보여줍니다. Electron 기능 테스트는 `bun run build && npx electron .` 로 로컬에서 확인 필요.
- MS 계정 인증 후 실제 마크 소유 여부를 검사하므로, 정품이 아닌 계정은 접속 불가 (당연).
- Xbox Live 요구사항: 만 18세 미만 계정은 부모 관리 필요.
- Azure 자체 Client ID를 등록해 사용하는 것을 권장 (공식 클라이언트 ID는 서드파티 사용이 회색지대).
- macOS 코드 서명이 없으면 사용자가 "확인되지 않은 개발자" 경고를 우회해야 함.

## 진행 방식

승인해주시면 1단계(UI 스켈레톤 + Electron 셸)부터 시작합니다. 위의 결정사항은 진행하면서 채워도 되지만 모드로더와 마크 버전은 빨리 알려주세요.