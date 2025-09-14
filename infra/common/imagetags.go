package common

type ImageTags struct {
	ImageID int64  `gorm:"primaryKey" json:"image_id"`
	TagName string `gorm:"primaryKey" json:"tag_name"`
}
