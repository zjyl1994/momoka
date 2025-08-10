package utils

import (
	"path/filepath"

	"github.com/zjyl1994/momoka/infra/vars"
)

func COALESCE[T comparable](elem ...T) T {
	var empty T
	for _, item := range elem {
		if item != empty {
			return item
		}
	}
	return empty
}
func DataPath(paths ...string) string {
	return filepath.Join(append([]string{vars.DataPath}, paths...)...)
}
