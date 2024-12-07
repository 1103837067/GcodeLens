package utils

import (
	"strings"
)

// GCodeAnalyzer G代码分析器
type GCodeAnalyzer struct {
	Commands []*GCodeCommand
	Stats    PathStatistics
	Area     WorkArea
}

// NewGCodeAnalyzer 创建新的分析器
func NewGCodeAnalyzer() *GCodeAnalyzer {
	return &GCodeAnalyzer{
		Commands: make([]*GCodeCommand, 0),
	}
}

// Parse 解析G代码文本
func (a *GCodeAnalyzer) Parse(text string) error {
	lines := strings.Split(text, "\n")
	var lastX, lastY float64
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, ";") {
			continue
		}
		
		if cmd := ParseGCodeCommand(line); cmd != nil {
			a.Commands = append(a.Commands, cmd)
			
			// 更新统计信息
			if IsWorkingMove(cmd) {
				a.Stats.WorkingMoves++
				length := CalculatePathLength(cmd, lastX, lastY)
				a.Stats.WorkingLength += length
				a.Stats.TotalLength += length
				
				if cmd.F > 0 {
					if cmd.F > a.Stats.MaxSpeed {
						a.Stats.MaxSpeed = cmd.F
					}
					if a.Stats.MinSpeed == 0 || cmd.F < a.Stats.MinSpeed {
						a.Stats.MinSpeed = cmd.F
					}
				}
			} else if cmd.Type == "G0" {
				a.Stats.RapidMoves++
			}
			
			lastX, lastY = cmd.X, cmd.Y
		}
	}
	
	// 计算工作区域
	a.Area = CalculateWorkArea(a.Commands)
	
	// 计算平均速度
	if a.Stats.WorkingMoves > 0 {
		a.Stats.AvgSpeed = (a.Stats.MaxSpeed + a.Stats.MinSpeed) / 2
	}
	
	return nil
}

// CompareWith 与另一个G代码比较
func (a *GCodeAnalyzer) CompareWith(other *GCodeAnalyzer) map[string]interface{} {
	result := make(map[string]interface{})
	
	// 计算差异百分比
	if a.Stats.TotalLength > 0 {
		result["length_diff_percent"] = (other.Stats.TotalLength - a.Stats.TotalLength) / a.Stats.TotalLength * 100
	} else {
		result["length_diff_percent"] = 0
	}
	
	// 计算区域变化
	result["area_diff"] = map[string]float64{
		"width":  other.Area.Width - a.Area.Width,
		"height": other.Area.Height - a.Area.Height,
	}
	
	// 计算速度变化
	result["speed_diff"] = map[string]float64{
		"max": other.Stats.MaxSpeed - a.Stats.MaxSpeed,
		"min": other.Stats.MinSpeed - a.Stats.MinSpeed,
		"avg": other.Stats.AvgSpeed - a.Stats.AvgSpeed,
	}
	
	return result
} 