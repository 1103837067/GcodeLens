# 使用官方 Go 镜像作为基础镜像
FROM golang:1.23.2-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 go.mod 和 go.sum 文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# 使用轻量级的 alpine 镜像作为运行环境
FROM alpine:latest

# 安装必要的 CA 证书
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# 从 builder 阶段复制编译好的二进制文件
COPY --from=builder /app/main .
# 复制静态文件和模板
COPY --from=builder /app/static ./static
COPY --from=builder /app/templates ./templates

# 暴露端口
EXPOSE 8100

# 运行应用
CMD ["./main"]