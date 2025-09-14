package common

type Image struct {
	ID int64 `gorm:"primaryKey" json:"id"`

	Name        string `json:"name"`
	ExtName     string `json:"ext_name"`
	ContentType string `json:"content_type"`
	Hash        string `gorm:"uniqueIndex" json:"hash"`
	FileSize    int64  `json:"file_size"`
	Remark      string `gorm:"type:text" json:"remark"`

	CreateTime int64 `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64 `gorm:"autoUpdateTime" json:"update_time"`

	URL        string   `gorm:"-:all" json:"url,omitempty"`
	LocalPath  string   `gorm:"-:all" json:"local_path,omitempty"`
	RemotePath string   `gorm:"-:all" json:"remote_path,omitempty"`
	Tags       []string `gorm:"-:all" json:"tags,omitempty"`
}
