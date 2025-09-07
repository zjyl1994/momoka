package common

type LogicPath struct {
	ID         int64  `gorm:"primaryKey" json:"id"`
	ParentID   int64  `gorm:"default:0;uniqueIndex:idx_parent_name" json:"parent_id"`
	Name       string `gorm:"uniqueIndex:idx_parent_name" json:"name"`
	EntityType int32  `json:"entity_type"`
	EntityID   int64  `json:"entity_id"`
	Remark     string `json:"remark"`
	CreateTime int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64  `gorm:"autoUpdateTime" json:"update_time"`
}

func (f *LogicPath) TableName() string {
	return "logic_path"
}
