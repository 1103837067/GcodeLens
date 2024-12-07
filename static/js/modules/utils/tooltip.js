// 创建提示框元素
function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'hover-tooltip';
    document.body.appendChild(tooltip);
    return tooltip;
}

let tooltip = null;
let tooltipTimeout = null;

// 初始化提示框功能
export function initTooltip() {
    tooltip = createTooltip();

    // 添加悬停事件处理
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        const fullContent = target.getAttribute('data-full-content');
        
        if (fullContent) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => {
                // 使用 innerHTML 而不是 textContent，这样 HTML 转义后的换行和空格都能正确显示
                tooltip.innerHTML = fullContent;
                tooltip.classList.add('show');
                
                // 计算提示框位置
                const rect = target.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // 默认显示在元素下方
                let top = rect.bottom + 5;
                let left = rect.left;
                
                // 如果提示框超出底部，则显示在元素上方
                if (top + tooltipRect.height > window.innerHeight) {
                    top = rect.top - tooltipRect.height - 5;
                }
                
                // 如果提示框超出右侧，则向左偏移
                if (left + tooltipRect.width > window.innerWidth) {
                    left = window.innerWidth - tooltipRect.width - 5;
                }
                
                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;
            }, 200);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (target.hasAttribute('data-full-content')) {
            clearTimeout(tooltipTimeout);
            tooltip.classList.remove('show');
        }
    });

    // 添加窗口滚动和调整大小的处理
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('resize', hideTooltip);
}

// 隐藏提示框
function hideTooltip() {
    if (tooltip) {
        clearTimeout(tooltipTimeout);
        tooltip.classList.remove('show');
    }
}

// 显示提示框
export function showTooltip(element, content) {
    if (!tooltip || !element) return;

    tooltip.innerHTML = content;
    tooltip.classList.add('show');

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + 5;
    let left = rect.left;

    if (top + tooltipRect.height > window.innerHeight) {
        top = rect.top - tooltipRect.height - 5;
    }

    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 5;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

// 导出需要的函数
export {
    hideTooltip
};

export function cleanup() {
    if (tooltip) {
        document.body.removeChild(tooltip);
        tooltip = null;
    }
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    
    // 移除事件监听器
    window.removeEventListener('scroll', hideTooltip);
    window.removeEventListener('resize', hideTooltip);
}

// 在页面卸载时清理
window.addEventListener('unload', cleanup); 