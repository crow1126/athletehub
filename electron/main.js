const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

// ── SECURITY MEASURE 4: SIGNED AUTO-UPDATES ──
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.verifyUpdateCodeSignature = true

let mainWindow

// ── SECURITY MEASURE 5: SESSION STORAGE IN OS KEYCHAIN (safeStorage) ──
const getStorePath = () => path.join(app.getPath('userData'), 'secure_session.enc')

function readEncryptedStore() {
  try {
    const storePath = getStorePath()
    if (!fs.existsSync(storePath)) return {}
    const raw = fs.readFileSync(storePath, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to read secure store:', err)
    return {}
  }
}

function writeEncryptedStore(data) {
  try {
    const storePath = getStorePath()
    fs.writeFileSync(storePath, JSON.stringify(data), 'utf8')
  } catch (err) {
    console.error('Failed to write secure store:', err)
  }
}

ipcMain.handle('secure-store-set', async (event, { key, value }) => {
  if (!key || typeof value !== 'string') return false
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value).toString('base64')
    const store = readEncryptedStore()
    store[key] = { encrypted: true, data: encrypted }
    writeEncryptedStore(store)
    return true
  } else {
    const store = readEncryptedStore()
    store[key] = { encrypted: false, data: Buffer.from(value).toString('base64') }
    writeEncryptedStore(store)
    return true
  }
})

ipcMain.handle('secure-store-get', async (event, { key }) => {
  if (!key) return null
  const store = readEncryptedStore()
  const record = store[key]
  if (!record) return null

  try {
    if (record.encrypted && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(record.data, 'base64')
      return safeStorage.decryptString(buffer)
    } else {
      return Buffer.from(record.data, 'base64').toString('utf8')
    }
  } catch (err) {
    console.error('Failed to decrypt key:', key, err)
    return null
  }
})

ipcMain.handle('secure-store-remove', async (event, { key }) => {
  if (!key) return false
  const store = readEncryptedStore()
  delete store[key]
  writeEncryptedStore(store)
  return true
})

// ── SECURITY MEASURE 2: RESTRICT NAVIGATION / WHITELISTED DOMAINS ──
const ALLOWED_INTERNAL_ORIGINS = [
  'https://apextrackgh.com',
  'https://www.apextrackgh.com'
]

const ALLOWED_EXTERNAL_PREFIXES = [
  'https://checkout.moolre.com',
  'https://paystack.com',
  'https://checkout.paystack.com',
  'https://github.com',
  'https://release-assets.githubusercontent.com',
  'mailto:admin@apextrackgh.com'
]

function isAllowedInternal(url) {
  if (!url) return false
  if (process.env.ELECTRON_START_URL && url.startsWith(process.env.ELECTRON_START_URL)) {
    return true
  }
  return ALLOWED_INTERNAL_ORIGINS.some(origin => url.startsWith(origin))
}

function isAllowedExternal(url) {
  if (!url) return false
  return ALLOWED_EXTERNAL_PREFIXES.some(prefix => url.startsWith(prefix))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'ApexTrack',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,

    // ── SECURITY MEASURE 1: CONTEXT ISOLATION & NO NODE INTEGRATION & SANDBOX ──
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Custom User-Agent tag for bulletproof Electron detection
  const defaultUA = mainWindow.webContents.getUserAgent()
  mainWindow.webContents.setUserAgent(`${defaultUA} Electron ApexTrackDesktop`)

  // Start at landing page
  const startUrl = process.env.ELECTRON_START_URL || 'https://apextrackgh.com/'
  mainWindow.loadURL(startUrl)

  // ── RESTRICT POPUP WINDOWS & EXTERNAL LINKS ──
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) {
      shell.openExternal(url)
    }
    // Hard-block all other popup attempts inside Electron
    return { action: 'deny' }
  })

  // ── RESTRICT NAVIGATION (WILL-NAVIGATE) ──
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedInternal(url)) {
      return // Allow navigation within app domain
    }

    event.preventDefault()

    if (isAllowedExternal(url)) {
      shell.openExternal(url)
    } else {
      console.warn(`[Security] Hard-blocked unauthorized navigation to: ${url}`)
    }
  })

  // ── PREVENT HTTP REDIRECT HIJACKING (WILL-REDIRECT) ──
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedInternal(url) && !isAllowedExternal(url)) {
      event.preventDefault()
      console.warn(`[Security] Hard-blocked unauthorized redirect attempt to: ${url}`)
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
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log('[AutoUpdater] Update check status:', err?.message || err)
    })
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
