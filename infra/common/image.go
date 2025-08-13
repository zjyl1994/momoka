package common

type Image struct {
	ID          int64
	Hash        string `gorm:"unique;not null"`
	ExtName     string
	ContentType string
	FileSize    int64
}
