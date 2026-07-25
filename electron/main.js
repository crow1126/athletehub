const { app, BrowserWindow, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'ApexTrack',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Custom User-Agent tag for bulletproof Electron detection
  const defaultUA = mainWindow.webContents.getUserAgent()
  mainWindow.webContents.setUserAgent(`${defaultUA} Electron ApexTrackDesktop`)

  // Start at landing page
  const startUrl = process.env.ELECTRON_START_URL || 'https://apextrackgh.com/'

  mainWindow.loadURL(startUrl)

  // Open external links (like Paystack/Moolre checkout and GitHub downloads) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://checkout.moolre.com') ||
      url.startsWith('https://paystack.com') ||
      url.startsWith('https://github.com') ||
      url.startsWith('https://release-assets.githubusercontent.com')
    ) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // Also intercept navigation to GitHub release assets
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      url.startsWith('https://github.com') ||
      url.startsWith('https://release-assets.githubusercontent.com')
    ) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('ready', () => {
    createWindow()
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
