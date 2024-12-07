// 使用 Object.freeze 保护数据结构
export const selectedFiles = Object.freeze({
    A: { gcode: null, manifest: null },
    B: { gcode: null, manifest: null }
});

// 添加数据访问接口
export function updateSelectedFile(version, type, data) {
    selectedFiles[version][type] = data;
}

// 统一使用相同的数据库和存储名称
const dbName = 'GCodeViewerDB';
const storeName = 'gcodeData'; // 使用与 index.js 相同的 store 名称

// 初始化数据库
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // 创建所有需要的存储对象
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

// 保存文件信息到 IndexedDB
async function saveFileInfo() {
    try {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const fileInfo = {
            A: {
                gcode: selectedFiles.A.gcode ? {
                    content: selectedFiles.A.gcode.content,
                    info: selectedFiles.A.gcode.info
                } : null,
                manifest: selectedFiles.A.manifest ? {
                    content: selectedFiles.A.manifest.content,
                    info: selectedFiles.A.manifest.info
                } : null
            },
            B: {
                gcode: selectedFiles.B.gcode ? {
                    content: selectedFiles.B.gcode.content,
                    info: selectedFiles.B.gcode.info
                } : null,
                manifest: selectedFiles.B.manifest ? {
                    content: selectedFiles.B.manifest.content,
                    info: selectedFiles.B.manifest.info
                } : null
            }
        };
        
        await new Promise((resolve, reject) => {
            const request = store.put(fileInfo, 'fileInfo'); // 使用不同的 key
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('保存文件信息失败:', e);
    }
}

// 从 IndexedDB 恢复文件信息
async function restoreFileInfo() {
    try {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        
        const fileInfo = await new Promise((resolve) => {
            const request = store.get('fileInfo');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        if (!fileInfo) return;
        
        // 恢复文件信息和显示
        ['A', 'B'].forEach(version => {
            const versionInfo = fileInfo[version];
            
            if (!versionInfo) return;
            
            // 恢复 G-code 文件
            if (versionInfo.gcode) {
                const file = new File([versionInfo.gcode.content], versionInfo.gcode.info.name, {
                    lastModified: versionInfo.gcode.info.lastModified,
                    type: 'text/plain'
                });
                
                selectedFiles[version].gcode = {
                    content: versionInfo.gcode.content,
                    info: versionInfo.gcode.info,
                    file: file,
                    name: file.name
                };

                // 更新文件选择控件
                const input = document.getElementById(`gcodeFile${version}`);
                if (input) {
                    // 创建新的 FileList 对象
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                }
                
                updateFileDisplay(version, 'gcode', selectedFiles[version].gcode);
            }
            
            // 恢复 Manifest 文件
            if (versionInfo.manifest) {
                const file = new File([versionInfo.manifest.content], versionInfo.manifest.info.name, {
                    lastModified: versionInfo.manifest.info.lastModified,
                    type: 'application/json'
                });

                selectedFiles[version].manifest = {
                    content: versionInfo.manifest.content,
                    info: versionInfo.manifest.info,
                    file: file,
                    name: file.name
                };

                // 更新文件选择控件
                const input = document.getElementById(`manifestFile${version}`);
                if (input) {
                    // 创建新的 FileList 对象
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                }
                
                updateFileDisplay(version, 'manifest', selectedFiles[version].manifest);
            }
        });
        
        updateCompareButton();
    } catch (error) {
        console.error('恢复文件信息失败:', error);
    }
}

// 更新文件显示
function updateFileDisplay(version, type, fileData) {
    const uploadArea = document.getElementById(`${type}Upload${version}`);
    if (!uploadArea) return;

    const uploadContent = uploadArea.querySelector('.upload-content');
    const formatExt = type === 'gcode' ? '.txt' : '.json';

    if (fileData) {
        // 有文件时的显示
        uploadArea.classList.add('has-file');
        uploadContent.classList.remove('empty');
        uploadContent.classList.add('has-file');
        uploadContent.innerHTML = `
            <div class="text-container">
                <span class="upload-text">${fileData.name}</span>
            </div>
        `;

        // 添加删除按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.title = '移除文件';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const input = uploadArea.querySelector('input[type="file"]');
            input.value = '';
            
            selectedFiles[version][type] = null;
            resetUploadArea(uploadArea);
            updateCompareButton();
            saveFileInfo();
            
            return false;
        });
        uploadArea.appendChild(removeBtn);

        // 添加文件图标
        const uploadIcon = document.createElement('span');
        uploadIcon.className = 'upload-icon';
        uploadIcon.textContent = '📄';
        uploadArea.appendChild(uploadIcon);

        // 添加格式标签
        const formatTag = document.createElement('span');
        formatTag.className = 'upload-format';
        formatTag.textContent = formatExt;
        uploadArea.appendChild(formatTag);
    } else {
        resetUploadArea(uploadArea);
    }
}

// 重置上传区域到初始状态
function resetUploadArea(uploadArea) {
    const uploadContent = uploadArea.querySelector('.upload-content');
    const isGcode = uploadArea.id.includes('gcode');
    const formatExt = isGcode ? '.txt' : '.json';

    uploadArea.classList.remove('has-file');
    uploadContent.classList.add('empty');
    uploadContent.classList.remove('has-file');
    
    // 移除已有的元素
    const existingIcon = uploadArea.querySelector('.upload-icon');
    const existingRemoveBtn = uploadArea.querySelector('.remove-file');
    const existingFormat = uploadArea.querySelector('.upload-format');
    if (existingIcon) existingIcon.remove();
    if (existingRemoveBtn) existingRemoveBtn.remove();
    if (existingFormat) existingFormat.remove();
    
    uploadContent.innerHTML = `
        <div class="text-container">
            <span class="upload-text">${isGcode ? 'G-code文件' : 'Manifest文件'}</span>
        </div>
    `;

    // 添加文件图标
    const uploadIcon = document.createElement('span');
    uploadIcon.className = 'upload-icon';
    uploadIcon.textContent = '📄';
    uploadArea.appendChild(uploadIcon);

    // 添加格式标签
    const formatTag = document.createElement('span');
    formatTag.className = 'upload-format';
    formatTag.textContent = formatExt;
    uploadArea.appendChild(formatTag);
}

// 初始化上传区域
function initUploadArea(gcodeUpload, manifestUpload, version) {
    [gcodeUpload, manifestUpload].forEach(upload => {
        const input = upload.querySelector('input[type="file"]');
        if (!input) {
            console.error('找不到文件输入元素');
            return;
        }

        const isGcode = upload.id.includes('gcode');

        // 移除点击事件，让原生的 label 行为生效
        upload.addEventListener('click', (e) => {
            if (e.target === input) {
                e.stopPropagation();  // 只阻止 input 的冒泡
            }
        });

        // 文件选择变化处理
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file, version, isGcode ? 'gcode' : 'manifest');
            }
        });

        // 拖拽处理
        upload.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            upload.classList.add('drag-over');
        });

        upload.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            upload.classList.remove('drag-over');
        });

        upload.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            upload.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            const validExtension = isGcode ? '.txt' : '.json';
            
            if (file && file.name.toLowerCase().endsWith(validExtension)) {
                handleFileSelect(file, version, isGcode ? 'gcode' : 'manifest');
            } else {
                showToast(`请选择${validExtension}格式的文件`);
            }
        });
    });
}

// 添加全局变量
let currentVersion = null;
let currentContent = null;
let BATCH_SIZE = 1000;

// 创建 Worker
const gcodeWorker = new Worker('/static/js/workers/gcodeParser.worker.js');
let currentPaths = [];
let processingFile = false;

// 处理 Worker 消息
gcodeWorker.onmessage = function(e) {
    const { result, isLastBatch, progress } = e.data;
    
    if (progress % 10 === 0) {
        showToast(`解析进度: ${progress.toFixed(0)}%`);
    }
    
    if (isLastBatch && result) {
        processingFile = false;
        
        // 验证结果数据结构
        if (!result.vectorPaths || !Array.isArray(result.vectorPaths)) {
            console.error('Invalid parser result:', result);
            return;
        }
        
        // 触发加载事件，传递整的解析结果
        const event = new CustomEvent('gcodeLoaded', {
            detail: { 
                version: currentVersion,
                data: {
                    vectorPaths: result.vectorPaths,
                    rasterData: result.rasterData || {
                        x: [],
                        y: [],
                        colors: []
                    }
                }
            }
        });
        document.dispatchEvent(event);
        
        currentVersion = null;
        currentContent = null;
    }
};

// 处理下一批数据
function processNextBatch() {
    if (!processingFile || !currentContent) return;
    
    const batchId = Math.floor(currentPaths.length / BATCH_SIZE);
    gcodeWorker.postMessage({
        content: currentContent,
        batchId,
        batchSize: BATCH_SIZE,
        skipLines: [
            'G90', 'G91', 'G92', 'M3', 'M5',  // 跳过这些命令
            'G17', 'G18', 'G19', 'G20', 'G21',
            'M2', 'M30'
        ]
    });
}

// 修改文件处理函数
function handleFileSelect(file, version, type) {
    const validExtension = type === 'gcode' ? '.txt' : '.json';
    if (file && file.name.toLowerCase().endsWith(validExtension)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedFiles[version][type] = {
                file: file,
                content: e.target.result,
                info: {
                    name: file.name,
                    lastModified: file.lastModified
                },
                name: file.name
            };

            if (type === 'gcode') {
                currentVersion = version;
                currentContent = e.target.result;
                processingFile = true;
                currentPaths = [];
                processNextBatch();
            }

            updateFileDisplay(version, type, selectedFiles[version][type]);
            updateCompareButton();
            saveFileInfo();
        };
        reader.readAsText(file);
    } else {
        showToast(`请选择${validExtension}格式的文件`);
    }
}

// 更新比较按钮态
export function updateCompareButton() {
    const compareBtn = document.getElementById('compareBtn');
    const isComplete = (version) => 
        selectedFiles[version].gcode?.file && selectedFiles[version].manifest?.file;
    
    compareBtn.disabled = !(isComplete('A') && isComplete('B'));
}

// 检查是否准备好进行比较
export function isReadyToCompare() {
    return selectedFiles.A.gcode?.file && selectedFiles.A.manifest?.file && 
           selectedFiles.B.gcode?.file && selectedFiles.B.manifest?.file;
}

export function initFileManager() {
    ['A', 'B'].forEach(version => {
        const gcodeUpload = document.getElementById(`gcodeUpload${version}`);
        const manifestUpload = document.getElementById(`manifestUpload${version}`);

        if (!gcodeUpload || !manifestUpload) {
            console.error(`找不到版本 ${version} 的上传元素`);
            return;
        }

        // 初始化文件上传区域
        initUploadArea(gcodeUpload, manifestUpload, version);
    });

    // 恢复保存的文件信息
    restoreFileInfo();
}

// 导出需要的函数
export {
    saveFileInfo,
    updateFileDisplay
};