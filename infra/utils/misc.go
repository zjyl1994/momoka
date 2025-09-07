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
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/common"
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


// ConvWebp 将图片转换为WebP格式
func ConvWebp(inputFile, outFile string) error {
	ext := filepath.Ext(inputFile)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".tiff" && ext != ".tif" {
		return nil // 不支持的格式无需转换
	}

	if vars.CwebpBin == "" {
		return fmt.Errorf("cwebp not found")
	}

	// 调用cwebp命令进行转换
	cmd := exec.Command(vars.CwebpBin, inputFile, "-o", outFile, "-quiet")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cwebp failed: %v, output: %s", err, string(output))
	}
	return nil
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

func GetImageURL(c *fiber.Ctx, img *common.Image) (string, error) {
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.ENTITY_TYPE_IMAGE, img.ID})
	if err != nil {
		return "", err
	}
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}
	return baseUrl + "/i/" + imageHashId + img.ExtName, nil
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
