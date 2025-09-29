package utils

import (
	"path/filepath"
	"time"

	"github.com/h2non/bimg"
	"github.com/sirupsen/logrus"
)

type imageConverter struct {
	convertChan chan imageConvertTask
}

type imageConvertTask struct {
	inputFile string
	outFile   string
}

func NewImageConverter() *imageConverter {
	instance := &imageConverter{
		convertChan: make(chan imageConvertTask, 100),
	}
	go instance.run()
	return instance
}

func (ic *imageConverter) Convert(inputFile, outFile string) {
	if filepath.Ext(inputFile) != filepath.Ext(outFile) {
		task := imageConvertTask{
			inputFile: inputFile,
			outFile:   outFile,
		}

		// 使用select实现非阻塞插入，满后丢弃
		select {
		case ic.convertChan <- task:
			// 成功插入任务
		default:
			// channel满了，丢弃任务并记录日志
			logrus.Warnf("image converter queue is full, dropping task: %s -> %s", filepath.Base(inputFile), filepath.Base(outFile))
		}
	}
}

func (ic *imageConverter) run() {
	defer func() {
		if r := recover(); r != nil {
			logrus.Errorf("image converter worker panic recovered: %v", r)
			go ic.run()
		}
	}()

	for task := range ic.convertChan {
		if FileExists(task.outFile) {
			continue
		}
		start := time.Now()
		err := ic.convert(task.inputFile, task.outFile)
		elapsed := time.Since(start)
		if err != nil {
			logrus.Errorf("convert image %s to %s failed: %v", filepath.Base(task.inputFile), filepath.Base(task.outFile), err)
		} else {
			logrus.Infof("convert image %s to %s success, cost %v", filepath.Base(task.inputFile), filepath.Base(task.outFile), elapsed)
		}
	}
}

func (ic *imageConverter) convert(inputFile, outFile string) error {
	if filepath.Ext(inputFile) == filepath.Ext(outFile) {
		return nil
	}
	var format bimg.ImageType
	switch filepath.Ext(outFile) {
	case ".webp":
		format = bimg.WEBP
	case ".avif":
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
