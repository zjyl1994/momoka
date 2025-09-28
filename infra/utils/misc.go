package utils

import (
	"context"
	"encoding/json"
	"fmt"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/h2non/bimg"
	"github.com/sirupsen/logrus"
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

func GetImageCachePath(imageHash, extName string) string {
	return DataPath("cache", imageHash[0:2], imageHash[2:4], imageHash+extName)
}

// ConvImage 将图片转换为指定格式
func ConvImage(inputFile, outFile, acceptType string) error {
	var format bimg.ImageType
	switch acceptType {
	case "image/webp":
		format = bimg.WEBP
	case "image/avif":
		format = bimg.AVIF
	default:
		return nil
	}
	buffer, err := bimg.Read(inputFile)
	if err != nil {
		return err
	}
	newImage, err := bimg.NewImage(buffer).Convert(format)
	if err != nil {
		return err
	}
	return bimg.Write(outFile, newImage)
}

var asyncConvImageMutex sync.Mutex

func AsyncConvImage(src, dst, acceptType string) {
	go func() {
		asyncConvImageMutex.Lock()
		defer asyncConvImageMutex.Unlock()
		if !FileExists(src) {
			return
		}
		if FileExists(dst) {
			return
		}
		start := time.Now()
		err := ConvImage(src, dst, acceptType)
		elapsed := time.Since(start).Truncate(time.Millisecond)
		if err != nil {
			logrus.Errorln("Failed to convert image:", err)
		} else {
			logrus.Infof("Converted image %s to %s in %v", filepath.Base(src), filepath.Base(dst), elapsed)
		}
	}()
}

// RunTickerTask 运行定时任务
func RunTickerTask(ctx context.Context, interval time.Duration, firstNow bool, task func(context.Context)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	if firstNow {
		task(ctx)
	}

	for {
		select {
		case <-ticker.C:
			task(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func GetBingTodayImage() (string, error) {
	resp, err := http.Get("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var data struct {
		Images []struct {
			URL string `json:"url"`
		} `json:"images"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return "", err
	}
	if len(data.Images) == 0 {
		return "", fmt.Errorf("no image found")
	}
	return "https://www.bing.com" + data.Images[0].URL, nil
}

func HttpDownload(url, filePath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("http status error: %d", resp.StatusCode)
	}
	dir := filepath.Dir(filePath)
	if err = os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}

func GetFolderForDashboard(path string) (int64, int64, error) {
	var fileCount, totalSize int64

	err := filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// 只统计文件，不统计目录
		if !info.IsDir() {
			fileCount++
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, 0, err
	}

	return fileCount, totalSize, nil
}

func RandStr(length int) string {
	charset := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	var sb strings.Builder
	for range length {
		sb.WriteRune(charset[rand.IntN(len(charset))])
	}
	return sb.String()
}
