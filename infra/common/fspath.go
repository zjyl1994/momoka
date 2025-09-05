package common

type FSPath struct {
	ID         int64  `json:"id"`
	ParentID   int64  `gorm:"default:0;uniqueIndex:idx_parent_name" json:"parent_id"`
	Name       string `gorm:"uniqueIndex:idx_parent_name" json:"name"`
	EntityType int32  `json:"entity_type"`
	CreateTime int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64  `gorm:"autoUpdateTime" json:"update_time"`
}

func (f *FSPath) TableName() string {
	return "fs_path"
}
