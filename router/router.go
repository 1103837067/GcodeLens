package router

import (
	"ok/controller"
	"ok/service"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	// 创建 gin 引擎
	r := gin.Default()

	// 加载模板
	r.LoadHTMLGlob("templates/*")

	// 设置静态文件路径
	r.Static("/static", "./static")

	// 创建服务实例
	gcodeService := service.NewGCodeService()

	// 创建控制器实例
	gcodeController := controller.NewGCodeController(gcodeService)


	// G-code相关路由
	r.GET("/", gcodeController.ShowGCodeCompare)
	r.POST("/gcode/compare", gcodeController.CompareFiles)

	return r
}
