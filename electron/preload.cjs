const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  login: () => ipcRenderer.invoke("launcher:login"),
  logout: () => ipcRenderer.invoke("launcher:logout"),
  getProfile: () => ipcRenderer.invoke("launcher:getProfile"),
  play: (opts) => ipcRenderer.invoke("launcher:play", opts),
  getConfig: () => ipcRenderer.invoke("launcher:getConfig"),
  setConfig: (cfg) => ipcRenderer.invoke("launcher:setConfig", cfg),
  onProgress: (cb) => {
    const listener = (_e, p) => cb(p);
    ipcRenderer.on("launcher:progress", listener);
    return () => ipcRenderer.removeListener("launcher:progress", listener);
  },
});
