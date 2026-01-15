// 설정: 배포 후 생성된 Google Apps Script 웹 앱 URL을 여기에 넣으세요
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwPxbwkQPXt2Pv_iAeINSr5_kkutYK4vV_8m8WfRl-nJwZn8Ffeu_Wt9FAGCGDkhctJ/exec';

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const previewContainer = document.getElementById('file-preview');
const ministrySelect = document.getElementById('ministry-select');
const btnSubmit = document.getElementById('btn-submit');
const btnText = document.getElementById('btn-text');
const spinner = document.getElementById('spinner');
const submitterInput = document.getElementById('submitter-name');

let selectedFiles = [];

// 1. 사역 목록 불러오기
async function loadMinistries() {
    try {
        const response = await fetch(GAS_URL);
        const folders = await response.json();

        ministrySelect.innerHTML = folders.map(f =>
            `<option value="${f.id}">${f.name}</option>`
        ).join('');

        checkReady();
    } catch (err) {
        console.error('사역 목록 로드 실패:', err);
        ministrySelect.innerHTML = '<option value="">목록을 불러오지 못했습니다</option>';
    }
}

// 2. 파일 선택 처리
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
});

function handleFiles(files) {
    selectedFiles = [...selectedFiles, ...files];
    updatePreview();
    checkReady();
}

function updatePreview() {
    previewContainer.innerHTML = '';
    selectedFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'preview-item';
            previewContainer.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.className = 'preview-item';
            icon.innerHTML = '<i class="fas fa-video" style="padding: 20px;"></i>';
            previewContainer.appendChild(icon);
        }
    });
}

// 3. 버튼 활성화 상태 체크
function checkReady() {
    const isReady = ministrySelect.value && selectedFiles.length > 0;
    btnSubmit.disabled = !isReady;
}

ministrySelect.addEventListener('change', checkReady);

// 4. 업로드 실행
btnSubmit.addEventListener('click', async () => {
    if (btnSubmit.disabled) return;

    setLoading(true);

    const folderId = ministrySelect.value;
    const submitter = submitterInput.value || "익명";

    try {
        for (const file of selectedFiles) {
            const fileData = await readFileAsBase64(file);
            const payload = {
                folderId: folderId,
                fileName: file.name,
                fileData: fileData,
                mimeType: file.type,
                submitter: submitter
            };

            await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        // 성공 시 화면 전환
        document.getElementById('upload-screen').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
    } catch (err) {
        alert('업로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    btnSubmit.disabled = isLoading;
    spinner.style.display = isLoading ? 'block' : 'none';
    btnText.innerText = isLoading ? '업로드 중...' : '발송하기';
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 초기 실행
if (GAS_URL !== 'YOUR_DEPLOYED_GAS_WEB_APP_URL') {
    loadMinistries();
} else {
    ministrySelect.innerHTML = '<option value="">GAS URL 설전 전</option>';
}
