let isDbConnected = false;

const btnCreate = document.getElementById('btn-create');
const btnSelect = document.getElementById('btn-select');
const dbPathDisplay = document.getElementById('db-path');
const fileList = document.getElementById('file-list');
const dropZone = document.getElementById('drop-zone');

async function setupDb(path) {
  if (path) {
    dbPathDisplay.innerText = `연결됨: ${path}`;
    isDbConnected = true;
    await updateFileList();
  }
}

btnCreate.onclick = async () => {
  const path = await window.api.createDB();
  await setupDb(path);
};

btnSelect.onclick = async () => {
  const path = await window.api.selectDB();
  await setupDb(path);
};

async function updateFileList() {
  if (!isDbConnected) return;
  const files = await window.api.getFiles();
  fileList.innerHTML = '';

  files.forEach(file => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${file.id}</td>
      <td class="file-name-cell">${file.file_name}</td>
      <td>${file.mime_type || 'unknown'}</td>
      <td>${(file.file_size / 1024).toFixed(2)} KB</td>
      <td>${file.upload_date}</td>
      <td class="btn-group">
        <button class="btn-rename">이름 변경</button>
        <button class="btn-delete">삭제</button>
      </td>
    `;

    // 파일 이름 셀이나 행 더블클릭 시 미리보기
    tr.ondblclick = () => openPreview(file.id);

    tr.querySelector('.btn-rename').onclick = async (e) => {
      e.stopPropagation();
      const newName = prompt('새 파일명을 입력하세요:', file.file_name);
      if (newName && newName !== file.file_name) {
        await window.api.renameFile(file.id, newName);
        updateFileList();
      }
    };

    tr.querySelector('.btn-delete').onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`'${file.file_name}' 파일을 삭제할까요?`)) {
        await window.api.deleteFile(file.id);
        updateFileList();
      }
    };

    fileList.appendChild(tr);
  });
}

// 뷰어 개선: DB에서 가져온 mime_type을 직접 사용
async function openPreview(id) {
  try {
    const file = await window.api.getFileData(id);
    // DB에 저장된 mime_type을 사용하여 Blob 생성
    const blob = new Blob([file.data], { type: file.mime_type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    // 새 창에서 열기
    window.open(url, '_blank');
    
    // 메모리 해제
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error('미리보기 에러:', err);
    alert('파일을 열 수 없습니다.');
  }
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.style.background = '#e1f5fe';
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.style.background = '#f9f9f9';
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.style.background = '#f9f9f9';

  if (!isDbConnected) {
    alert("먼저 DB를 생성하거나 선택해주세요.");
    return;
  }

  const files = e.dataTransfer.files;
  for (const file of files) {
    try {
      const filePath = window.api.getPathForFile(file);
      // 브라우저가 감지한 file.type(MIME)을 함께 전달
      const mimeType = file.type || 'application/octet-stream';
      await window.api.saveFile(filePath, mimeType);
    } catch (err) {
      console.error('저장 오류:', err);
    }
  }
  await updateFileList();
});