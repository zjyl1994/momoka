package common

type BackupFormat struct {
	Version     int           `json:"version"`
	Images      []Image       `json:"images"`
	ImageFolder []ImageFolder `json:"folders"`
	Settings    []Setting     `json:"settings"`
}
