package common

type Image struct {
	ID          int64  `json:"id"`
	Hash        string `gorm:"unique;not null" json:"hash"`
	ExtName     string `json:"ext_name"`
	ContentType string `json:"content_type"`
	FileSize    int64  `json:"file_size"`
	FileName    string `json:"file_name"`
	FolderID    int64  `gorm:"default:0" json:"folder_id"`
	CreateTime  int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime  int64  `gorm:"autoUpdateTime" json:"update_time"`
	URL         string `gorm:"-:all" json:"url"`
}

type ImageReq struct {
	FileName *string `json:"file_name"`
	FolderID *int64  `json:"folder_id"`
}
