package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
)

// CleanCacheByModTime 清理缓存目录：根据参数选择性删除过期文件和超量文件
// maxAgeDays > 0 时启用按时间清理，maxFiles > 0 时启用按数量清理
func CleanCacheByModTime(cacheDir string, maxAgeDays, maxFiles int) (cleanCount int, err error) {
	var files []struct {
		Path  string
		MTime time.Time
	}

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

	var remaining []struct {
		Path  string
		MTime time.Time
	}
	remaining = files

	// 第一阶段：按时间清理（仅当 maxAgeDays > 0 时执行）
	if maxAgeDays > 0 {
		now := time.Now()
		cutoff := now.AddDate(0, 0, -maxAgeDays)
		remaining = nil // 重置remaining
		for _, f := range files {
			if f.MTime.Before(cutoff) {
				os.Remove(f.Path)
				cleanCount++
				logrus.Debugf("CleanCacheByModTime delete expired file %s, mtime=%v", f.Path, f.MTime)
			} else {
				remaining = append(remaining, f)
			}
		}
	}

	// 第二阶段：按数量清理（仅当 maxFiles > 0 时执行）
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
