import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Settings, LogOut, Loader2, Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "경준의 놀이동산" },
      { name: "description", content: "코블몬 서버\u00a0" },
    ],
  }),
  component: Launcher,
});

// Bridge exposed by electron/preload.cjs. In the Lovable web preview this is
// undefined — the UI falls back to a mocked demo so you can iterate on layout.
type LauncherAPI = {
  login: () => Promise<{ username: string; uuid: string } | null>;
  logout: () => Promise<void>;
  getProfile: () => Promise<{ username: string; uuid: string } | null>;
  play: (opts: { ramGb: number }) => Promise<void>;
  onProgress: (cb: (p: { stage: string; percent: number }) => void) => () => void;
  getConfig: () => Promise<{ ramGb: number }>;
  setConfig: (c: { ramGb: number }) => Promise<void>;
};

declare global {
  interface Window {
    launcher?: LauncherAPI;
  }
}

type Profile = { username: string; uuid: string };
type Stage = "idle" | "installing" | "launching" | "running";

function Launcher() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<{ stage: string; percent: number }>({
    stage: "",
    percent: 0,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [ramGb, setRamGb] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const isElectron = typeof window !== "undefined" && !!window.launcher;

  useEffect(() => {
    if (!isElectron) return;
    window.launcher!.getProfile().then(setProfile);
    window.launcher!.getConfig().then((c) => setRamGb(c.ramGb));
    const off = window.launcher!.onProgress(setProgress);
    return off;
  }, [isElectron]);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      if (isElectron) {
        const p = await window.launcher!.login();
        setProfile(p);
      } else {
        // Web preview mock
        await new Promise((r) => setTimeout(r, 800));
        setProfile({ username: "DemoPlayer", uuid: "00000000-0000-0000-0000-000000000000" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (isElectron) await window.launcher!.logout();
    setProfile(null);
  }

  async function handlePlay() {
    setError(null);
    setStage("installing");
    try {
      if (isElectron) {
        await window.launcher!.play({ ramGb });
        setStage("running");
      } else {
        // Web preview: simulate progress
        for (let i = 0; i <= 100; i += 5) {
          setProgress({ stage: i < 70 ? "모드 다운로드 중" : "게임 시작 중", percent: i });
          await new Promise((r) => setTimeout(r, 80));
        }
        setStage("running");
        setTimeout(() => setStage("idle"), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "실행 실패");
      setStage("idle");
    }
  }

  async function saveSettings() {
    if (isElectron) await window.launcher!.setConfig({ ramGb });
    setShowSettings(false);
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[oklch(0.18_0.05_180)] text-white">
      {/* Cobblemon-inspired backdrop */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, oklch(0.7 0.2 145) 0%, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.65 0.22 25) 0%, transparent 45%), radial-gradient(circle at 50% 100%, oklch(0.6 0.2 260) 0%, transparent 50%)",
        }}
      />
      <div className="absolute inset-0 backdrop-blur-3xl" />

      <div className="relative flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-red-500 shadow-lg">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">경준의 놀이동산</h1>
              <p className="text-xs text-white/60">코블몬 서버&nbsp;</p>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={handleLogout}
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          )}
        </header>

        {/* Body */}
        <main className="flex flex-1 items-center justify-center px-6">
          {!profile ? (
            <LoginCard onLogin={handleLogin} loading={loading} error={error} isElectron={isElectron} />
          ) : (
            <HomeCard
              profile={profile}
              stage={stage}
              progress={progress}
              onPlay={handlePlay}
              error={error}
            />
          )}
        </main>

        <footer className="px-8 py-4 text-center text-xs text-white/40">
          Minecraft 1.21.1 · Fabric · Cobblemon
        </footer>
      </div>

      {showSettings && (
        <SettingsModal
          ramGb={ramGb}
          setRamGb={setRamGb}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function LoginCard({
  onLogin,
  loading,
  error,
  isElectron,
}: {
  onLogin: () => void;
  loading: boolean;
  error: string | null;
  isElectron: boolean;
}) {
  return (
    <Card className="w-full max-w-md border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">하이룽</h2>
        <p className="mt-2 text-sm text-white/70">
          Microsoft 계정으로 로그인하세요.{"\n"}알긋죠?
        </p>
      </div>
      <Button
        onClick={onLogin}
        disabled={loading}
        size="lg"
        className="mt-8 w-full bg-[#0078d4] text-white hover:bg-[#106ebe]"
      >
        {loading ? (
          <Loader2 className="mr-2 size-5 animate-spin" />
        ) : (
          <svg className="mr-2 size-5" viewBox="0 0 21 21">
            <path fill="#f25022" d="M1 1h9v9H1z" />
            <path fill="#00a4ef" d="M1 11h9v9H1z" />
            <path fill="#7fba00" d="M11 1h9v9h-9z" />
            <path fill="#ffb900" d="M11 11h9v9h-9z" />
          </svg>
        )}
        Microsoft 계정으로 로그인
      </Button>
      {error && (
        <p className="mt-4 text-center text-sm text-red-400">{error}</p>
      )}
      {!isElectron && (
        <p className="mt-6 text-center text-xs text-amber-300/80">
          웹 미리보기 모드입니다. 실제 로그인은 패키징된 데스크톱 앱에서만 동작합니다.
        </p>
      )}
    </Card>
  );
}

function HomeCard({
  profile,
  stage,
  progress,
  onPlay,
  error,
}: {
  profile: Profile;
  stage: Stage;
  progress: { stage: string; percent: number };
  onPlay: () => void;
  error: string | null;
}) {
  const busy = stage === "installing" || stage === "launching";

  return (
    <Card className="w-full max-w-lg border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <img
          src={`https://mc-heads.net/avatar/${profile.uuid.replace(/-/g, "")}/64`}
          alt=""
          className="size-16 rounded-lg bg-white/10"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23444'/></svg>";
          }}
        />
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">로그인됨</p>
          <p className="text-xl font-bold">{profile.username}</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Button
          onClick={onPlay}
          disabled={busy}
          size="lg"
          className="h-14 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-70"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              {progress.stage || "준비 중"}
            </>
          ) : stage === "running" ? (
            "게임 실행 중"
          ) : (
            <>
              <Play className="mr-2 size-5 fill-current" />
              플레이
            </>
          )}
        </Button>

        {busy && (
          <div className="space-y-1">
            <Progress value={progress.percent} className="h-2 bg-white/10" />
            <p className="text-right text-xs text-white/50">{progress.percent}%</p>
          </div>
        )}

        {stage === "running" && (
          <p className="text-center text-sm text-emerald-300">
            마인크래프트가 실행되었습니다. 서버에 자동으로 접속됩니다.
          </p>
        )}

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    </Card>
  );
}

function SettingsModal({
  ramGb,
  setRamGb,
  onSave,
  onClose,
}: {
  ramGb: number;
  setRamGb: (n: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border-white/10 bg-[oklch(0.2_0.04_180)] p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">설정</h3>
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Java RAM 할당</label>
            <span className="text-sm font-mono">{ramGb} GB</span>
          </div>
          <Slider
            value={[ramGb]}
            onValueChange={([v]) => setRamGb(v)}
            min={2}
            max={16}
            step={1}
          />
          <p className="text-xs text-white/50">
            코블몬은 최소 4GB를 권장합니다.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
            취소
          </Button>
          <Button onClick={onSave} className="bg-emerald-500 hover:bg-emerald-400">
            저장
          </Button>
        </div>
      </Card>
    </div>
  );
}
