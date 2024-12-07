package config

import "os"

type Config struct {
	ServerPort string
	Timeout    int
	BasePort   string
}

func GetConfig() *Config {
	return &Config{
		ServerPort: getEnv("SERVER_PORT", ":8200"),
		Timeout:    3,
		BasePort:   getEnv("BASE_PORT", "8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
} 