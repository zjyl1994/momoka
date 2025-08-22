package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
)

// CleanCacheByModTime 清理缓存目录：删除过期文件，再按数量限制删除最老文件
func CleanCacheByModTime(cacheDir string, maxAgeDays, maxFiles int) (cleanCount int, err error) {
	var files []struct {
		Path  string
		MTime time.Time
	}

	now := time.Now()
	cutoff := now.AddDate(0, 0, -maxAgeDays)
	// 遍历收集文件
	err = filepath.Walk(cacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		files = append(files, struct {
			Path  string
			MTime time.Time
		}{path, info.ModTime()})
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("Walk file failed, err: %v", err)
	}

	// 第一阶段：删除超过 maxAgeDays 的文件
	var remaining []struct {
		Path  string
		MTime time.Time
	}
	for _, f := range files {
		if f.MTime.Before(cutoff) {
			os.Remove(f.Path)
			cleanCount++
			logrus.Debugf("CleanCacheByModTime delete expired file %s, mtime=%v", f.Path, f.MTime)
		} else {
			remaining = append(remaining, f)
		}
	}

	// 第二阶段：数量超限，删除最老的
	if maxFiles > 0 && len(remaining) > maxFiles {
		sort.Slice(remaining, func(i, j int) bool {
			return remaining[i].MTime.Before(remaining[j].MTime)
		})
		for i := 0; i < len(remaining)-maxFiles; i++ {
			os.Remove(remaining[i].Path)
			cleanCount++
			logrus.Debugf("CleanCacheByModTime delete excess file %s, mtime=%v", remaining[i].Path, remaining[i].MTime)
		}
	}

	return cleanCount, nil
}
