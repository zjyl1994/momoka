package common

type ImageFolder struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	ParentID   int64  `gorm:"default:0" json:"parent_id"`
	Public     bool   `json:"public"`
	CreateTime int64  `gorm:"autoCreateTime" json:"create_time"`
	UpdateTime int64  `gorm:"autoUpdateTime" json:"update_time"`
}

type FolderReq struct {
	Name     *string `json:"name"`
	Public   *bool   `json:"public"`
	ParentID *int64  `json:"parent_id"`
}
