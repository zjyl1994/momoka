package common

type S3Task struct {
	ID         int64  `json:"id"`
	Action     int32  `json:"action"`
	LocalPath  string `json:"local_path"`
	RemotePath string `json:"remote_path"`
	Status     int32  `json:"status"`
	LockedAt   int64  `json:"locked_at"`
	CreateTime int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64  `gorm:"autoUpdateTime" json:"update_time"`
}
