// 설정: 배포 후 생성된 Google Apps Script 웹 앱 URL을 여기에 넣으세요
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwPxbwkQPXt2Pv_iAeINSr5_kkutYK4vV_8m8WfRl-nJwZn8Ffeu_Wt9FAGCGDkhctJ/exec';

// === 설정 ===
const MAX_IMAGE_WIDTH = 1920;       // 이미지 최대 가로 픽셀
const MAX_IMAGE_HEIGHT = 1920;      // 이미지 최대 세로 픽셀
const IMAGE_QUALITY = 0.85;         // JPEG 압축 품질 (0~1)
const MAX_FILE_SIZE_MB = 10;        // 파일당 최대 MB (영상 등)
const MAX_FILE_COUNT = 20;          // 최대 파일 수

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const previewContainer = document.getElementById('file-preview');
const ministrySelect = document.getElementById('ministry-select');
const btnSubmit = document.getElementById('btn-submit');
const btnText = document.getElementById('btn-text');
const spinner = document.getElementById('spinner');
const submitterInput = document.getElementById('submitter-name');
const fileCount = document.getElementById('file-count');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

let selectedFiles = [];

// 1. 사역 목록 불러오기
async function loadMinistries() {
    try {
        const response = await fetch(GAS_URL);
        const folders = await response.json();

        ministrySelect.innerHTML = '<option value="">-- 사역을 선택하세요 --</option>' +
            folders.map(f =>
                `<option value="${f.id}">${f.name}</option>`
            ).join('');

        checkReady();
    } catch (err) {
        console.error('사역 목록 로드 실패:', err);
        ministrySelect.innerHTML = '<option value="">목록을 불러오지 못했습니다 (새로고침 해주세요)</option>';
    }
}

// 2. 파일 선택 처리
dropZone.addEventListener('click', (e) => {
    // 삭제 버튼 클릭 시 파일 선택기 열리지 않도록
    if (e.target.closest('.btn-remove')) return;
    fileInput.click();
});

// 드래그 & 드롭
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (files.length > 0) handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    // 같은 파일 다시 선택 가능하도록 리셋
    fileInput.value = '';
});

function handleFiles(files) {
    const remaining = MAX_FILE_COUNT - selectedFiles.length;
    if (remaining <= 0) {
        showToast(`최대 ${MAX_FILE_COUNT}개까지 선택할 수 있습니다.`, 'warning');
        return;
    }

    // 파일 크기 체크 (영상만 - 이미지는 압축 예정)
    const oversized = files.filter(f =>
        f.type.startsWith('video/') && f.size > MAX_FILE_SIZE_MB * 1024 * 1024
    );
    if (oversized.length > 0) {
        showToast(`영상은 ${MAX_FILE_SIZE_MB}MB 이하만 가능합니다.\n(${oversized.map(f => f.name).join(', ')})`, 'error');
        files = files.filter(f => !oversized.includes(f));
    }

    const toAdd = files.slice(0, remaining);
    if (toAdd.length < files.length) {
        showToast(`최대 ${MAX_FILE_COUNT}개까지만 추가됩니다.`, 'warning');
    }

    selectedFiles = [...selectedFiles, ...toAdd];
    updatePreview();
    checkReady();
}

function updatePreview() {
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-wrapper';

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'preview-item';
            wrapper.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.className = 'preview-item video-preview';
            icon.innerHTML = `<i class="fas fa-video"></i><span class="video-name">${file.name.length > 10 ? file.name.substring(0, 10) + '...' : file.name}</span>`;
            wrapper.appendChild(icon);
        }

        // 삭제 버튼
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            selectedFiles.splice(index, 1);
            updatePreview();
            checkReady();
        };
        wrapper.appendChild(removeBtn);

        previewContainer.appendChild(wrapper);
    });

    // 파일 수 표시 업데이트
    if (fileCount) {
        if (selectedFiles.length > 0) {
            fileCount.textContent = `${selectedFiles.length}개 선택됨`;
            fileCount.style.display = 'inline-block';
        } else {
            fileCount.style.display = 'none';
        }
    }
}

// 3. 버튼 활성화 상태 체크
function checkReady() {
    const isReady = ministrySelect.value && selectedFiles.length > 0;
    btnSubmit.disabled = !isReady;
}

ministrySelect.addEventListener('change', checkReady);

// 4. 이미지 압축 함수
function compressImage(file) {
    return new Promise((resolve) => {
        // GIF는 압축하지 않음
        if (file.type === 'image/gif') {
            resolve(file);
            return;
        }

        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            // 리사이즈 필요 여부 확인
            if (width <= MAX_IMAGE_WIDTH && height <= MAX_IMAGE_HEIGHT && file.size <= 2 * 1024 * 1024) {
                // 이미 작은 이미지는 그대로 사용
                resolve(file);
                URL.revokeObjectURL(img.src);
                return;
            }

            // 비율 유지하면서 리사이즈
            const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                URL.revokeObjectURL(img.src);
                resolve(compressedFile);
            }, 'image/jpeg', IMAGE_QUALITY);
        };

        img.onerror = () => {
            // 이미지 로드 실패 시 원본 사용
            resolve(file);
        };

        img.src = URL.createObjectURL(file);
    });
}

// 5. 업로드 실행
btnSubmit.addEventListener('click', async () => {
    if (btnSubmit.disabled) return;

    setLoading(true);
    showProgress(true);

    const folderId = ministrySelect.value;
    const submitter = submitterInput.value || "익명";
    const total = selectedFiles.length;
    let successCount = 0;
    let failedFiles = [];

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            updateProgress(i + 1, total, file.name);

            try {
                let processedFile = file;

                // 이미지인 경우 압축
                if (file.type.startsWith('image/')) {
                    processedFile = await compressImage(file);
                }

                const fileData = await readFileAsBase64(processedFile);
                const payload = {
                    folderId: folderId,
                    fileName: file.name,
                    fileData: fileData,
                    mimeType: processedFile.type,
                    submitter: submitter
                };

                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.status === "error") {
                    throw new Error(result.message);
                }
                successCount++;
            } catch (fileErr) {
                console.error(`파일 업로드 실패 (${file.name}):`, fileErr);
                failedFiles.push(file.name);
            }
        }

        if (failedFiles.length === 0) {
            // 전부 성공
            document.getElementById('upload-screen').style.display = 'none';
            document.getElementById('success-screen').style.display = 'block';
        } else if (successCount > 0) {
            // 부분 성공
            showToast(`${successCount}개 성공, ${failedFiles.length}개 실패\n실패: ${failedFiles.join(', ')}`, 'warning');
        } else {
            // 전부 실패
            showToast('모든 파일 업로드에 실패했습니다.\n파일 크기를 확인하거나 잠시 후 다시 시도해주세요.', 'error');
        }
    } catch (err) {
        showToast('업로드 중 오류가 발생했습니다: ' + err.message, 'error');
    } finally {
        setLoading(false);
        showProgress(false);
    }
});

function setLoading(isLoading) {
    btnSubmit.disabled = isLoading;
    spinner.style.display = isLoading ? 'block' : 'none';
    btnText.innerText = isLoading ? '업로드 중...' : '발송하기';
}

function showProgress(show) {
    if (progressBar) {
        progressBar.style.display = show ? 'block' : 'none';
    }
}

function updateProgress(current, total, fileName) {
    const percent = Math.round((current / total) * 100);
    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
    if (progressText) {
        const shortName = fileName.length > 15 ? fileName.substring(0, 15) + '...' : fileName;
        progressText.textContent = `${current}/${total} 업로드 중... (${shortName})`;
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 토스트 메시지
function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 애니메이션
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 초기 실행
if (GAS_URL !== 'YOUR_DEPLOYED_GAS_WEB_APP_URL') {
    loadMinistries();
} else {
    ministrySelect.innerHTML = '<option value="">GAS URL 설정 전</option>';
}
