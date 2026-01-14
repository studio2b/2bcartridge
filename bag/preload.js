const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  createDB: () => ipcRenderer.invoke('create-db'),
  selectDB: () => ipcRenderer.invoke('select-db'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // 인자 구성에 맞춰 전달 (renderer에서 호출 시 전달함)
  saveFile: (filePath, mimeType) => ipcRenderer.invoke('save-file', filePath, mimeType),
  getFiles: () => ipcRenderer.invoke('get-files'),
  getFileData: (id) => ipcRenderer.invoke('get-file-data', id),
  deleteFile: (id) => ipcRenderer.invoke('delete-file', id),
  renameFile: (id, newName) => ipcRenderer.invoke('rename-file', id, newName)
});