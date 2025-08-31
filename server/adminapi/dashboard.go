package adminapi

import (
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func DashboardDataHandler(c *fiber.Ctx) error {
	fileCount, totalSize, err := utils.GetFolderForDashboard(utils.DataPath("cache"))
	if err != nil {
		return err
	}
	imageCount, imageSize, err := service.ImageService.GetCountForDashboard()
	if err != nil {
		return err
	}
	loadInfo, err := load.Avg()
	if err != nil {
		return err
	}
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return err
	}
	diskUsage, err := disk.Usage(vars.DataPath)
	if err != nil {
		return err
	}
	uptime := time.Since(vars.BootTime).Seconds()

	cacheStat, err := getCacheFolderStat(10)
	if err != nil {
		return err
	}
	for i, stat := range cacheStat {
		imageURL, err := utils.GetImageURL(c, &stat.Image)
		if err != nil {
			return err
		}
		cacheStat[i].URL = imageURL
	}

	return c.JSON(fiber.Map{
		"count": fiber.Map{
			"image_count": imageCount,
			"image_size":  imageSize,
			"cache_count": fileCount,
			"cache_size":  totalSize,
		},
		"stat": fiber.Map{
			"load": fiber.Map{
				"load1":  loadInfo.Load1,
				"load5":  loadInfo.Load5,
				"load15": loadInfo.Load15,
			},
			"mem": fiber.Map{
				"total": memInfo.Total,
				"used":  memInfo.Used,
				"free":  memInfo.Free + memInfo.Available,
			},
			"disk": fiber.Map{
				"total":   diskUsage.Total,
				"used":    diskUsage.Used,
				"free":    diskUsage.Free,
				"percent": diskUsage.UsedPercent,
			},
			"boot_time": vars.BootTime.Unix(),
			"uptime":    uptime,
		},
		"cache": cacheStat,
	})
}

type cacheStatItem struct {
	common.Image
	AccessTime int64 `json:"access_time"`
	CacheSize  int64 `json:"cache_size"`
	imageHash  string
}

func getCacheFolderStat(limit int) ([]cacheStatItem, error) {
	files, err := utils.ScanFolder(utils.DataPath("cache"))
	if err != nil {
		return nil, err
	}
	hashMap := make(map[string]cacheStatItem)
	for _, item := range files {
		if strings.HasPrefix(item.Name, "bing-") {
			continue
		}
		imageHash := strings.TrimSuffix(item.Name, filepath.Ext(item.Name))
		accessTime := item.ModTime.Unix()

		if existing, ok := hashMap[imageHash]; ok {
			// 如果已存在相同的imageHash，保留AccessTime较大的记录
			if accessTime > existing.AccessTime {
				hashMap[imageHash] = cacheStatItem{
					imageHash:  imageHash,
					AccessTime: accessTime,
					CacheSize:  item.Size + existing.CacheSize,
				}
			}
		} else {
			hashMap[imageHash] = cacheStatItem{
				imageHash:  imageHash,
				AccessTime: accessTime,
				CacheSize:  item.Size,
			}
		}
	}

	result := make([]cacheStatItem, 0, len(hashMap))
	for _, item := range hashMap {
		result = append(result, item)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].AccessTime == result[j].AccessTime {
			return result[i].Hash > result[j].Hash
		} else {
			return result[i].AccessTime > result[j].AccessTime
		}
	})
	if len(result) > limit {
		result = result[:limit]
	}
	// 从DB取具体内容
	validResults := make([]cacheStatItem, 0, len(result))
	for i := range result {
		image, err := service.ImageService.GetByHash(result[i].imageHash)
		if err != nil {
			continue
		}
		if image != nil {
			result[i].Image = *image
			validResults = append(validResults, result[i])
		}
	}
	return validResults, nil
}
