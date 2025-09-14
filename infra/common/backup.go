package common

type BackupFormat struct {
	Version   int         `json:"version"`
	Images    []Image     `json:"images"`
	ImageTags []ImageTags `json:"image_tags"`
	Settings  []Setting   `json:"settings"`
}
