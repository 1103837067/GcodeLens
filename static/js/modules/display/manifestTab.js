import { escapeHtml } from '../utils/formatter.js';

// 使用状态管理类
class ManifestState {
    constructor() {
        this._showAllItems = true;
        this._searchKeyword = '';
        this._currentDiff = null;
    }

    get showAllItems() { return this._showAllItems; }
    get searchKeyword() { return this._searchKeyword; }

    setShowAllItems(value) {
        this._showAllItems = value;
        this.notifyUpdate();
    }

    setSearchKeyword(value) {
        this._searchKeyword = value.toLowerCase();
        this.notifyUpdate();
    }

    notifyUpdate() {
        // 触发更新显示
        if (this._currentDiff) {
            updateManifestDisplay(this._currentDiff);
        }
    }

    setCurrentDiff(diff) {
        this._currentDiff = diff;
    }
}

export const manifestState = new ManifestState();

// 更新 manifest 标签页
export function updateManifestTab(manifestDiff) {
    if (!manifestDiff || !manifestDiff.modules) {
        console.warn('No manifest diff data available');
        return;
    }
    
    manifestState.setCurrentDiff(manifestDiff);
    const modulesList = document.getElementById('modulesList');
    if (!modulesList) {
        console.error('Modules list element not found');
        return;
    }

    updateManifestDisplay(manifestDiff);

    // 初始化搜索和过滤功能
    initializeControls(manifestDiff);
}

// 更新 manifest 显示
function updateManifestDisplay(manifestDiff) {
    const modulesList = document.getElementById('modulesList');
    modulesList.innerHTML = '';

    manifestDiff.modules.forEach(module => {
        if (!module) return;

        // 创建模块区域
        const moduleSection = document.createElement('div');
        moduleSection.className = 'module-section';
        moduleSection.setAttribute('data-has-diff', module.different);

        // 创建模块头部
        const moduleHeader = document.createElement('div');
        moduleHeader.className = 'module-header';
        moduleHeader.innerHTML = `
            <h4 class="module-title">
                <span class="toggle-icon">▼</span>
                ${module.name || 'Unknown'}
                <span class="module-badge ${module.different ? 'different' : 'same'}">
                    ${module.different ? '差异' : '相同'}
                </span>
            </h4>
        `;

        // 创建参数列表
        const parametersList = document.createElement('div');
        parametersList.className = 'parameters-list';

        // 添加参数
        (module.parameters || []).forEach(param => {
            // 如果是仅显示差异模式且参数相同，则跳过
            if (!manifestState.showAllItems && !param.different) return;

            // 如果有搜索关键字且不匹配，则跳过
            if (manifestState.searchKeyword && !matchesSearch(param)) return;

            const paramItem = document.createElement('div');
            paramItem.className = `parameter-item ${param.different ? 'different' : ''}`;
            paramItem.setAttribute('data-param-name', (param.name || '').toLowerCase());

            const displayValue1 = formatValue(param.value1, true);
            const displayValue2 = formatValue(param.value2, true);
            const fullValue1 = formatValue(param.value1, false);
            const fullValue2 = formatValue(param.value2, false);

            paramItem.innerHTML = `
                <div class="param-name" data-full-content="${escapeHtml(param.name)}">
                    ${param.name}
                    ${param.different ? '<span class="diff-indicator">●</span>' : ''}
                </div>
                <div class="param-values">
                    <div class="value-item">
                        <span class="value-label">版本A:</span>
                        <span class="value-content ${param.different ? 'different' : ''}" 
                              data-full-content="${escapeHtml(fullValue1)}">${displayValue1}</span>
                    </div>
                    <div class="value-item">
                        <span class="value-label">版本B:</span>
                        <span class="value-content ${param.different ? 'different' : ''}" 
                              data-full-content="${escapeHtml(fullValue2)}">${displayValue2}</span>
                    </div>
                </div>
            `;

            parametersList.appendChild(paramItem);
        });

        // 组装模块
        moduleSection.appendChild(moduleHeader);
        moduleSection.appendChild(parametersList);
        modulesList.appendChild(moduleSection);
    });
}

// 初始化控制按钮和搜索框
function initializeControls(manifestDiff) {
    const toggleDiffBtn = document.getElementById('toggleDiffBtn');
    const manifestSearch = document.getElementById('manifestSearch');

    if (toggleDiffBtn) {
        toggleDiffBtn.textContent = manifestState.showAllItems ? '仅显示差异' : '显示全部';
        toggleDiffBtn.addEventListener('click', () => {
            manifestState.setShowAllItems(!manifestState.showAllItems);
            toggleDiffBtn.textContent = manifestState.showAllItems ? '仅显示差异' : '显示全部';
            updateManifestDisplay(manifestDiff);
        });
    }

    if (manifestSearch) {
        manifestSearch.value = manifestState.searchKeyword;
        manifestSearch.addEventListener('input', (e) => {
            manifestState.setSearchKeyword(e.target.value);
            updateManifestDisplay(manifestDiff);
        });
    }
}

// 检查参数是否匹配搜索关键字
function matchesSearch(param) {
    if (!manifestState.searchKeyword) return true;
    
    const searchStr = manifestState.searchKeyword.toLowerCase();
    return (param.name && param.name.toLowerCase().includes(searchStr)) ||
           (param.value1 && JSON.stringify(param.value1).toLowerCase().includes(searchStr)) ||
           (param.value2 && JSON.stringify(param.value2).toLowerCase().includes(searchStr));
}

// 格式化值显示
function formatValue(value, forDisplay = false) {
    if (value === null || value === undefined) {
        return '<span class="value-missing">未设置</span>';
    }
    if (typeof value === 'boolean') {
        return value ? '是' : '否';
    }
    if (Array.isArray(value)) {
        try {
            const formattedArray = value.map(item => {
                if (typeof item === 'object') {
                    return forDisplay ? 
                        JSON.stringify(item) : 
                        JSON.stringify(item, null, 2);
                }
                return String(item);
            });
            return forDisplay ? 
                `[${formattedArray.join(', ')}]` : 
                `[\n  ${formattedArray.join(',\n  ')}\n]`;
        } catch (e) {
            console.error('Array formatting error:', e);
            return JSON.stringify(value);
        }
    }
    if (typeof value === 'object') {
        try {
            return forDisplay ? 
                JSON.stringify(value) : 
                JSON.stringify(value, null, 2);
        } catch (e) {
            console.error('JSON stringify error:', e);
            return String(value);
        }
    }
    return String(value);
}

// 导出模块接口
export {
    updateManifestDisplay,
    matchesSearch,
    formatValue
}; 