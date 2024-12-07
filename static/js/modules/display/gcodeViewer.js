import * as THREE from 'three';

export class GCodeViewer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        
        // 调整相机初始设置
        const aspect = container.clientWidth / container.clientHeight;
        const viewSize = 500; // 增加初始视图大小
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect, viewSize * aspect,
            viewSize, -viewSize,
            0.1, 1000
        );
        
        // 初始化渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);
        
        // 设置相机位置和朝向
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);
        
        // 初始化缩放级别
        this.camera.zoom = 1; // 设置为1:1缩放
        this.camera.updateProjectionMatrix();
        
        // 创建根容器以便翻转坐标系
        this.root = new THREE.Group();
        this.root.scale.y = -1; // 翻转Y轴
        this.scene.add(this.root);
        
        // 添加环境光和平行光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(ambientLight, directionalLight);
        
        // 添加分割线 (只添一次)
        this.addDivider();
        
        // 添加平移控制相关属性
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
        
        // 绑定事件
        this.bindEvents();
        
        // 存储路径数据
        this.pathsA = null;
        this.pathsB = null;
        
        // 动画帧
        this.animate();
        
        // 立即更新视图大小
        this.updateCameraAspect();
        
        // 添加布局相关属性
        this.layoutBounds = {
            left: { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } },
            right: { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } }
        };
        
        // 添加网格相关属性
        this.gridHelper = null;
        this.gridSizeLabel = this.createGridSizeLabel();
        
        // 添加网格
        this.updateGrid();
        
        // 添加重叠模式标志
        this.isOverlayMode = false;
        
        // 添加节流控制
        this.renderPending = false;
        
        // 使用 requestAnimationFrame 优化渲染
        this.scheduleRender();
        
        this.state = {
            isLoading: false,
            error: null,
            viewMode: 'normal' // 'normal' | 'overlay'
        };
        
        // 添加坐标显示标签
        this.coordinateLabel = this.createCoordinateLabel();
    }
    
    createGridSizeLabel() {
        const label = document.createElement('div');
        label.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            z-index: 1000;
        `;
        this.container.appendChild(label);
        return label;
    }
    
    updateGrid() {
        // 移除旧网格
        if (this.gridHelper) {
            this.root.remove(this.gridHelper);
        }
        
        // 根据当前缩放级别计算网格大小
        const zoom = this.camera.zoom;
        let gridSize = 1000; // 固定网格总大小为1m
        let divisions;
        let mainGridSize;
        
        // 根据缩放调整网格密度
        if (zoom < 0.5) {
            mainGridSize = 100;    // 10cm为一格
        } else if (zoom < 2) {
            mainGridSize = 50;     // 5cm为一格
        } else if (zoom < 5) {
            mainGridSize = 20;     // 2cm为一格
        } else if (zoom < 10) {
            mainGridSize = 10;     // 1cm为一格
        } else if (zoom < 20) {
            mainGridSize = 5;      // 5mm为一格
        } else if (zoom < 40) {
            mainGridSize = 2;      // 2mm为一格
        } else {
            mainGridSize = 1;      // 1mm为一格
        }
        
        divisions = Math.floor(gridSize / mainGridSize);
        
        // 创建主网格
        const mainGrid = new THREE.GridHelper(gridSize, divisions, 0x666666, 0x444444);
        mainGrid.rotation.x = Math.PI / 2;
        mainGrid.material.opacity = 0.2;
        mainGrid.material.transparent = true;
        
        // 创建次级网格（更细的网格线）
        const subDivisions = divisions * (mainGridSize <= 2 ? 2 : 5); // 对于小网格减少细分以避免过密
        const subGrid = new THREE.GridHelper(gridSize, subDivisions, 0x888888, 0x666666);
        subGrid.rotation.x = Math.PI / 2;
        subGrid.material.opacity = 0.1;
        subGrid.material.transparent = true;
        
        // 创建网格组
        this.gridHelper = new THREE.Group();
        this.gridHelper.add(mainGrid);
        this.gridHelper.add(subGrid);
        
        // 添加坐标轴
        const axesHelper = new THREE.AxesHelper(50);
        axesHelper.position.set(-gridSize/2, -gridSize/2, 0);
        this.gridHelper.add(axesHelper);
        
        this.root.add(this.gridHelper);
        
        // 更新网格大小标签
        let sizeText;
        if (mainGridSize >= 10) {
            sizeText = `${mainGridSize/10}cm`;
        } else {
            sizeText = `${mainGridSize}mm`;
        }
        this.gridSizeLabel.textContent = `网格: ${sizeText}/格`;
    }
    
    bindEvents() {
        // 修改缩放事件处理
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const zoom = this.camera.zoom;
            
            // 修改缩放范围和速度
            const zoomSpeed = 0.2;
            const minZoom = 0.1;
            const maxZoom = 100;
            
            // 计算新的缩放值
            let factor;
            if (zoom < 1) {
                factor = delta > 0 ? (1 - zoomSpeed * 0.5) : (1 + zoomSpeed * 0.5);
            } else if (zoom > 10) {
                factor = delta > 0 ? (1 - zoomSpeed * 1.5) : (1 + zoomSpeed * 1.5);
            } else {
                factor = delta > 0 ? (1 - zoomSpeed) : (1 + zoomSpeed);
            }
            
            const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
            
            if (newZoom !== zoom) {
                this.camera.zoom = newZoom;
                this.camera.updateProjectionMatrix();
                
                // 更新平移速度
                const moveSpeed = 1 / newZoom;
                this.moveSpeed = moveSpeed;
                
                // 更新网格
                this.updateGrid();
                
                // 强制重新渲染
                this.renderer.render(this.scene, this.camera);
            }
        });
        
        // 添加平控制
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
        });
        
        this.container.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaMove = {
                x: e.clientX - this.previousMousePosition.x,
                y: e.clientY - this.previousMousePosition.y
            };
            
            // 根据当前缩放级别调整移动速度
            const moveSpeed = 1 / this.camera.zoom;
            
            // 更新偏移 - 修改移动方向
            this.offset.x += deltaMove.x * moveSpeed;
            this.offset.y -= deltaMove.y * moveSpeed; // 改回减号以匹配直观的移动方向
            
            // 应用偏移到根容器
            this.root.position.x = this.offset.x;
            this.root.position.y = this.offset.y;
            
            this.previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            
            // 强制重新染
            this.renderer.render(this.scene, this.camera);
        });
        
        // 停拖动
        const stopDragging = () => {
            this.isDragging = false;
        };
        
        this.container.addEventListener('mouseup', stopDragging);
        this.container.addEventListener('mouseleave', stopDragging);
        
        // 添加窗口大小变化响应
        window.addEventListener('resize', () => {
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.updateCameraAspect();
        });
        
        // 添加双击缩放到适应视图大小
        this.container.addEventListener('dblclick', () => {
            this.fitToView();
        });
        
        // 添加键盘控制
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'r':
                case 'R':
                    this.resetView();
                    break;
                case 'f':
                case 'F':
                    this.fitToView();
                    break;
                // 可以添加更多快捷键
            }
        });
        
        // 添加鼠标悬停显示坐标
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / this.camera.zoom) - this.offset.x;
            const y = ((e.clientY - rect.top) / this.camera.zoom) - this.offset.y;
            
            // 新坐标显示
            this.updateCoordinateLabel(x, y);
        });
    }
    
    updateCameraAspect() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        const viewSize = 150;
        
        this.camera.left = -viewSize * aspect;
        this.camera.right = viewSize * aspect;
        this.camera.top = viewSize;
        this.camera.bottom = -viewSize;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    drawPaths(paths, color, side = 'left') {
        if (!Array.isArray(paths)) {
            console.warn('Invalid paths data:', paths);
            return null;
        }

        const material = new THREE.LineBasicMaterial({ 
            color,
            linewidth: 1,
            opacity: this.isOverlayMode ? 0.1 : 0.8,
            transparent: true
        });
        
        const group = new THREE.Group();
        
        // 计算路径的边界，用于居中定位
        const bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };
        
        // 先计算整体边界
        paths.forEach(path => {
            if (!Array.isArray(path) || path.length < 2) return;
            path.forEach(point => {
                if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
                bounds.min.x = Math.min(bounds.min.x, point.x);
                bounds.min.y = Math.min(bounds.min.y, point.y);
                bounds.max.x = Math.max(bounds.max.x, point.x);
                bounds.max.y = Math.max(bounds.max.y, point.y);
            });
        });

        // 绘制路径
        paths.forEach(path => {
            if (!Array.isArray(path) || path.length < 2) return;
            
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(path.length * 3);
            
            path.forEach((point, i) => {
                if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = 0;
            });
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const line = new THREE.Line(geometry, material);
            group.add(line);
        });

        return group;
    }
    
    drawRasterPaths(rasterData, color) {
        const { x, y, colors } = rasterData;
        if (!x || !y || !colors || x.length === 0) return null;

        // 用循环而不是展开运算符来计算范围
        let xMin = Infinity, xMax = -Infinity;
        let yMin = Infinity, yMax = -Infinity;
        
        for (let i = 0; i < x.length; i++) {
            if (x[i] !== null) {
                xMin = Math.min(xMin, x[i]);
                xMax = Math.max(xMax, x[i]);
            }
            if (y[i] !== null) {
                yMin = Math.min(yMin, y[i]);
                yMax = Math.max(yMax, y[i]);
            }
        }

        const group = new THREE.Group();
        let currentLine = [];

        // 遍历所有点绘制线段
        for (let i = 0; i < x.length; i++) {
            if (x[i] === null || y[i] === null || i === x.length - 1) {
                if (currentLine.length >= 2) {
                    const geometry = new THREE.BufferGeometry();
                    const positions = new Float32Array(currentLine.length * 3);
                    const opacities = new Float32Array(currentLine.length);

                    currentLine.forEach((point, index) => {
                        positions[index * 3] = point.x;
                        positions[index * 3 + 1] = point.y;
                        positions[index * 3 + 2] = 0;
                        opacities[index] = Math.max(0.1, Math.min(0.8, point.color / 800));
                    });

                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.setAttribute('alpha', new THREE.BufferAttribute(opacities, 1));

                    const material = new THREE.ShaderMaterial({
                        vertexShader: `
                            attribute float alpha;
                            varying float vAlpha;
                            void main() {
                                vAlpha = alpha;
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform vec3 color;
                            varying float vAlpha;
                            void main() {
                                gl_FragColor = vec4(color, vAlpha);
                            }
                        `,
                        uniforms: {
                            color: { value: new THREE.Color(color) }
                        },
                        transparent: true,
                        blending: THREE.NormalBlending,
                        depthWrite: false
                    });

                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                }
                currentLine = [];
            } else {
                currentLine.push({
                    x: x[i],
                    y: y[i],
                    color: colors[i] || 0
                });
            }
        }

        return group;
    }
    
    addDivider() {
        // 创建分割线材质
        const material = new THREE.LineBasicMaterial({
            color: 0x0000ff, // 使用色
            opacity: 0.5,    // 增加不透明度
            transparent: true,
            linewidth: 2     // 增加线宽
        });
        
        // 建无限长的分割线
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
            0, -10000, 0,  // 增加长度
            0, 10000, 0
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const divider = new THREE.Line(geometry, material);
        this.root.add(divider);
    }
    
    // 计算路径边界
    calculateBounds(paths) {
        const bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };
        
        // 处理量路径
        if (paths.vectorPaths) {
            paths.vectorPaths.forEach(path => {
                if (!Array.isArray(path)) return;
                path.forEach(point => {
                    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
                    bounds.min.x = Math.min(bounds.min.x, point.x);
                    bounds.min.y = Math.min(bounds.min.y, point.y);
                    bounds.max.x = Math.max(bounds.max.x, point.x);
                    bounds.max.y = Math.max(bounds.max.y, point.y);
                });
            });
        }
        
        // 处理位图路径
        if (paths.rasterData && paths.rasterData.x) {
            const { x, y } = paths.rasterData;
            for (let i = 0; i < x.length; i++) {
                if (x[i] === null || y[i] === null) continue;
                bounds.min.x = Math.min(bounds.min.x, x[i]);
                bounds.min.y = Math.min(bounds.min.y, y[i]);
                bounds.max.x = Math.max(bounds.max.x, x[i]);
                bounds.max.y = Math.max(bounds.max.y, y[i]);
            }
        }
        
        // 确保边界有效
        if (bounds.min.x === Infinity) {
            return null;
        }
        
        return {
            width: bounds.max.x - bounds.min.x,
            height: bounds.max.y - bounds.min.y,
            center: {
                x: (bounds.max.x + bounds.min.x) / 2,
                y: (bounds.max.y + bounds.min.y) / 2
            },
            min: bounds.min,
            max: bounds.max
        };
    }
    
    // 计算最佳缩放和位置
    calculateOptimalLayout(boundsA, boundsB) {
        // 直接返回 1:1 的缩放比例
        return { scale: 1 };
    }
    
    updatePaths(pathsA, pathsB) {
        // 清除所有现有内容
        this.root.children.length = 0;
        
        // 重新添加分割线（如不是重叠模式）
        if (!this.isOverlayMode) {
            this.addDivider();
        }
        
        if (!pathsA && !pathsB) return;
        
        // 添加边界框函数定义
        const addBoundingBox = (bounds, color, isLeft) => {
            if (!bounds) return;
            
            const boxGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                bounds.min.x, bounds.min.y, 0,
                bounds.max.x, bounds.min.y, 0,
                bounds.max.x, bounds.max.y, 0,
                bounds.min.x, bounds.max.y, 0,
                bounds.min.x, bounds.min.y, 0,
            ]);
            boxGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // 修改边界框材质
            const boxMaterial = new THREE.LineDashedMaterial({
                color: color,
                opacity: 0.1,           // 修改为 0.1
                transparent: true,
                dashSize: 5,            // 虚线段长度
                gapSize: 3,             // 虚线间隔
                linewidth: 1,           // 线宽
            });
            
            const box = new THREE.Line(boxGeometry, boxMaterial);
            box.computeLineDistances(); // 计算虚线
            
            // 调整位置其对齐中轴线
            if (isLeft) {
                box.position.x = -bounds.max.x - 5;
            } else {
                box.position.x = -bounds.min.x + 5;
            }
            box.position.y = -(bounds.max.y + bounds.min.y) / 2;
            
            return box;
        };
        
        // 计算边界
        const boundsA = pathsA ? this.calculateBounds(pathsA) : null;
        const boundsB = pathsB ? this.calculateBounds(pathsB) : null;
        
        // 计算最佳布局
        const layout = this.calculateOptimalLayout(boundsA, boundsB);
        
        // 计算整中心点（用于重叠模式）
        const calculateCenterOffset = (boundsA, boundsB) => {
            if (!boundsA && !boundsB) return { x: 0, y: 0 };
            
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            if (boundsA) {
                minX = Math.min(minX, boundsA.min.x);
                maxX = Math.max(maxX, boundsA.max.x);
                minY = Math.min(minY, boundsA.min.y);
                maxY = Math.max(maxY, boundsA.max.y);
            }
            
            if (boundsB) {
                minX = Math.min(minX, boundsB.min.x);
                maxX = Math.max(maxX, boundsB.max.x);
                minY = Math.min(minY, boundsB.min.y);
                maxY = Math.max(maxY, boundsB.max.y);
            }
            
            return {
                x: -(maxX + minX) / 2,
                y: -(maxY + minY) / 2
            };
        };

        const centerOffset = calculateCenterOffset(boundsA, boundsB);

        if (pathsA) {
            const groupA = new THREE.Group();
            
            // 绘制矢量路径
            const vectorGroupA = this.drawPaths(pathsA.vectorPaths, 0x0000ff);
            if (vectorGroupA) {
                vectorGroupA.material = new THREE.LineBasicMaterial({
                    color: 0x0000ff,
                    opacity: this.isOverlayMode ? 0.1 : 0.8,
                    transparent: true
                });
                groupA.add(vectorGroupA);
            }
            
            // 绘制位图路径
            const rasterGroupA = this.drawRasterPaths(pathsA.rasterData, 0x000080);
            if (rasterGroupA) {
                groupA.add(rasterGroupA);
            }
            
            // 调整 A 组的位置
            if (boundsA) {
                if (this.isOverlayMode) {
                    groupA.position.x = centerOffset.x;
                    groupA.position.y = centerOffset.y;
                } else {
                    groupA.position.x = -boundsA.max.x - 5;
                    groupA.position.y = -(boundsA.max.y + boundsA.min.y) / 2;
                }
            }
            
            groupA.scale.set(layout.scale, layout.scale, 1);
            this.root.add(groupA);

            // 添加边界框（仅在非重叠模式下显示）
            if (!this.isOverlayMode) {
                const boxA = addBoundingBox(boundsA, 0x0000ff, true);
                if (boxA) {
                    this.root.add(boxA);
                }
            }
        }

        if (pathsB) {
            const groupB = new THREE.Group();
            
            // 绘制矢量路径
            const vectorGroupB = this.drawPaths(pathsB.vectorPaths, 0xff0000);
            if (vectorGroupB) {
                vectorGroupB.material = new THREE.LineBasicMaterial({
                    color: 0xff0000,
                    opacity: this.isOverlayMode ? 0.1 : 0.8,
                    transparent: true
                });
                groupB.add(vectorGroupB);
            }
            
            // 绘制位图路径
            const rasterGroupB = this.drawRasterPaths(pathsB.rasterData, 0x800000);
            if (rasterGroupB) {
                groupB.add(rasterGroupB);
            }
            
            // 调整 B 组的位置
            if (boundsB) {
                if (this.isOverlayMode) {
                    groupB.position.x = centerOffset.x;
                    groupB.position.y = centerOffset.y;
                } else {
                    groupB.position.x = -boundsB.min.x + 5;
                    groupB.position.y = -(boundsB.max.y + boundsB.min.y) / 2;
                }
            }
            
            groupB.scale.set(layout.scale, layout.scale, 1);
            this.root.add(groupB);

            // 添加边界框（仅在非重叠模式下显示）
            if (!this.isOverlayMode) {
                const boxB = addBoundingBox(boundsB, 0xff0000, false);
                if (boxB) {
                    this.root.add(boxB);
                }
            }
        }

        // 重置视图
        this.resetView();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
    
    // 重置图
    resetView() {
        this.offset = { x: 0, y: 0 };
        this.root.position.x = 0;
        this.root.position.y = 0;
        this.camera.zoom = 1; // 重置为1:1缩放
        this.camera.updateProjectionMatrix();
        
        // 更新网格
        this.updateGrid();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // 添加重叠对比方法
    toggleOverlayMode() {
        this.isOverlayMode = !this.isOverlayMode;
        
        // 清除所有现有内容
        this.root.children.length = 0;
        
        // 重叠模式下不显示分割线
        if (!this.isOverlayMode) {
            this.addDivider();
        }
        
        // 重新绘制路径
        if (this.pathsA || this.pathsB) {
            this.updatePaths(this.pathsA, this.pathsB);
        }
        
        // 更新材质透明度
        this.root.traverse(child => {
            if (child.material) {
                if (this.isOverlayMode) {
                    child.material.opacity = 0.1;
                } else {
                    child.material.opacity = 0.8;
                }
            }
        });
        
        // 重置视图
        this.resetView();
        
        return this.isOverlayMode;
    }
    
    // 添加一个清除方法
    clearScene() {
        // 清除所有内容
        this.root.children.length = 0;
        
        // 重新添加分割线（如果不是重叠模式）
        if (!this.isOverlayMode) {
            this.addDivider();
        }
        
        // 重置存储的路径数据
        this.pathsA = null;
        this.pathsB = null;
        
        // 强制重新渲
        this.renderer.render(this.scene, this.camera);
    }
    
    // 添加适应视图方法
    fitToView() {
        if (!this.pathsA && !this.pathsB) return;
        
        // 计算所有内容的边界
        const bounds = this.calculateTotalBounds();
        if (!bounds) return;
        
        // 计算合适的缩放比例
        const padding = 50; // 边距
        const viewWidth = this.container.clientWidth - padding * 2;
        const viewHeight = this.container.clientHeight - padding * 2;
        
        const scaleX = viewWidth / bounds.width;
        const scaleY = viewHeight / bounds.height;
        const scale = Math.min(scaleX, scaleY);
        
        // 应用缩放和位置
        this.camera.zoom = scale;
        this.camera.updateProjectionMatrix();
        
        // 居中内容
        this.offset.x = -bounds.center.x;
        this.offset.y = -bounds.center.y;
        this.root.position.x = this.offset.x;
        this.root.position.y = this.offset.y;
        
        this.updateGrid();
        this.renderer.render(this.scene, this.camera);
    }
    
    scheduleRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.renderer.render(this.scene, this.camera);
                this.renderPending = false;
            });
        }
    }
    
    // 添加坐标显示标签
    createCoordinateLabel() {
        const label = document.createElement('div');
        label.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        this.container.appendChild(label);
        return label;
    }
    
    // 添加更新坐标标签的方法
    updateCoordinateLabel(x, y) {
        if (!this.coordinateLabel) return;
        
        // 格式化坐标，保留2位小数
        const formattedX = x.toFixed(2);
        const formattedY = y.toFixed(2);
        
        // 更新标签内容
        this.coordinateLabel.textContent = `X: ${formattedX}mm  Y: ${formattedY}mm`;
        
        // 当鼠标移动时显示标签
        this.coordinateLabel.style.opacity = '1';
        
        // 清除之前的定时器
        if (this.labelTimeout) {
            clearTimeout(this.labelTimeout);
        }
        
        // 2秒后隐藏签
        this.labelTimeout = setTimeout(() => {
            this.coordinateLabel.style.opacity = '0';
        }, 2000);
    }
    
    // 添加错误处理
    handleError(error) {
        console.error('GCodeViewer Error:', error);
        this.state.error = error;
        // 可以添加错误提示UI
    }
} 