package common

type VirtualFAT struct {
	ID       int64 `gorm:"primaryKey" json:"id"`
	ParentID int64 `gorm:"default:0;uniqueIndex:idx_parent_name_ext" json:"parent_id"`

	Name        string `gorm:"uniqueIndex:idx_parent_name_ext" json:"name"`
	ExtName     string `gorm:"uniqueIndex:idx_parent_name_ext" json:"ext_name"`
	ContentType string `json:"content_type"`
	Hash        string `json:"hash"`
	FileSize    int64  `json:"file_size"`
	IsFolder    bool   `json:"is_folder"`

	CreateTime int64 `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64 `gorm:"autoUpdateTime" json:"update_time"`

	URL        string `gorm:"-:all" json:"url,omitempty"`
	LocalPath  string `gorm:"-:all" json:"local_path,omitempty"`
	RemotePath string `gorm:"-:all" json:"remote_path,omitempty"`
}

func (f *VirtualFAT) TableName() string {
	return "vfat"
}
