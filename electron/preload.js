// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  showNativeNotification: ({ title, body, icon }) =>
    ipcRenderer.invoke('show-native-notification', { title, body, icon }),
  secureStore: {
    set: (key, value) => ipcRenderer.invoke('secure-store-set', { key, value }),
    get: (key) => ipcRenderer.invoke('secure-store-get', { key }),
    remove: (key) => ipcRenderer.invoke('secure-store-remove', { key }),
  }
})
