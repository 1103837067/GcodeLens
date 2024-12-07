import { initFileManager } from "./modules/fileManager.js";
import { initComparison, handleTabChange } from "./modules/comparison.js";
import { initTooltip } from "./modules/utils/tooltip.js";
import { GCodeViewer } from './modules/display/gcodeViewer.js';

// 添加全局函数
window.toggleAllModules = function (show) {
  document.querySelectorAll(".parameters-list").forEach((list) => {
    list.style.display = show ? "block" : "none";
  });
  document.querySelectorAll(".toggle-icon").forEach((icon) => {
    icon.textContent = show ? "▼" : "▶";
  });
};

window.toggleModule = function (header) {
  const moduleSection = header.closest(".module-section");
  const parametersList = moduleSection.querySelector(".parameters-list");
  const toggleIcon = header.querySelector(".toggle-icon");

  if (parametersList.style.display === "none") {
    parametersList.style.display = "block";
    toggleIcon.textContent = "▼";
  } else {
    parametersList.style.display = "none";
    toggleIcon.textContent = "▶";
  }
};

// 初始化标签页切换
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 移除所有活动状态
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      // 激活当前标签
      btn.classList.add("active");
      const tabId = btn.dataset.tab + "-tab";
      const tabPane = document.getElementById(tabId);
      if (tabPane) {
        tabPane.classList.add("active");
      }

      // 处理标签内容更新
      handleTabChange(btn);
    });
  });
}

let gcodeViewer = null;

// 添加 IndexedDB 相关方法
const dbName = 'GCodeViewerDB';
const storeName = 'gcodeData';

// 初始化数据库
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

// 缓存数据
async function cacheFileData(version, data) {
    try {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        await new Promise((resolve, reject) => {
            const request = store.put(data, `gcode_${version}`);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Failed to cache file data:', e);
    }
}

// 加载缓存的数据
async function loadCachedData() {
    try {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        
        const dataA = await new Promise((resolve) => {
            const request = store.get('gcode_A');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        const dataB = await new Promise((resolve) => {
            const request = store.get('gcode_B');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        if (dataA) {
            gcodeViewer.pathsA = dataA;
        }
        
        if (dataB) {
            gcodeViewer.pathsB = dataB;
        }
        
        if (dataA || dataB) {
            gcodeViewer.updatePaths(gcodeViewer.pathsA, gcodeViewer.pathsB);
        }
    } catch (e) {
        console.warn('Failed to load cached data:', e);
    }
}

// 清除缓存
async function clearCache(version) {
    try {
        const db = await initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        if (version) {
            await new Promise((resolve) => {
                const request = store.delete(`gcode_${version}`);
                request.onsuccess = () => resolve();
            });
        } else {
            await new Promise((resolve) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
            });
        }
    } catch (e) {
        console.warn('Failed to clear cache:', e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 初始化GCodeViewer
    const container = document.getElementById('headerScene');
    if (container) {
        gcodeViewer = new GCodeViewer(container);
    }
    
    // 监听G-code加载事件
    document.addEventListener('gcodeLoaded', async (e) => {
        const { version, data } = e.detail;
        if (!data) {
            console.error('No data received from parser');
            return;
        }

        // 缓存数据
        await cacheFileData(version, data);

        if (version === 'A') {
            gcodeViewer.pathsA = data;
        } else {
            gcodeViewer.pathsB = data;
        }

        try {
            gcodeViewer.updatePaths(gcodeViewer.pathsA, gcodeViewer.pathsB);
        } catch (error) {
            console.error('Error updating paths:', error);
        }
    });
    
    // 初始化各个模块
    initFileManager();
    initComparison(compareBtn);
    initTooltip();
    initTabs();

    // 添加错误处理和日志
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.error(
            "Error: " +
            msg +
            "\nURL: " +
            url +
            "\nLine: " +
            lineNo +
            "\nColumn: " +
            columnNo +
            "\nError object: " +
            JSON.stringify(error)
        );
        return false;
    };

    // 添加重置视图按钮事件
    const resetViewBtn = document.getElementById('resetViewBtn');
    if (resetViewBtn && gcodeViewer) {
        resetViewBtn.addEventListener('click', () => {
            gcodeViewer.resetView();
        });
    }

    // 添加重叠对比按钮事件
    const compareOverlayBtn = document.getElementById('compareOverlayBtn');
    if (compareOverlayBtn && gcodeViewer) {
        compareOverlayBtn.addEventListener('click', () => {
            const isOverlay = gcodeViewer.toggleOverlayMode();
            compareOverlayBtn.classList.toggle('active', isOverlay);
            // 更新按钮图标
            compareOverlayBtn.querySelector('span').textContent = isOverlay ? '⊖' : '⊕';
        });
    }

    // 加载缓存的数据
    await loadCachedData();
});

// 修改文件选择处理函数
function handleFileSelect(event, side) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 清除对应版本的缓存
    clearCache(side);
    
    // ... 其余文件处理代码 ...
}
