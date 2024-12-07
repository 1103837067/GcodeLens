package controller

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"ok/service"

	"github.com/gin-gonic/gin"
)

type GCodeController struct {
	gcodeService *service.GCodeService
}

func NewGCodeController(gcodeService *service.GCodeService) *GCodeController {
	return &GCodeController{
		gcodeService: gcodeService,
	}
}

// ShowGCodeCompare 显示G-code比较页面
func (c *GCodeController) ShowGCodeCompare(ctx *gin.Context) {
	ctx.HTML(http.StatusOK, "index.html", nil)
}

// CompareFiles 比较两个文件
func (c *GCodeController) CompareFiles(ctx *gin.Context) {
	// 获取版本A的文件
	gcodeA, err1 := ctx.FormFile("gcodeA")
	manifestA, err2 := ctx.FormFile("manifestA")
	// 获取版本B的文件
	gcodeB, err3 := ctx.FormFile("gcodeB")
	manifestB, err4 := ctx.FormFile("manifestB")

	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "请确保上传了所有需要的文件",
		})
		return
	}

	// 读取文件内容
	gcodeContentA, err1 := readFileContent(gcodeA)
	if err1 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("读取G-code文件A失败: %v", err1),
		})
		return
	}

	manifestContentA, err2 := readFileContent(manifestA)
	if err2 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("读取Manifest文件A失败: %v", err2),
		})
		return
	}

	gcodeContentB, err3 := readFileContent(gcodeB)
	if err3 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("读取G-code文件B失败: %v", err3),
		})
		return
	}

	manifestContentB, err4 := readFileContent(manifestB)
	if err4 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("读取Manifest文件B失败: %v", err4),
		})
		return
	}

	// 比较两个版本的文件
	result, err := c.gcodeService.CompareVersions(
		gcodeContentA, manifestContentA,
		gcodeContentB, manifestContentB,
	)

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("比较文件失败: %v", err),
		})
		return
	}

	// 设置文件名
	result.File1Name = fmt.Sprintf("%s / %s", gcodeA.Filename, manifestA.Filename)
	result.File2Name = fmt.Sprintf("%s / %s", gcodeB.Filename, manifestB.Filename)

	// 返回结果
	ctx.JSON(http.StatusOK, result)
}

// readFileContent 读取文件内容
func readFileContent(file *multipart.FileHeader) ([]byte, error) {
	f, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %v", err)
	}
	defer f.Close()

	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, f); err != nil {
		return nil, fmt.Errorf("读取文件内容失败: %v", err)
	}

	return buf.Bytes(), nil
} 