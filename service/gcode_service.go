package service

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"ok/model"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type GCodeService struct{}

// GCommand G代码命令结构
type GCommand struct {
	Type    string // G0/G1/G2/G3
	X, Y, Z float64
	F       float64 // 速度
	Raw     string  // 原始命令
}

// MachineParams 机器参数结构体
type MachineParams struct {
	RapidSpeed   float64 // G0快速移动速度 (mm/min)
	WorkingSpeed float64 // G1工作速度 (mm/min)
	RapidAccel   float64 // G0加速度 (mm/s²)
	WorkingAccel float64 // G1加速度 (mm/s²)
}

func NewGCodeService() *GCodeService {
	return &GCodeService{}
}

// CompareVersions 比较两个版本的文件
func (s *GCodeService) CompareVersions(
	gcodeA, manifestA,
	gcodeB, manifestB []byte,
) (*model.CompareResult, error) {
	// 从manifest中解析机器参数
	paramsA, err := s.extractMachineParams(manifestA)
	if err != nil {
		return nil, fmt.Errorf("解析manifest A参数失败: %v", err)
	}

	paramsB, err := s.extractMachineParams(manifestB)
	if err != nil {
		return nil, fmt.Errorf("解析manifest B参数失败: %v", err)
	}

	result := &model.CompareResult{}

	// 比较G-code文件
	gcodeDiff, err := s.compareGCode(gcodeA, gcodeB, paramsA, paramsB)
	if err != nil {
		return nil, fmt.Errorf("比较G-code文件失败: %v", err)
	}
	result.GCodeDiff = gcodeDiff

	// 比较Manifest文件
	manifestDiff, err := s.compareManifest(manifestA, manifestB)
	if err != nil {
		return nil, fmt.Errorf("比较Manifest文件失败: %v", err)
	}
	result.ManifestDiff = manifestDiff

	return result, nil
}

// compareGCode 比较G-code文件
func (s *GCodeService) compareGCode(contentA, contentB []byte, paramsA, paramsB *MachineParams) (*model.GCodeDiff, error) {
	// 创建差异结果
	diff := &model.GCodeDiff{
		Statistics:  model.GCodeStatistics{},
		LineChanges: make([]model.GCodeChange, 0),
	}

	// 分析两个文件
	analysisA := s.analyzeGCode(contentA, paramsA)
	analysisB := s.analyzeGCode(contentB, paramsB)

	// 设置两个文件的分析结果
	diff.AnalysisA = analysisA
	diff.AnalysisB = analysisB

	// 计算变化率
	diff.Analysis = model.ChangeAnalysis{
		PathLengthChange: s.calculateChangeRate(analysisA.Path.TotalLength, analysisB.Path.TotalLength),
		AreaChange:       s.calculateChangeRate(analysisA.Path.Area.Size, analysisB.Path.Area.Size),
		SpeedChange:      s.calculateChangeRate(analysisA.Speed.AvgSpeed, analysisB.Speed.AvgSpeed),
		CommandChange:    s.calculateCommandChange(analysisA.Commands, analysisB.Commands),
	}

	// 使用 bufio.Scanner 按行读取
	scannerA := bufio.NewScanner(bytes.NewReader(contentA))
	scannerB := bufio.NewScanner(bytes.NewReader(contentB))

	// 增加缓冲区大小，处理长行
	const maxScanTokenSize = 1024 * 1024 // 1MB
	bufA := make([]byte, maxScanTokenSize)
	bufB := make([]byte, maxScanTokenSize)
	scannerA.Buffer(bufA, maxScanTokenSize)
	scannerB.Buffer(bufB, maxScanTokenSize)

	// 计数器
	lineNum := 0
	totalLines := 0
	changedLines := 0
	addedLines := 0
	removedLines := 0

	// 先计算总行数
	for scannerB.Scan() {
		totalLines++
	}
	scannerB = bufio.NewScanner(bytes.NewReader(contentB))
	scannerB.Buffer(bufB, maxScanTokenSize)

	// 比较文件
	for scannerB.Scan() {
		lineNum++
		lineB := scannerB.Text()

		// 如果A还有行，读取并比较
		if scannerA.Scan() {
			lineA := scannerA.Text()
			if lineA != lineB {
				changedLines++
				// 只保存前1000个差异
				if len(diff.LineChanges) < 1000 {
					diff.LineChanges = append(diff.LineChanges, model.GCodeChange{
						LineNum:    lineNum,
						Type:       "change",
						Content:    lineB,
						OldContent: lineA,
					})
				}
			}
		} else {
			addedLines++
			if len(diff.LineChanges) < 1000 {
				diff.LineChanges = append(diff.LineChanges, model.GCodeChange{
					LineNum: lineNum,
					Type:    "add",
					Content: lineB,
				})
			}
		}
	}

	// 检查A是否还有剩余行
	for scannerA.Scan() {
		lineNum++
		removedLines++
		if len(diff.LineChanges) < 1000 {
			diff.LineChanges = append(diff.LineChanges, model.GCodeChange{
				LineNum: lineNum,
				Type:    "remove",
				Content: scannerA.Text(),
			})
		}
	}

	// 设置统计信息
	diff.Statistics.TotalLines = totalLines
	diff.Statistics.ChangedLines = changedLines
	diff.Statistics.AddedLines = addedLines
	diff.Statistics.RemovedLines = removedLines

	// 如果差异超过1000行，添加提示信息
	if changedLines+addedLines+removedLines > 1000 {
		diff.LineChanges = append(diff.LineChanges, model.GCodeChange{
			LineNum: -1,
			Type:    "info",
			Content: fmt.Sprintf("差异太多，只显示前1000处变化。总计: 新增%d行, 删除%d行, 修改%d行",
				addedLines, removedLines, changedLines),
		})
	}

	return diff, nil
}

// calculateChangeRate 计算变化率
func (s *GCodeService) calculateChangeRate(valueA, valueB float64) float64 {
	if valueA > 0 {
		return (valueB - valueA) / valueA * 100
	}
	return 0
}

// calculateCommandChange 计算命令变化率
func (s *GCodeService) calculateCommandChange(cmdsA, cmdsB struct {
	G0Count int `json:"g0_count"`
	G1Count int `json:"g1_count"`
	G2Count int `json:"g2_count"`
	G3Count int `json:"g3_count"`
}) float64 {
	totalA := float64(cmdsA.G0Count + cmdsA.G1Count + cmdsA.G2Count + cmdsA.G3Count)
	totalB := float64(cmdsB.G0Count + cmdsB.G1Count + cmdsB.G2Count + cmdsB.G3Count)

	if totalA > 0 {
		return (totalB - totalA) / totalA * 100
	}
	return 0
}

// parseGCommand 解析G代码命令
func (s *GCodeService) parseGCommand(line string) *GCommand {
	cmd := &GCommand{Raw: line}

	// 跳过注释和空行
	if strings.HasPrefix(line, ";") || strings.TrimSpace(line) == "" {
		return nil
	}

	// 解析命令类型
	if match := regexp.MustCompile(`G[0-3]`).FindString(line); match != "" {
		cmd.Type = match
	}

	// 使用正则表达式提取参数
	reX := regexp.MustCompile(`X(-?\d*\.?\d+)`)
	reY := regexp.MustCompile(`Y(-?\d*\.?\d+)`)
	reZ := regexp.MustCompile(`Z(-?\d*\.?\d+)`)
	reF := regexp.MustCompile(`F(-?\d*\.?\d+)`)

	// 提取坐标和速度
	if matches := reX.FindStringSubmatch(line); len(matches) > 1 {
		cmd.X, _ = strconv.ParseFloat(matches[1], 64)
	}
	if matches := reY.FindStringSubmatch(line); len(matches) > 1 {
		cmd.Y, _ = strconv.ParseFloat(matches[1], 64)
	}
	if matches := reZ.FindStringSubmatch(line); len(matches) > 1 {
		cmd.Z, _ = strconv.ParseFloat(matches[1], 64)
	}
	if matches := reF.FindStringSubmatch(line); len(matches) > 1 {
		cmd.F, _ = strconv.ParseFloat(matches[1], 64)
	}

	return cmd
}

// parseFloat 解析浮点数
func (s *GCodeService) parseFloat(str string) float64 {
	value, _ := strconv.ParseFloat(str, 64)
	return value
}

// calculateLength 计算路径长度
func (s *GCodeService) calculateLength(cmd *GCommand, lastX, lastY float64) float64 {

	// 只有当当前点和目标点都有效时才计算长度
	if (cmd.X != 0 || cmd.Y != 0) && (lastX != 0 || lastY != 0) {
		dx := cmd.X - lastX
		dy := cmd.Y - lastY
		length := math.Sqrt(dx*dx + dy*dy)
		return length
	}

	fmt.Printf("坐标无效，返回长度0\n")
	return 0
}

// compareManifest 比较 Manifest 文件
func (s *GCodeService) compareManifest(contentA, contentB []byte) (*model.ManifestDiff, error) {
	var jsonA, jsonB map[string]interface{}

	// 解析 JSON
	if err := json.Unmarshal(contentA, &jsonA); err != nil {
		return nil, fmt.Errorf("解析 Manifest A 失败: %v", err)
	}
	if err := json.Unmarshal(contentB, &jsonB); err != nil {
		return nil, fmt.Errorf("解析 Manifest B 失败: %v", err)
	}

	// 创建模块报告
	modules := []model.ModuleReport{
		// 基本参数模块
		s.compareBasicParams(jsonA, jsonB),
		// 元素参数模块
		s.compareElements(jsonA, jsonB),
	}

	return &model.ManifestDiff{
		Modules: modules,
	}, nil
}

// compareBasicParams 比较基本参数
func (s *GCodeService) compareBasicParams(jsonA, jsonB map[string]interface{}) model.ModuleReport {
	params := []model.Parameter{}
	
	// 比较版本信息
	params = append(params, s.compareValue("version", jsonA["version"], jsonB["version"]))
	
	// 比较头部信息
	params = append(params, s.compareValue("head", jsonA["head"], jsonB["head"]))
	
	// 比较尾部信息
	params = append(params, s.compareValue("tail", jsonA["tail"], jsonB["tail"]))
	
	// 比较处理参数
	if paramsA, ok := jsonA["params"].(map[string]interface{}); ok {
		if paramsB, ok := jsonB["params"].(map[string]interface{}); ok {
			for key := range paramsA {
				params = append(params, s.compareValue("params."+key, paramsA[key], paramsB[key]))
			}
			// 检查B中独有的键
			for key := range paramsB {
				if _, exists := paramsA[key]; !exists {
					params = append(params, s.compareValue("params."+key, nil, paramsB[key]))
				}
			}
		}
	}

	return model.ModuleReport{
		Name:       "基本参数",
		Different:  s.hasAnyDifference(params),
		Parameters: params,
	}
}

// compareElements 比较元素参数
func (s *GCodeService) compareElements(jsonA, jsonB map[string]interface{}) model.ModuleReport {
	params := []model.Parameter{}
	
	elementsA, okA := jsonA["elements"].([]interface{})
	elementsB, okB := jsonB["elements"].([]interface{})
	
	if !okA || !okB {
		return model.ModuleReport{
			Name:       "加工元素",
			Different:  false,
			Parameters: params,
		}
	}

	// 比较元素数量
	params = append(params, model.Parameter{
		Name:      "元素数量",
		Value1:    len(elementsA),
		Value2:    len(elementsB),
		Different: len(elementsA) != len(elementsB),
	})

	// 比较每个元素的关键属性
	maxLen := len(elementsA)
	if len(elementsB) > maxLen {
		maxLen = len(elementsB)
	}

	for i := 0; i < maxLen; i++ {
		prefix := fmt.Sprintf("elements[%d].", i)
		var elemA, elemB map[string]interface{}
		
		if i < len(elementsA) {
			if m, ok := elementsA[i].(map[string]interface{}); ok {
				elemA = m
			}
		}
		if i < len(elementsB) {
			if m, ok := elementsB[i].(map[string]interface{}); ok {
				elemB = m
			}
		}

		// 比较关键属性
		keyProps := []string{
			"type", "processingType", "power", "speed", "head",
			"width", "height", "filename", "gk", "id",
			"planningMode", "processingLightSource", "repeat",
			"enableKerf", "kerfDistance", "enableBreakPoint",
			"processDirection", "overDist",
		}

		for _, prop := range keyProps {
			var valA, valB interface{}
			if elemA != nil {
				valA = elemA[prop]
			}
			if elemB != nil {
				valB = elemB[prop]
			}
			params = append(params, s.compareValue(prefix+prop, valA, valB))
		}
	}

	return model.ModuleReport{
		Name:       "加工元素",
		Different:  s.hasAnyDifference(params),
		Parameters: params,
	}
}

// compareValue 比较单个值并创建参数对象
func (s *GCodeService) compareValue(name string, value1, value2 interface{}) model.Parameter {
	return model.Parameter{
		Name:      name,
		Value1:    value1,
		Value2:    value2,
		Different: !reflect.DeepEqual(value1, value2),
	}
}

// hasAnyDifference 检查参数列表中是否有任何差异
func (s *GCodeService) hasAnyDifference(params []model.Parameter) bool {
	for _, param := range params {
		if param.Different {
			return true
		}
	}
	return false
}

// analyzeGCode 分析G-code文件
func (s *GCodeService) analyzeGCode(content []byte, params *MachineParams) model.GCodeAnalysis {
	analysis := model.GCodeAnalysis{}
	lines := bytes.Split(content, []byte("\n"))

	// 创建工作通道和结果通道
	const workerCount = 4
	workChan := make(chan [][]byte)
	resultChan := make(chan struct {
		commands struct {
			g0, g1, g2, g3 int
		}
		path struct {
			rapid, working, total  float64
			minX, maxX, minY, maxY float64
		}
		speeds []float64
	}, workerCount)

	// 启动工作协程
	var wg sync.WaitGroup
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result := struct {
				commands struct {
					g0, g1, g2, g3 int
				}
				path struct {
					rapid, working, total  float64
					minX, maxX, minY, maxY float64
				}
				speeds []float64
			}{
				path: struct {
					rapid, working, total  float64
					minX, maxX, minY, maxY float64
				}{
					minX: math.MaxFloat64,
					minY: math.MaxFloat64,
					maxX: -math.MaxFloat64,
					maxY: -math.MaxFloat64,
				},
				speeds: make([]float64, 0),
			}

			var lastX, lastY float64
			var hasLastPoint bool

			for chunk := range workChan {
				for _, line := range chunk {
					if cmd := s.parseGCommand(string(line)); cmd != nil && cmd.Type != "" {
						// 更新命令计数
						switch cmd.Type {
						case "G0":
							result.commands.g0++
						case "G1":
							result.commands.g1++
						case "G2":
							result.commands.g2++
						case "G3":
							result.commands.g3++
						}

						// 更新坐标范围和路径长度
						if cmd.X != 0 || cmd.Y != 0 {
							// 更新坐标范围
							result.path.minX = math.Min(result.path.minX, cmd.X)
							result.path.maxX = math.Max(result.path.maxX, cmd.X)
							result.path.minY = math.Min(result.path.minY, cmd.Y)
							result.path.maxY = math.Max(result.path.maxY, cmd.Y)

							// 计算路径长度
							if hasLastPoint {
								dx := cmd.X - lastX
								dy := cmd.Y - lastY
								length := math.Sqrt(dx*dx + dy*dy)

								if length > 0.001 { // 1微米的阈值
									if cmd.Type == "G0" {
										result.path.rapid += length
									} else {
										result.path.working += length
									}
									result.path.total += length
								}
							}
							lastX, lastY = cmd.X, cmd.Y
							hasLastPoint = true
						}

						// 收集速度数据
						if cmd.F > 0 {
							result.speeds = append(result.speeds, cmd.F)
						}
					}
				}
			}
			resultChan <- result
		}()
	}

	// 分发工作
	chunkSize := len(lines) / workerCount
	go func() {
		for i := 0; i < workerCount; i++ {
			start := i * chunkSize
			end := start + chunkSize
			if i == workerCount-1 {
				end = len(lines)
			}
			workChan <- lines[start:end]
		}
		close(workChan)
	}()

	// 等待所有完成
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// 合并结果
	var totalSpeed float64
	var speedCount int
	for result := range resultChan {
		// 合并命令计数
		analysis.Commands.G0Count += result.commands.g0
		analysis.Commands.G1Count += result.commands.g1
		analysis.Commands.G2Count += result.commands.g2
		analysis.Commands.G3Count += result.commands.g3

		// 合并路径数据
		analysis.Path.RapidLength += result.path.rapid
		analysis.Path.WorkingLength += result.path.working
		analysis.Path.TotalLength += result.path.total

		// 更新坐标范围
		analysis.Path.Area.Width = math.Max(analysis.Path.Area.Width, result.path.maxX-result.path.minX)
		analysis.Path.Area.Height = math.Max(analysis.Path.Area.Height, result.path.maxY-result.path.minY)

		// 更新速度统计
		for _, speed := range result.speeds {
			if analysis.Speed.MaxSpeed == 0 || speed > analysis.Speed.MaxSpeed {
				analysis.Speed.MaxSpeed = speed
			}
			if analysis.Speed.MinSpeed == 0 || speed < analysis.Speed.MinSpeed {
				analysis.Speed.MinSpeed = speed
			}
			totalSpeed += speed
			speedCount++
		}
	}

	// 计算最终结果
	if speedCount > 0 {
		analysis.Speed.AvgSpeed = totalSpeed / float64(speedCount)
	}

	analysis.Path.Area.Size = analysis.Path.Area.Width * analysis.Path.Area.Height

	// 确保参数有效
	if params == nil {
		params = &MachineParams{
			RapidSpeed:   6000, // 默认值 mm/min
			WorkingSpeed: 2880, // 默认值 mm/min
			RapidAccel:   2500, // 默认值 mm/s²
			WorkingAccel: 2500, // 默认值 mm/s²
		}
	}

	// 添加日志以确认时间计算被触发
	fmt.Printf("开始计算加工时间，路径总长: %.2fmm, 工作长度: %.2fmm, 快速移动长度: %.2fmm\n",
		analysis.Path.TotalLength, analysis.Path.WorkingLength, analysis.Path.RapidLength)

	// 计算加工时间
	s.calculateProcessingTime(&analysis, params)

	// 添加日志以确认计算结果
	fmt.Printf("加工时间计算完成 - 总时间: %.2fs, 工作时间: %.2fs, 快速移动时间: %.2fs, 加速时间: %.2fs\n",
		analysis.Time.TotalTime, analysis.Time.WorkingTime, analysis.Time.RapidTime, analysis.Time.AccelTime)

	return analysis
}

// calculateProcessingTime 计算加工时间
func (s *GCodeService) calculateProcessingTime(analysis *model.GCodeAnalysis, params *MachineParams) {
	const (
		MIN_SEGMENT_LENGTH = 0.5     // mm，最小线段长度
		MIN_SPEED          = 100.0   // mm/min，最小速度
		COMMAND_OVERHEAD   = 0.00001 // 秒，每条指令的基本处理时间
		CORNER_OVERHEAD    = 0.0001  // 秒，拐角处理时间
	)

	// 参数验证和默认值设置
	if params.RapidSpeed <= 0 || params.WorkingSpeed <= 0 ||
		params.RapidAccel <= 0 || params.WorkingAccel <= 0 {
		params = &MachineParams{
			RapidSpeed:   3000, // 修改为实际速度
			WorkingSpeed: 9000, // 修改为实际速度
			RapidAccel:   3000, // 修改为实际加速度
			WorkingAccel: 3000, // 修改为实际加速度
		}
	}

	// 速度单位转换 (mm/min -> mm/s)
	g0SpeedMmS := params.RapidSpeed / 60.0
	workingSpeedMmS := params.WorkingSpeed / 60.0
	minSpeedMmS := MIN_SPEED / 60.0

	// 重置时间统计
	analysis.Time = model.TimeAnalysis{}

	// 计算工作时间 (G1/G2/G3)
	if analysis.Path.WorkingLength > 0 {
		workingCommands := float64(analysis.Commands.G1Count + analysis.Commands.G2Count + analysis.Commands.G3Count)
		if workingCommands > 0 {
			avgSegmentLength := analysis.Path.WorkingLength / workingCommands

			// 计算实际工作速度
			var effectiveSpeed float64
			if avgSegmentLength < MIN_SEGMENT_LENGTH {
				// 短线段降速处理
				effectiveSpeed = workingSpeedMmS * 0.8 // 降低到80%速度
			} else {
				effectiveSpeed = workingSpeedMmS * 0.95 // 考虑实际效率
			}

			// 基础工作时间
			analysis.Time.WorkingTime = analysis.Path.WorkingLength / effectiveSpeed

			// 加减速时间补偿
			if effectiveSpeed > minSpeedMmS {
				// 每个命令的加减速时间
				accelTime := (effectiveSpeed - minSpeedMmS) / params.WorkingAccel
				// 考虑实际加减速比例
				analysis.Time.AccelTime = accelTime * workingCommands * 0.1 // 降低加减速时间比例
			}
		}
	}

	// 计算快速移动时间 (G0)
	if analysis.Path.RapidLength > 0 && analysis.Commands.G0Count > 0 {
		avgG0Length := analysis.Path.RapidLength / float64(analysis.Commands.G0Count)

		// 计算实际G0速度
		effectiveG0Speed := g0SpeedMmS * 0.9 // 考虑实际效率
		if avgG0Length < MIN_SEGMENT_LENGTH {
			effectiveG0Speed *= 0.8 // 短距离G0降速
		}

		// 基础G0时间
		analysis.Time.RapidTime = analysis.Path.RapidLength / effectiveG0Speed

		// G0加减速补偿
		if analysis.Commands.G0Count > 1 {
			g0AccelTime := effectiveG0Speed / params.RapidAccel
			analysis.Time.AccelTime += g0AccelTime * float64(analysis.Commands.G0Count) * 0.1
		}
	}

	// 计算指令处理开销
	commandCount := float64(analysis.Commands.G0Count + analysis.Commands.G1Count +
		analysis.Commands.G2Count + analysis.Commands.G3Count)

	// 基本指令处理开销
	processingOverhead := commandCount * COMMAND_OVERHEAD

	// 拐角处理开销
	cornerCount := float64(analysis.Commands.G0Count+analysis.Commands.G1Count) * 0.15
	cornerOverhead := cornerCount * CORNER_OVERHEAD

	// 计算总时间
	analysis.Time.TotalTime = analysis.Time.WorkingTime +
		analysis.Time.RapidTime +
		analysis.Time.AccelTime +
		processingOverhead +
		cornerOverhead
}

// extractMachineParams 从manifest提取参数
func (s *GCodeService) extractMachineParams(manifestContent []byte) (*MachineParams, error) {
	var manifest map[string]interface{}
	if err := json.Unmarshal(manifestContent, &manifest); err != nil {
		return nil, err
	}

	params := &MachineParams{
		RapidSpeed:   6000, // 默认值
		WorkingSpeed: 2880, // 默认值
		RapidAccel:   2500, // 默认值
		WorkingAccel: 2500, // 默认值
	}

	// 从manifest中提取参数
	if settings, ok := manifest["machine_settings"].(map[string]interface{}); ok {
		if speed, ok := settings["rapid_speed"].(float64); ok {
			params.RapidSpeed = speed
		}
		if speed, ok := settings["working_speed"].(float64); ok {
			params.WorkingSpeed = speed
		}
		if accel, ok := settings["rapid_accel"].(float64); ok {
			params.RapidAccel = accel
		}
		if accel, ok := settings["working_accel"].(float64); ok {
			params.WorkingAccel = accel
		}
	}

	return params, nil
}
