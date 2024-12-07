// 主题相关函数
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeSelect').value = savedTheme;
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Toast提示
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            document.execCommand('copy');
        }
        
        document.body.removeChild(textarea);
        showToast('已复制：' + text);
    } catch (err) {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制');
    }
}

// 加载状态
function showLoading(show, containerId = 'loadingContainer', contentId = 'content') {
    document.getElementById(containerId).style.display = show ? 'flex' : 'none';
    document.getElementById(contentId).style.display = show ? 'none' : 'block';
}

// 时间更新
function updateTimeSince(initialSeconds) {
    const status = document.getElementById('status');
    let seconds = initialSeconds;
    
    if (window.updateTimer) {
        clearInterval(window.updateTimer);
    }
    
    window.updateTimer = setInterval(() => {
        seconds++;
        status.textContent = `${seconds}秒前的缓存数据`;
    }, 1000);
}

// 工具函数
const utils = {
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 初始化主题
    initTheme();
    
    // 主题切换监听
    document.getElementById('themeSelect')?.addEventListener('change', (e) => {
        setTheme(e.target.value);
    });
    
    // 更新导航菜单激活状态
    updateActiveNavItem();
});

// 系统主题变化监听
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (document.documentElement.getAttribute('data-theme') === 'system') {
        document.documentElement.setAttribute('data-theme', 'system');
    }
});

// 导出工具函数
window.utils = utils;

// 导出全局函数
window.showToast = showToast;
window.copyToClipboard = copyToClipboard;
window.showLoading = showLoading;
window.updateTimeSince = updateTimeSince;

// 更新导航激活状态
function updateActiveNavItem() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') === path) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}