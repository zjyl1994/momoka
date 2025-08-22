package common

type ImageFolder struct {
	ID         int64
	Name       string
	ParentID   int64 `gorm:"default:0"`
	Public     bool
	CreateTime int64 `gorm:"autoCreateTime"`
	UpdateTime int64 `gorm:"autoUpdateTime"`
}
