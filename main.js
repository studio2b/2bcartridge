const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

let mainWindow;
let db = null;
let serverInstance = null; // 서버 인스턴스 저장

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  mainWindow.loadFile('index.html');
}

// 로그를 UI로 전송하는 함수
function sendLog(method, url, status) {
  const log = {
    time: new Date().toLocaleTimeString(),
    method,
    url,
    status
  };
  mainWindow.webContents.send('server-log', log);
}

// 서버 시작/중지 핸들러
ipcMain.handle('toggle-server', (event, { enabled, port }) => {
  if (enabled) {
    if (serverInstance) return { success: true };

    const server = express();
    server.use(express.json());

    // 미들웨어: 모든 요청 로그 기록
    server.use((req, res, next) => {
      res.on('finish', () => {
        sendLog(req.method, req.originalUrl, res.statusCode);
      });
      next();
    });

    // API 엔드포인트
    server.get('/:table/:id', (req, res) => {
      if (!db) return res.status(500).json({ error: "DB not loaded" });
      const { table, id } = req.params;
      try {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        const pkColumn = info.find(col => col.pk === 1)?.name || 'rowid';
        const row = db.prepare(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`).get(id);
        row ? res.json(row) : res.status(404).json({ error: "Not found" });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    try {
      // 0.0.0.0 으로 설정하여 외부 접속 허용
      serverInstance = server.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else {
    if (serverInstance) {
      serverInstance.close();
      serverInstance = null;
    }
    return { success: true };
  }
});

// DB 연결 및 테이블 목록 가져오기
ipcMain.handle('open-db', (event, filePath) => {
  try {
    db = new DatabaseSync(filePath);
    const tables = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'").all();
    return { success: true, tables };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 데이터 조회 (페이징)
ipcMain.handle('get-data', (event, { table, offset, limit, type }) => {
  try {
    let query;
    if (type === 'view') {
      // 뷰는 rowid가 없으므로 일반 SELECT 사용 (단, 이 경우 수정은 제한됨)
      query = `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`;
    } else {
      // 테이블은 rowid를 포함하여 조회
      query = `SELECT rowid as _rowid_, * FROM ${table} LIMIT ${limit} OFFSET ${offset}`;
    }
    
    const data = db.prepare(query).all();
    return data;
  } catch (error) {
    console.error("Query Error:", error);
    throw error; // 에러를 렌더러로 전달
  }
});

// 데이터 업데이트
ipcMain.handle('update-cell', (event, { table, rowid, column, value }) => {
  try {
    const stmt = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);
    stmt.run(value, rowid);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);