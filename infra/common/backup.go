package common

type BackupFormat struct {
	Version  int          `json:"version"`
	Fats     []VirtualFAT `json:"vfat"`
	Settings []Setting    `json:"settings"`
}
