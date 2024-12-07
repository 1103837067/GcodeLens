package utils

import (
	"strings"
)

// Edit 表示一个编辑操作
type Edit struct {
	Type string // "add", "remove", "change"
	A    int    // 在序列A中的位置
	B    int    // 在序列B中的位置
}

// computeEditScript 使用 Myers 差异算法计算编辑脚本
func computeEditScript(a, b []string) []Edit {
	n := len(a)
	m := len(b)
	max := n + m

	// v数组存储每个k对角线上最远能到达的x坐标
	v := make(map[int]int)
	v[1] = 0

	// 存储路径
	trace := make([]map[int]int, 0)

	// 计算最短编辑路径
	var x, y int
	for d := 0; d <= max; d++ {
		// 保存当前这一步的v数组
		vCopy := make(map[int]int)
		for k, v := range v {
			vCopy[k] = v
		}
		trace = append(trace, vCopy)

		for k := -d; k <= d; k += 2 {
			// 确定是向下还是向右移动
			if k == -d || (k != d && v[k-1] < v[k+1]) {
				x = v[k+1]
			} else {
				x = v[k-1] + 1
			}
			y = x - k

			// 沿对角线移动
			for x < n && y < m && a[x] == b[y] {
				x++
				y++
			}

			v[k] = x

			// 如果到达终点，回溯路径生成编辑脚本
			if x >= n && y >= m {
				return backtrack(trace, a, b, n, m)
			}
		}
	}

	return nil
}

// backtrack 回溯路径生成编辑脚本
func backtrack(trace []map[int]int, a, b []string, x, y int) []Edit {
	var edits []Edit
	d := len(trace) - 1
	k := x - y

	for d > 0 {
		v := trace[d]
		vPrev := trace[d-1]

		var kPrev int
		if k == -d || (k != d && v[k-1] < v[k+1]) {
			kPrev = k + 1
		} else {
			kPrev = k - 1
		}

		xEnd := v[k]
		xStart := vPrev[kPrev]
		yStart := xStart - kPrev
		yEnd := xEnd - k

		for x > xEnd {
			x--
			y--
			if x >= 0 && y >= 0 && a[x] == b[y] {
				continue
			}
			if x >= 0 && y >= 0 {
				edits = append([]Edit{{Type: "change", A: x, B: y}}, edits...)
			}
		}

		if d > 0 {
			if xStart-xEnd > 0 {
				// 删除操作
				for i := xEnd; i < xStart; i++ {
					edits = append([]Edit{{Type: "remove", A: i, B: yEnd}}, edits...)
				}
			} else if yEnd-yStart > 0 {
				// 添加操作
				for i := yStart; i < yEnd; i++ {
					edits = append([]Edit{{Type: "add", A: xEnd, B: i}}, edits...)
				}
			}
		}

		d--
		k = kPrev
	}

	return edits
}

// DiffResult 差异结果
type DiffResult struct {
	Type       string // add/remove/change
	LineNum    int
	Content    string
	OldContent string
}

// ComputeDiff 计算两个文本的差异
func ComputeDiff(textA, textB string) []DiffResult {
	linesA := strings.Split(textA, "\n")
	linesB := strings.Split(textB, "\n")
	
	var diffs []DiffResult
 
	// 使用简单的行比较算法，而不是 Myers 差异算法
	i, j := 0, 0
	for i < len(linesA) || j < len(linesB) {
		if i < len(linesA) && j < len(linesB) {
			if linesA[i] == linesB[j] {
				// 相同行
				i++
				j++
			} else {
				// 不同行，视为修改
				diffs = append(diffs, DiffResult{
					Type:      "change",
					LineNum:   j + 1,
					Content:   linesB[j],
					OldContent: linesA[i],
				})
				i++
				j++
			}
		} else if i < len(linesA) {
			// A中剩余的行视为删除
			diffs = append(diffs, DiffResult{
				Type:    "remove",
				LineNum: i + 1,
				Content: linesA[i],
			})
			i++
		} else if j < len(linesB) {
			// B中剩余的行视为添加
			diffs = append(diffs, DiffResult{
				Type:    "add",
				LineNum: j + 1,
				Content: linesB[j],
			})
			j++
		}
	}
	
	return diffs
} 