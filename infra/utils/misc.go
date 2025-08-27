package utils

import (
	"context"
	"encoding/json"
	"fmt"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

// InitS3Client 初始化S3客户端 (AWS SDK Go v2)
func InitS3Client(ctx context.Context, conf vars.S3Conf) (*s3.Client, error) {
	// 创建静态凭据
	creds := credentials.NewStaticCredentialsProvider(
		conf.AccessID,
		conf.SecretKey,
		"", // session token，通常为空
	)

	// 配置选项
	var opts []func(*config.LoadOptions) error

	// 设置区域
	if conf.Region != "" {
		opts = append(opts, config.WithRegion(conf.Region))
	}

	// 设置凭据
	opts = append(opts, config.WithCredentialsProvider(creds))
	if vars.DebugMode {
		opts = append(opts, config.WithClientLogMode(aws.LogRequest|aws.LogResponse))
	}
	// 加载AWS配置
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, err
	}

	// S3客户端选项
	var s3Opts []func(*s3.Options)

	// 如果提供了自定义端点，则设置端点
	if conf.Endpoint != "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(conf.Endpoint)
			o.UsePathStyle = true // 对于自定义端点通常使用路径样式
		})
	}

	// 创建S3客户端
	s3Client := s3.NewFromConfig(cfg, s3Opts...)

	return s3Client, nil
}

func TouchFile(filepath string) error {
	now := time.Now()
	return os.Chtimes(filepath, now, now)
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

// FileExists 检查文件是否存在
func FileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
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
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.HID_TYPE_IMAGE, img.ID})
	if err != nil {
		return "", err
	}
	return c.BaseURL() + "/i/" + imageHashId + img.ExtName, nil
}
