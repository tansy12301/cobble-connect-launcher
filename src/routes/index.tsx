import { createFileRoute } from "@tanstack/react-router";
import { LauncherApp } from "@/components/LauncherApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "경준의 놀이동산" },
      { name: "description", content: "코블몬 서버 전용 마인크래프트 런처" },
      { property: "og:title", content: "경준의 놀이동산" },
      { property: "og:description", content: "코블몬 서버 전용 마인크래프트 런처" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LauncherApp,
});
