import React from "react";
import { createRoot } from "react-dom/client";
import { LauncherApp } from "@/components/LauncherApp";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LauncherApp />
  </React.StrictMode>,
);
