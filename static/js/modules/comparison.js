import { selectedFiles, isReadyToCompare } from './fileManager.js';
import { updateGCodeTab } from './display/gcodeTab.js';
import { updateManifestTab } from './display/manifestTab.js';

// 使用 Symbol 创建私有变量
const _lastResult = Symbol('lastResult');

class ComparisonManager {
    constructor() {
        this[_lastResult] = null;
    }
    
    getLastResult() {
        return this[_lastResult];
    }
    
    setLastResult(result) {
        this[_lastResult] = result;
        window.lastComparisonResult = result; // 保持兼容性
    }
}

// 创建单例实例
const comparisonManager = new ComparisonManager();

// 设置加载状态
function setLoading(loading) {
    const compareBtn = document.getElementById('compareBtn');
    if (loading) {
        compareBtn.disabled = true;
        compareBtn.innerHTML = `
            <div class="loading-spinner"></div>
            <span>对比中...</span>
        `;
    } else {
        compareBtn.disabled = false;
        compareBtn.innerHTML = `
            <span class="compare-icon">⟷</span>
            开始对比
        `;
    }
}

// 启用重新对比功能
function enableRecompare() {
    const compareBtn = document.getElementById('compareBtn');
    compareBtn.innerHTML = '<span class="compare-icon">⟳</span>重新对比';
    compareBtn.classList.add('recompare');
}

// 更新仪表盘数据
function updateDashboard(result) {
    document.getElementById('fileNameA').textContent = result.file1_name;
    document.getElementById('fileNameB').textContent = result.file2_name;

    // 更新统计数据
    if (result.manifest_diff && result.manifest_diff.modules) {
        const diffCount = result.manifest_diff.modules.reduce((acc, module) => 
            acc + (module.different ? 1 : 0), 0);
        document.getElementById('paramDiffCount').textContent = diffCount;
    }
    
    if (result.gcode_diff) {
        const stats = result.gcode_diff.statistics;
        document.getElementById('pathDiffPercent').textContent = 
            `${((stats.changed_lines / stats.total_lines) * 100).toFixed(1)}%`;
        
        document.getElementById('areaDiff').textContent = 
            `${stats.changed_lines} / ${stats.total_lines}`;
    }
}

// 显示比较结果
function displayComparisonResults(result) {
    // 保存结果以供标签切换时使用
    comparisonManager.setLastResult(result);
    
    // 更新仪表盘数据
    updateDashboard(result);
    
    // 根据当前激活的标签页更新内容
    updateActiveTabContent(result);

    // 显示比较结果区域
    const comparisonResults = document.getElementById('comparisonResults');
    if (comparisonResults) {
        comparisonResults.style.display = 'block';
    }
}

// 更新当前激活标签页的内容
function updateActiveTabContent(result = comparisonManager.getLastResult()) {
    if (!result) return;
    
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabType = activeTab.dataset.tab;
        updateTabContent(tabType, result);
    }
}

// 更新特定标签页的内容
function updateTabContent(tabType, result) {
    switch (tabType) {
        case 'gcode':
            updateGCodeTab(result.gcode_diff);
            break;
        case 'manifest':
            updateManifestTab(result.manifest_diff);
            break;
    }
}

// 执行文件比较
async function compareFiles() {
    if (!isReadyToCompare()) {
        showToast('请选择所有需要的文件');
        return;
    }

    setLoading(true);
    const formData = new FormData();
    
    try {
        // 使用保存的文件对象
        formData.append('gcodeA', selectedFiles.A.gcode.file);
        formData.append('manifestA', selectedFiles.A.manifest.file);
        formData.append('gcodeB', selectedFiles.B.gcode.file);
        formData.append('manifestB', selectedFiles.B.manifest.file);

        const response = await fetch('/gcode/compare', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await response.text() || '比较失败');
        }

        const result = await response.json();
        displayComparisonResults(result);
        enableRecompare();
    } catch (error) {
        showToast('文件比较失败：' + error.message);
        console.error('Compare error:', error);
    } finally {
        setLoading(false);
    }
}

// 初始化比较功能
function initComparison(compareBtn) {
    if (!compareBtn) {
        console.error('找不到比较按钮');
        return;
    }

    // 比较按钮点击事件
    compareBtn.addEventListener('click', compareFiles);
}

// 标签切换处理
export function handleTabChange(tabBtn) {
    const result = comparisonManager.getLastResult();
    if (result) {
        const tabType = tabBtn.dataset.tab;
        updateTabContent(tabType, result);
    }
}

// 导出所有需要的函数和对象
export {
    displayComparisonResults,
    updateActiveTabContent,
    initComparison,
    comparisonManager
}; 