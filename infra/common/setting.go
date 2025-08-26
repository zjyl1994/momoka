package common

type Setting struct {
	Name string `json:"name" gorm:"primaryKey"`
	Data string `json:"data"`
}
