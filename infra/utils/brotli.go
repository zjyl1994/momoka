package utils

import (
	"bytes"
	"crypto/sha256"
	"io"

	"github.com/andybalholm/brotli"
)

// CompressBrotli 压缩输入数据
func CompressBrotli(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	writer := brotli.NewWriter(&buf)

	_, err := writer.Write(data)
	if err != nil {
		return nil, err
	}

	// 必须调用 Close 来刷新并写入所有压缩数据
	err = writer.Close()
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// DecompressBrotli 解压输入的压缩数据
func DecompressBrotli(compressedData []byte) ([]byte, error) {
	reader := brotli.NewReader(bytes.NewReader(compressedData))

	var buf bytes.Buffer
	_, err := io.Copy(&buf, reader)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func SHA256Hash(data []byte) []byte {
	hash := sha256.New()
	hash.Write(data)
	return hash.Sum(nil)
}
