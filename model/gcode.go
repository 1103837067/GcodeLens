package model

// CompareResult 总的比较结果
type CompareResult struct {
	File1Name    string        `json:"file1_name"`
	File2Name    string        `json:"file2_name"`
	GCodeDiff    *GCodeDiff    `json:"gcode_diff"`    // G-code差异
	ManifestDiff *ManifestDiff `json:"manifest_diff"` // Manifest差异
}

// GCodeDiff G-code文件差异
type GCodeDiff struct {
	Statistics  GCodeStatistics `json:"statistics"` // 统计信息
	LineChanges []GCodeChange   `json:"changes"`    // 具体的行变化
	AnalysisA   GCodeAnalysis   `json:"analysis_a"` // A文件分析
	AnalysisB   GCodeAnalysis   `json:"analysis_b"` // B文件分析
	Analysis    ChangeAnalysis  `json:"analysis"`   // 变化分析
}

// ChangeAnalysis 变化分析
type ChangeAnalysis struct {
	PathLengthChange float64 `json:"path_length_change"` // 路径长度变化率
	AreaChange       float64 `json:"area_change"`        // 加工区域变化率
	SpeedChange      float64 `json:"speed_change"`       // 速度变化率
	CommandChange    float64 `json:"command_change"`     // 命令结构变化率
}

// GCodeStatistics G-code统计信息
type GCodeStatistics struct {
	TotalLines   int `json:"total_lines"`   // 总行数
	ChangedLines int `json:"changed_lines"` // 变化的行数
	AddedLines   int `json:"added_lines"`   // 新增的行数
	RemovedLines int `json:"removed_lines"` // 删除的行数
}

// GCodeChange G-code变化
type GCodeChange struct {
	LineNum    int    `json:"line_num"`    // 行号
	Type       string `json:"type"`        // 变化类型 (add/remove/change)
	Content    string `json:"content"`     // 内容
	OldContent string `json:"old_content"` // 原内容(如果是修改)
}

// TimeAnalysis 时间分析
type TimeAnalysis struct {
	TotalTime   float64 `json:"total_time"`   // 总时间(秒)
	WorkingTime float64 `json:"working_time"` // 工作时间(秒)
	RapidTime   float64 `json:"rapid_time"`   // 快速移动时间(秒)
	AccelTime   float64 `json:"accel_time"`   // 加减速时间(秒)
}

// GCodeAnalysis G-code分析结果
type GCodeAnalysis struct {
	// 命令分析
	Commands struct {
		G0Count int `json:"g0_count"` // G0命令数量
		G1Count int `json:"g1_count"` // G1命令数量
		G2Count int `json:"g2_count"` // G2命令数量
		G3Count int `json:"g3_count"` // G3命令数量
	} `json:"commands"`

	// 路径分析
	Path struct {
		TotalLength   float64 `json:"total_length"`   // 总路径长度
		RapidLength   float64 `json:"rapid_length"`   // 快速移动长度
		WorkingLength float64 `json:"working_length"` // 加工移动长度
		Area          struct {
			Width  float64 `json:"width"`  // 加工区域宽度
			Height float64 `json:"height"` // 加工区域高度
			Size   float64 `json:"size"`   // 加工区域面积
		} `json:"area"`
	} `json:"path"`

	// 速度分析
	Speed struct {
		MaxSpeed float64 `json:"max_speed"` // 最大速度
		MinSpeed float64 `json:"min_speed"` // 最小速度
		AvgSpeed float64 `json:"avg_speed"` // 平均速度
	} `json:"speed"`

	// 变化分析
	Changes struct {
		PathLengthChange float64 `json:"path_length_change"` // 路径长度变化率
		AreaChange       float64 `json:"area_change"`        // 加工区域变化率
		SpeedChange      float64 `json:"speed_change"`       // 速度变化率
		CommandChange    float64 `json:"command_change"`     // 命令结构变化率
	} `json:"changes"`

	// 时间分析
	Time TimeAnalysis `json:"time"`
}

// ManifestDiff Manifest文件差异
type ManifestDiff struct {
	Modules []ModuleReport `json:"modules"` // 模块报告
}

// ModuleReport 模块报告
type ModuleReport struct {
	Name       string      `json:"name"`       // 模块名称
	Different  bool        `json:"different"`  // 是否有差异
	Parameters []Parameter `json:"parameters"` // 参数列表
}

// Parameter 参数
type Parameter struct {
	Name      string      `json:"name"`      // 参数名称
	Value1    interface{} `json:"value1"`    // 版本A的值
	Value2    interface{} `json:"value2"`    // 版本B的值
	Different bool        `json:"different"` // 是否有差异
}

// JSONDiff JSON差异结构
type JSONDiff struct {
	Path   string      `json:"path"`    // JSON路径
	ValueA interface{} `json:"value_a"` // A版本的值
	ValueB interface{} `json:"value_b"` // B版本的值
	Type   string      `json:"type"`    // 差异类型：changed/added/removed
}
