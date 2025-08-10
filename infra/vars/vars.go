package vars

import "gorm.io/gorm"

var (
	DebugMode  bool
	ListenAddr string
	DataPath   string
	Database   *gorm.DB
)
