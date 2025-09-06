package common

type LogicFile struct {
	ID          int64  `json:"id"`
	Hash        string `gorm:"unique;not null" json:"hash"`
	ExtName     string `json:"ext_name"`
	ContentType string `json:"content_type"`
	FileSize    int64  `json:"file_size"`
	FileName    string `json:"file_name"`
	URL         string `gorm:"-:all" json:"url,omitempty"`
}
