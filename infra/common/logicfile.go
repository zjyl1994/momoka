package common

type LogicFile struct {
	ID          int64  `json:"id"`
	Hash        string `gorm:"unique;not null" json:"hash"`
	ExtName     string `json:"ext_name"`
	ContentType string `json:"content_type"`
	FileSize    int64  `json:"file_size"`
	URL         string `gorm:"-:all" json:"url,omitempty"`
	LocalPath   string `gorm:"-:all" json:"local_path,omitempty"`
	RemotePath  string `gorm:"-:all" json:"remote_path,omitempty"`
	CreateTime  int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime  int64  `gorm:"autoUpdateTime" json:"update_time"`
}
