package utils

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// GCodeCommand G代码命令结构
type GCodeCommand struct {
	Type     string  // G0/G1/G2/G3
	X, Y, Z  float64
	F        float64 // 速度
	Raw      string  // 原始命令
}

// ParseGCodeCommand 解析G代码命令
func ParseGCodeCommand(line string) *GCodeCommand {
	cmd := &GCodeCommand{Raw: line}
	
	// 解析命令类型
	if strings.HasPrefix(line, "G0") {
		cmd.Type = "G0"
	} else if strings.HasPrefix(line, "G1") {
		cmd.Type = "G1"
	} else if strings.HasPrefix(line, "G2") {
		cmd.Type = "G2"
	} else if strings.HasPrefix(line, "G3") {
		cmd.Type = "G3"
	}
	
	// 解析参数
	parts := strings.Fields(line)
	for _, part := range parts {
		if len(part) < 2 {
			continue
		}
		
		value := parseFloat(part[1:])
		switch part[0] {
		case 'X':
			cmd.X = value
		case 'Y':
			cmd.Y = value
		case 'Z':
			cmd.Z = value
		case 'F':
			cmd.F = value
		}
	}
	
	return cmd
}

// CalculatePathLength 计算路径长度
func CalculatePathLength(cmd *GCodeCommand, lastX, lastY float64) float64 {
	if cmd.Type == "G0" {
		return 0 // 不计算快速移动的长度
	}
	
	dx := cmd.X - lastX
	dy := cmd.Y - lastY
	return math.Sqrt(dx*dx + dy*dy)
}

// CalculateArcLength 计算圆弧长度
func CalculateArcLength(cmd *GCodeCommand, lastX, lastY float64) float64 {
	if cmd.Type != "G2" && cmd.Type != "G3" {
		return 0
	}
	
	// TODO: 实现圆弧长度计算
	return 0
}

// IsWorkingMove 判断是否是加工移动
func IsWorkingMove(cmd *GCodeCommand) bool {
	return cmd.Type == "G1" || cmd.Type == "G2" || cmd.Type == "G3"
}

// parseFloat 解析浮点数
func parseFloat(s string) float64 {
	value, _ := strconv.ParseFloat(s, 64)
	return value
}

// FormatLength 格式化长度显示
func FormatLength(length float64) string {
	if length >= 1000 {
		return fmt.Sprintf("%.2f m", length/1000)
	}
	return fmt.Sprintf("%.2f mm", length)
}

// FormatSpeed 格式化速度显示
func FormatSpeed(speed float64) string {
	return fmt.Sprintf("%.0f mm/min", speed)
}

// CalculateWorkArea 计算工作区域
type WorkArea struct {
	MinX, MinY float64
	MaxX, MaxY float64
	Width, Height float64
}

func CalculateWorkArea(commands []*GCodeCommand) WorkArea {
	area := WorkArea{
		MinX: math.MaxFloat64,
		MinY: math.MaxFloat64,
		MaxX: -math.MaxFloat64,
		MaxY: -math.MaxFloat64,
	}
	
	for _, cmd := range commands {
		if IsWorkingMove(cmd) {
			area.MinX = math.Min(area.MinX, cmd.X)
			area.MinY = math.Min(area.MinY, cmd.Y)
			area.MaxX = math.Max(area.MaxX, cmd.X)
			area.MaxY = math.Max(area.MaxY, cmd.Y)
		}
	}
	
	area.Width = area.MaxX - area.MinX
	area.Height = area.MaxY - area.MinY
	return area
}

// PathStatistics 路径统计
type PathStatistics struct {
	TotalLength    float64
	WorkingLength  float64
	RapidMoves     int
	WorkingMoves   int
	MaxSpeed       float64
	MinSpeed       float64
	AvgSpeed       float64
}

// CalculatePathStats 计算路径统计信息
func CalculatePathStats(commands []*GCodeCommand) PathStatistics {
	stats := PathStatistics{
		MinSpeed: math.MaxFloat64,
	}
	
	var lastX, lastY float64
	var totalSpeed float64
	var speedCount int
	
	for _, cmd := range commands {
		length := CalculatePathLength(cmd, lastX, lastY)
		
		if IsWorkingMove(cmd) {
			stats.WorkingMoves++
			stats.WorkingLength += length
			
			if cmd.F > 0 {
				stats.MaxSpeed = math.Max(stats.MaxSpeed, cmd.F)
				stats.MinSpeed = math.Min(stats.MinSpeed, cmd.F)
				totalSpeed += cmd.F
				speedCount++
			}
		} else if cmd.Type == "G0" {
			stats.RapidMoves++
		}
		
		stats.TotalLength += length
		lastX, lastY = cmd.X, cmd.Y
	}
	
	if speedCount > 0 {
		stats.AvgSpeed = totalSpeed / float64(speedCount)
	}
	
	return stats
} 