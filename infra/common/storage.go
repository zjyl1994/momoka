package common

import "time"

type FileInfo struct {
	Name    string    `json:"name,omitempty"`
	Ext     string    `json:"ext,omitempty"`
	Path    string    `json:"path,omitempty"`
	Size    int64     `json:"size,omitempty"`
	ModTime time.Time `json:"mod_time,omitempty"`
}
