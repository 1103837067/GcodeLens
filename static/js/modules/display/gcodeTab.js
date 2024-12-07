import { 
    formatLength, 
    formatArea, 
    formatSpeed, 
    formatTime, 
    formatChangeRate, 
    getChangeClass,
    escapeHtml 
} from '../utils/formatter.js';

// 使用模块级变量
let groupedChanges = null;

// 提供访问接口
export function getGroupedChanges() {
    return groupedChanges;
}

// 渲染变更内容
function renderChanges(changes) {
    return changes.map(line => {
        const oldContent = escapeHtml(line.old_content || '');
        const newContent = escapeHtml(line.content || '');
        
        return `
            <div class="diff-line ${line.type}">
                <span class="line-number">${line.line_num}</span>
                ${line.type === 'change' ? 
                    `<span class="line-content old" data-full-content="${oldContent}">${oldContent}</span>
                     <span class="line-content new" data-full-content="${newContent}">${newContent}</span>` :
                    line.type === 'add' ?
                    `<span class="line-content"></span>
                     <span class="line-content new" data-full-content="${newContent}">${newContent}</span>` :
                    `<span class="line-content old" data-full-content="${oldContent}">${oldContent}</span>
                     <span class="line-content"></span>`
                }
            </div>
        `;
    }).join('');
}

// 加载更多变更
function loadMoreChanges(type, page, groupedChanges) {
    const PAGE_SIZE = 100;
    const changes = groupedChanges[type];
    const diffGroup = document.querySelector(`.diff-group[data-type="${type}"]`);
    const content = document.getElementById(`${type}-changes`);
    
    if (!changes || !diffGroup || !content) return;

    const start = (page - 1) * PAGE_SIZE;
    const end = page * PAGE_SIZE;
    const pageChanges = changes.slice(start, end);
    
    // 添加新内容
    content.insertAdjacentHTML('beforeend', renderChanges(pageChanges));
    
    // 更新页码信息
    const totalPages = Math.ceil(changes.length / PAGE_SIZE);
    diffGroup.setAttribute('data-current-page', page);
    
    // 更新或移除加载更多按钮
    const footer = diffGroup.querySelector('.diff-group-footer');
    if (page < totalPages) {
        footer.innerHTML = `
            <button class="load-more" onclick="window.gcodeTab.loadMoreChanges('${type}', ${page + 1})">
                加载更多 (已显示${end}/${changes.length})
            </button>
        `;
    } else {
        footer.remove();
    }
}

// 更新G-code标签页
export function updateGCodeTab(gcodeDiff) {
    if (!gcodeDiff) return;
    
    const diffViewer = document.querySelector('#gcode-tab .diff-viewer');
    if (!diffViewer) return;

    // 按类型分组差异
    groupedChanges = {
        change: [],
        add: [],
        remove: []
    };

    // 对变化进行分组
    gcodeDiff.changes.forEach(change => {
        if (groupedChanges[change.type]) {
            groupedChanges[change.type].push(change);
        }
    });

    let html = `
        <div class="gcode-analysis">
            <div class="analysis-dashboard">
                <div class="analysis-section">
                    <h4>命令分析</h4>
                    <div class="command-stats">
                        <div class="stat-item">
                            <span class="stat-label">快速移动(G0)</span>
                            <div class="stat-values">
                                <span class="stat-value">${gcodeDiff.analysis_a.commands.g0_count} → ${gcodeDiff.analysis_b.commands.g0_count}</span>
                                <span class="change-rate ${getChangeClass(gcodeDiff.analysis.command_change)}">
                                    ${formatChangeRate(gcodeDiff.analysis.command_change)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">直线加工(G1)</span>
                            <div class="stat-values">
                                <span class="stat-value">${gcodeDiff.analysis_a.commands.g1_count} → ${gcodeDiff.analysis_b.commands.g1_count}</span>
                                <span class="change-rate ${getChangeClass((gcodeDiff.analysis_b.commands.g1_count - gcodeDiff.analysis_a.commands.g1_count) / gcodeDiff.analysis_a.commands.g1_count * 100)}">
                                    ${formatChangeRate((gcodeDiff.analysis_b.commands.g1_count - gcodeDiff.analysis_a.commands.g1_count) / gcodeDiff.analysis_a.commands.g1_count * 100)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">圆弧加工(G2/G3)</span>
                            <div class="stat-values">
                                <span class="stat-value">${gcodeDiff.analysis_a.commands.g2_count + gcodeDiff.analysis_a.commands.g3_count} → 
                                    ${gcodeDiff.analysis_b.commands.g2_count + gcodeDiff.analysis_b.commands.g3_count}</span>
                                <span class="change-rate ${getChangeClass(((gcodeDiff.analysis_b.commands.g2_count + gcodeDiff.analysis_b.commands.g3_count) - 
                                    (gcodeDiff.analysis_a.commands.g2_count + gcodeDiff.analysis_a.commands.g3_count)) / 
                                    Math.max(1, (gcodeDiff.analysis_a.commands.g2_count + gcodeDiff.analysis_a.commands.g3_count)) * 100)}">
                                    ${formatChangeRate(((gcodeDiff.analysis_b.commands.g2_count + gcodeDiff.analysis_b.commands.g3_count) - 
                                        (gcodeDiff.analysis_a.commands.g2_count + gcodeDiff.analysis_a.commands.g3_count)) / 
                                        Math.max(1, (gcodeDiff.analysis_a.commands.g2_count + gcodeDiff.analysis_a.commands.g3_count)) * 100)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-section">
                    <h4>路径分析</h4>
                    <div class="path-stats">
                        <div class="stat-item">
                            <span class="stat-label">总路径长度</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatLength(gcodeDiff.analysis_a.path.total_length)} → ${formatLength(gcodeDiff.analysis_b.path.total_length)}</span>
                                <span class="change-rate ${getChangeClass(gcodeDiff.analysis.path_length_change)}">
                                    ${formatChangeRate(gcodeDiff.analysis.path_length_change)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">加工长度</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatLength(gcodeDiff.analysis_a.path.working_length)} → ${formatLength(gcodeDiff.analysis_b.path.working_length)}</span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">快速移动</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatLength(gcodeDiff.analysis_a.path.rapid_length)} → ${formatLength(gcodeDiff.analysis_b.path.rapid_length)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-section">
                    <h4>加工区域</h4>
                    <div class="area-stats">
                        <div class="stat-item">
                            <span class="stat-label">区域大小</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatArea(gcodeDiff.analysis_a.path.area.size)} → ${formatArea(gcodeDiff.analysis_b.path.area.size)}</span>
                                <span class="change-rate ${getChangeClass(gcodeDiff.analysis.area_change)}">
                                    ${formatChangeRate(gcodeDiff.analysis.area_change)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">宽度×高度</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatLength(gcodeDiff.analysis_a.path.area.width)} × ${formatLength(gcodeDiff.analysis_a.path.area.height)} → 
                                    ${formatLength(gcodeDiff.analysis_b.path.area.width)} × ${formatLength(gcodeDiff.analysis_b.path.area.height)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-section">
                    <h4>速度分析</h4>
                    <div class="speed-stats">
                        <div class="stat-item">
                            <span class="stat-label">平均速度</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatSpeed(gcodeDiff.analysis_a.speed.avg_speed)} → ${formatSpeed(gcodeDiff.analysis_b.speed.avg_speed)}</span>
                                <span class="change-rate ${getChangeClass(gcodeDiff.analysis.speed_change)}">
                                    ${formatChangeRate(gcodeDiff.analysis.speed_change)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">速度范围</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatSpeed(gcodeDiff.analysis_a.speed.min_speed)} ~ ${formatSpeed(gcodeDiff.analysis_a.speed.max_speed)} → 
                                    ${formatSpeed(gcodeDiff.analysis_b.speed.min_speed)} ~ ${formatSpeed(gcodeDiff.analysis_b.speed.max_speed)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="analysis-section">
                    <h4>时间分析</h4>
                    <div class="time-stats">
                        <div class="stat-item">
                            <span class="stat-label">总加工时间</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatTime(gcodeDiff.analysis_a.time.total_time)} → ${formatTime(gcodeDiff.analysis_b.time.total_time)}</span>
                                <span class="change-rate ${getChangeClass((gcodeDiff.analysis_b.time.total_time - gcodeDiff.analysis_a.time.total_time) / gcodeDiff.analysis_a.time.total_time * 100)}">
                                    ${formatChangeRate((gcodeDiff.analysis_b.time.total_time - gcodeDiff.analysis_a.time.total_time) / gcodeDiff.analysis_a.time.total_time * 100)}
                                </span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">实际加工时间</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatTime(gcodeDiff.analysis_a.time.working_time)} → ${formatTime(gcodeDiff.analysis_b.time.working_time)}</span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">快速移动时间</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatTime(gcodeDiff.analysis_a.time.rapid_time)} → ${formatTime(gcodeDiff.analysis_b.time.rapid_time)}</span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">加减速时间</span>
                            <div class="stat-values">
                                <span class="stat-value">${formatTime(gcodeDiff.analysis_a.time.accel_time)} → ${formatTime(gcodeDiff.analysis_b.time.accel_time)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="gcode-details">
                <h4>详细差异</h4>
                ${Object.entries(groupedChanges).map(([type, changes]) => {
                    if (changes.length === 0) return '';
                    
                    const typeLabels = {
                        change: '修改',
                        add: '新增',
                        remove: '删除'
                    };

                    // 只显示第一页
                    const PAGE_SIZE = 100;
                    const firstPageChanges = changes.slice(0, PAGE_SIZE);
                    const totalPages = Math.ceil(changes.length / PAGE_SIZE);

                    return `
                        <div class="diff-group" data-type="${type}" data-total-pages="${totalPages}" data-current-page="1">
                            <div class="diff-group-header">
                                <span>${typeLabels[type]}的内容</span>
                                <div class="diff-group-info">
                                    <span class="diff-type ${type}">${changes.length} 处</span>
                                    ${totalPages > 1 ? `<span class="page-info">1/${totalPages}页</span>` : ''}
                                </div>
                            </div>
                            <div class="diff-group-content" id="${type}-changes">
                                ${renderChanges(firstPageChanges)}
                            </div>
                            ${totalPages > 1 ? `
                                <div class="diff-group-footer">
                                    <button class="load-more" onclick="window.gcodeTab.loadMoreChanges('${type}', 2)">
                                        加载更多 (已显示${PAGE_SIZE}/${changes.length})
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    diffViewer.innerHTML = html;
}

// 修改加载更多的实现
window.gcodeTab = {
    loadMoreChanges: (type, page) => loadMoreChanges(type, page, groupedChanges)
};

// 导出模块接口
export {
    loadMoreChanges,
    renderChanges
}; 