// 格式化长度
export function formatLength(length) {
    if (typeof length !== 'number' || isNaN(length)) {
        console.warn('Invalid length value:', length);
        return '0mm';
    }
    if (length >= 1000) {
        return `${(length/1000).toFixed(2)}m`;
    }
    return `${length.toFixed(2)}mm`;
}

// 格式化面积
export function formatArea(area) {
    if (area >= 1000000) {
        return `${(area/1000000).toFixed(2)}m²`;
    }
    return `${area.toFixed(2)}mm²`;
}

// 格式化速度
export function formatSpeed(speed) {
    return `${speed.toFixed(0)}mm/min`;
}

// 格式化时间
export function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}秒`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}分${remainingSeconds.toFixed(0)}秒`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}时${minutes}分${remainingSeconds.toFixed(0)}秒`;
    }
}

// 格式化变化率
export function formatChangeRate(rate) {
    if (rate > 0) {
        return `+${rate.toFixed(1)}%`;
    }
    return `${rate.toFixed(1)}%`;
}

// 获取变化率的样式类
export function getChangeClass(rate) {
    if (rate > 0) return 'increase';
    if (rate < 0) return 'decrease';
    return 'unchanged';
}

// HTML 转义函数
export function escapeHtml(str) {
    if (str === null || str === undefined) {
        return '';
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
        .replace(/ /g, '&nbsp;');
} 