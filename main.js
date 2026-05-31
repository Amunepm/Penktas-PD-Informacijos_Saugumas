const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let isClosing = false;

function getVaultPath() {
  return path.join(app.getPath("userData"), "vault.txt");
}

function ensureVaultFile() {
  const filePath = getVaultPath();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }

  return filePath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  ensureVaultFile();
  mainWindow.loadFile("index.html");

  mainWindow.on("close", function (event) {
    if (isClosing) {
      return;
    }

    event.preventDefault();
    mainWindow.webContents.send("app-closing");

    setTimeout(function () {
      if (!isClosing && mainWindow && !mainWindow.isDestroyed()) {
        isClosing = true;
        mainWindow.close();
      }
    }, 3000);
  });
}

ipcMain.handle("save-vault", function (event, encryptedData) {
  const filePath = ensureVaultFile();

  fs.writeFileSync(filePath, encryptedData, "utf8");

  return {
    success: true,
    path: filePath,
  };
});

ipcMain.handle("load-vault", function () {
  const filePath = ensureVaultFile();
  const content = fs.readFileSync(filePath, "utf8");

  return {
    exists: content !== "",
    content: content,
    path: filePath,
  };
});

ipcMain.handle("finish-close", function () {
  isClosing = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

app.whenReady().then(function () {
  createWindow();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
