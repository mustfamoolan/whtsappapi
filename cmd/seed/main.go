package main

import (
	"log"
	"whatsapp-api/bootstrap"
	"whatsapp-api/database/seeders"
)

func main() {
	// 1. Initialize Config
	bootstrap.InitializeConfig()

	// 2. Initialize Database
	db := bootstrap.InitializeDatabase()

	// 3. Run Seeders
	if err := seeders.Run(db); err != nil {
		log.Fatalf("Seeding failed: %v", err)
	}
}
