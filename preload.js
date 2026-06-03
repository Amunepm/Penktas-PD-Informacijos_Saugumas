const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("vaultAPI", {
  saveVault: function (encryptedData) {
    return ipcRenderer.invoke("save-vault", encryptedData);
  },
  loadVault: function () {
    return ipcRenderer.invoke("load-vault");
  },
  onAppClosing: function (callback) {
    ipcRenderer.on("app-closing", function () {
      callback();
    });
  },
  finishClose: function () {
    return ipcRenderer.invoke("finish-close");
  },
});
