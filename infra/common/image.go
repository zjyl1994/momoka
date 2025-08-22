package common

type Image struct {
	ID          int64
	Hash        string `gorm:"unique;not null"`
	ExtName     string
	ContentType string
	FileSize    int64
	FileName    string
	FolderID    int64 `gorm:"default:0"`
	CreateTime  int64 `gorm:"autoCreateTime"`
	UpdateTime  int64 `gorm:"autoUpdateTime"`
}
