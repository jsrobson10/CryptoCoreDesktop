const { app, BrowserWindow } = require("electron");
const { platform } = require("os");

function createWindow()
{
    const win = new BrowserWindow({
		minWidth: 1200,
		minHeight: 680,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.removeMenu();
    win.loadFile("index.html");

    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () =>
{
    // don't quit the app if we're on MacOS
    if(process.platform !== "darwin")
    {
        app.quit();
    }
});

app.on("activate", () =>
{
    // make a new window if the app is activated but no windows are open
    // useful on MacOS where the app can be running with no windows open
    if(BrowserWindow.getAllWindows().length === 0)
    {
        createWindow();
    }
});
