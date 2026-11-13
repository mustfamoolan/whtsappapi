package bootstrap

import (
	"fmt"
	"log"
	"os"

	"whatsapp-api/app/models"
	"whatsapp-api/config"
	"github.com/fatih/color"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitializeDatabase() *gorm.DB {
	var err error
	var dialector gorm.Dialector

	dbConfig := config.Global.Database

	switch dbConfig.Driver {
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			dbConfig.Username, dbConfig.Password, dbConfig.Host, dbConfig.Port, dbConfig.Database)
		dialector = mysql.Open(dsn)
	case "postgres":
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Shanghai",
			dbConfig.Host, dbConfig.Username, dbConfig.Password, dbConfig.Database, dbConfig.Port)
		dialector = postgres.Open(dsn)
	case "sqlite":
		dialector = sqlite.Open(dbConfig.Database + ".db")
	default:
		log.Fatalf("%s Unsupported database driver: %s", color.RedString("FATAL:"), dbConfig.Driver)
	}

	DB, err = gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		log.Fatalf("%s Failed to connect to database: %v", color.RedString("FATAL:"), err)
	}

	fmt.Printf("%s Database connected successfully (%s)\n", color.CyanString("⚙️"), dbConfig.Driver)

	if err := DB.AutoMigrate(&models.User{}, &models.Project{}, &models.MessageLog{}); err != nil {
		log.Fatalf("%s Failed to run database migrations: %v", color.RedString("FATAL:"), err)
	}
	seedDefaultAdmin()
	fmt.Printf("%s Database schema migrated successfully\n", color.CyanString("⚙️"))

	return DB
}

func seedDefaultAdmin() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		adminEmail := os.Getenv("ADMIN_EMAIL")
		if adminEmail == "" {
			adminEmail = "admin@whatsapp.local"
		}
		adminPass := os.Getenv("ADMIN_PASSWORD")
		if adminPass == "" {
			adminPass = "admin123"
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(adminPass), 12)
		if err == nil {
			admin := models.User{
				Name:     "Admin",
				Email:    adminEmail,
				Password: string(hash),
			}
			DB.Create(&admin)
			fmt.Printf("%s Default admin created (%s / %s)\n", color.GreenString("✓"), adminEmail, adminPass)
		}
	}
}
