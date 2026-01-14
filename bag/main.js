const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });
  mainWindow.loadFile('index.html');
}

// 테이블 초기화 (mime_type 컬럼 추가)
function initTable() {
  if (!db) return;
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    md5_hash TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_data BLOB NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_size INTEGER NOT NULL
  )`);
}

ipcMain.handle('create-db', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '새 SQLite 데이터베이스 생성',
    defaultPath: 'my_storage.db',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });
  if (canceled || !filePath) return null;
  db = new DatabaseSync(filePath);
  initTable();
  return filePath;
});

ipcMain.handle('select-db', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '기존 SQLite 데이터베이스 선택',
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  db = new DatabaseSync(filePaths[0]);
  initTable();
  return filePaths[0];
});

// 파일 저장 (mimeType 인자 추가)
ipcMain.handle('save-file', async (event, filePath, mimeType) => {
  if (!db) throw new Error("DB가 연결되지 않았습니다.");
  try {
    const buffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    db.exec("BEGIN;");
    const insert = db.prepare(`
      INSERT INTO files (md5_hash, sha256_hash, file_name, mime_type, file_data, file_size) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(md5, sha256, fileName, mimeType, buffer, stats.size);
    db.exec("COMMIT;");
    return true;
  } catch (err) {
    if (db) db.exec("ROLLBACK;");
    throw err;
  }
});

ipcMain.handle('get-files', () => {
  if (!db) return [];
  // 목록 조회 시 mime_type도 가져옴
  return db.prepare("SELECT id, file_name, mime_type, file_size, upload_date FROM files ORDER BY id DESC").all();
});

ipcMain.handle('get-file-data', (event, id) => {
  // 데이터 조회 시 mime_type 포함
  const result = db.prepare("SELECT file_data, file_name, mime_type FROM files WHERE id = ?").get(id);
  return { 
    data: result.file_data, 
    name: result.file_name, 
    mime_type: result.mime_type 
  };
});

ipcMain.handle('delete-file', (event, id) => {
  db.exec("BEGIN;");
  db.prepare("DELETE FROM files WHERE id = ?").run(id);
  db.exec("COMMIT;");
  return true;
});

ipcMain.handle('rename-file', (event, id, newName) => {
  db.exec("BEGIN;");
  db.prepare("UPDATE files SET file_name = ? WHERE id = ?").run(newName, id);
  db.exec("COMMIT;");
  return true;
});

app.whenReady().then(createWindow);