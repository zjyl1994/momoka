package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/zjyl1994/momoka/infra/common"
)

func ScanFolder(path string) ([]common.FileInfo, error) {
	var files []common.FileInfo

	// 遍历目录下的所有文件
	err := filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if info.IsDir() {
			return nil
		}

		// 获取相对路径
		relPath, err := filepath.Rel(path, filePath)
		if err != nil {
			return err
		}

		// 构建FileInfo结构
		fileInfo := common.FileInfo{
			Name:    info.Name(),
			Ext:     filepath.Ext(info.Name()),
			Path:    relPath,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		}

		files = append(files, fileInfo)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return files, nil
}

// GetFileContentType 获取文件的MIME类型
func GetFileContentType(filePath string) (string, error) {
	// 打开文件
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// 读取文件的前512字节用于检测
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	// 使用http包的DetectContentType函数检测MIME类型
	contentType := http.DetectContentType(buffer)
	return contentType, nil
}

// FileExists 检查文件是否存在
func FileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func TouchFile(filepath string) error {
	now := time.Now()
	return os.Chtimes(filepath, now, now)
}

func MultipartFileHeaderHash(fileHeader *multipart.FileHeader) (string, error) {
	file, err := fileHeader.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func SaveMultipartFile(fileHeader *multipart.FileHeader, path string) error {
	err := os.MkdirAll(filepath.Dir(path), 0755)
	if err != nil {
		return err
	}

	file, err := fileHeader.Open()
	if err != nil {
		return err
	}
	defer file.Close()

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		return err
	}

	return nil
}

func ChangeExtName(path string, ext string) string {
	if ext == "" {
		return path
	}
	if ext[0] != '.' {
		ext = "." + ext
	}
	extName := filepath.Ext(path)
	if extName == ext {
		return path
	}
	return strings.TrimSuffix(path, extName) + ext
}
