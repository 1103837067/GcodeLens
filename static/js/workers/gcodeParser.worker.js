// 解析器配置
const SIMPLIFY_THRESHOLD = 0.1;

// 解析器类
class GCodeParser {
    constructor() {
        // 矢量图数据
        this.vectorGroups = [];
        this.currentGroup = [];
        
        // 位图数据
        this.rasterPoints = {
            x: [],
            y: [],
            colors: []
        };
        
        // 当前位置
        this.currentPosition = { x: 0, y: 0 };
    }

    parseCoordinates(line) {
        try {
            if (line.startsWith('G0')) {
                // 创建新的坐标组
                if (this.currentGroup.length > 0) {
                    this.vectorGroups.push([...this.currentGroup]);
                    this.currentGroup = [];
                }
                
                // 提取X和Y坐标
                const xMatch = line.match(/X([-\d.]+)/);
                const yMatch = line.match(/Y([-\d.]+)/);
                if (xMatch && yMatch) {
                    const x = parseFloat(xMatch[1]);
                    const y = parseFloat(yMatch[1]);
                    this.currentGroup.push({ x, y });
                }
            } else if (line.startsWith('G1')) {
                const xMatch = line.match(/X([-\d.]+)/);
                const yMatch = line.match(/Y([-\d.]+)/);
                if (xMatch && yMatch) {
                    const x = parseFloat(xMatch[1]);
                    const y = parseFloat(yMatch[1]);
                    this.currentGroup.push({ x, y });
                }
            }
        } catch (error) {
            console.warn('解析坐标失败:', line);
        }
    }

    parseRasterData(line) {
        try {
            // G1S0 表示功率为0，添加断点
            if (line.includes('G1S0')) {
                if (this.rasterPoints.x.length > 0) {
                    this.rasterPoints.x.push(null);
                    this.rasterPoints.y.push(null);
                    this.rasterPoints.colors.push(null);
                }
                return;
            }

            // 提取坐标和功率值
            const xMatch = line.match(/X([-\d.]+)/);
            const yMatch = line.match(/Y([-\d.]+)/);
            const sMatch = line.match(/S(\d+)/);

            // 更新当前位置
            if (xMatch) this.currentPosition.x = parseFloat(xMatch[1]);
            if (yMatch) this.currentPosition.y = parseFloat(yMatch[1]);

            // G25 命令处理
            if (line.startsWith('G25')) {
                this.rasterPoints.x.push(this.currentPosition.x);
                this.rasterPoints.y.push(this.currentPosition.y);
                this.rasterPoints.colors.push(sMatch ? parseInt(sMatch[1]) : 0);
            }
            // G0/G1 命令处理
            else if ((line.startsWith('G0') || line.startsWith('G1')) && (xMatch || yMatch)) {
                this.rasterPoints.x.push(this.currentPosition.x);
                this.rasterPoints.y.push(this.currentPosition.y);
                this.rasterPoints.colors.push(sMatch ? parseInt(sMatch[1]) : 0);
            }
        } catch (error) {
            console.warn('解析位图数据失败:', line);
        }
    }

    parseGCode(content) {
        const lines = content.split('\n');
        let lastCommand = '';
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
                // 解析矢量路径
                if (trimmedLine.startsWith('G0') || trimmedLine.startsWith('G1')) {
                    if (trimmedLine.includes('X') && trimmedLine.includes('Y') && !trimmedLine.includes(' ')) {
                        this.parseCoordinates(trimmedLine);
                        lastCommand = trimmedLine.substring(0, 2);
                    } else if (trimmedLine.includes('X') && !trimmedLine.includes('Y') || 
                             trimmedLine.includes('Y') && !trimmedLine.includes('X')) {
                        this.parseRasterData(trimmedLine);
                    }
                }

                // 解析位图数据
                if (trimmedLine.startsWith('G25') || 
                    trimmedLine.includes('G1S0') ||
                    (lastCommand && (trimmedLine.includes('X') || trimmedLine.includes('Y') || trimmedLine.includes('S')))) {
                    this.parseRasterData(trimmedLine);
                }
            } catch (error) {
                console.warn('解析行失败:', trimmedLine, error);
            }
        }

        // 添加最后一组矢量路径
        if (this.currentGroup.length > 0) {
            this.vectorGroups.push(this.currentGroup);
        }

        return {
            vectorPaths: this.vectorGroups,
            rasterData: this.rasterPoints
        };
    }
}

// 处理消息
self.onmessage = function(e) {
    const { content } = e.data;
    const parser = new GCodeParser();
    const result = parser.parseGCode(content);
    
    // 确保返回正确的数据结构
    self.postMessage({
        result: {
            vectorPaths: result.vectorPaths || [],
            rasterData: result.rasterData || {
                x: [],
                y: [],
                colors: []
            }
        },
        isLastBatch: true,
        progress: 100
    });
}; 