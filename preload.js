const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openDB: (path) => ipcRenderer.invoke('open-db', path),
  getData: (params) => ipcRenderer.invoke('get-data', params),
  updateCell: (params) => ipcRenderer.invoke('update-cell', params),
  getFilePath: (file) => webUtils.getPathForFile(file),
  // 서버 제어
  toggleServer: (config) => ipcRenderer.invoke('toggle-server', config),
  // 로그 수신 전용 리스너
  onServerLog: (callback) => ipcRenderer.on('server-log', (event, data) => callback(data))
});