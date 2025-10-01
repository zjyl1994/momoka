package adminapi

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func DashboardDataHandler(c *fiber.Ctx) error {
	fileCount, totalSize, err := utils.GetFolderForDashboard(utils.DataPath("cache"))
	if err != nil {
		return err
	}
	imageCount, imageSize, err := service.ImageService.CountForDashboard()
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

	return c.JSON(fiber.Map{
		"count": fiber.Map{
			"image_count":       imageCount,
			"image_size":        imageSize,
			"cache_count":       fileCount,
			"cache_size":        totalSize,
			"click":             vars.TotalImageClick.Load(),
			"bandwidth":         vars.TotalImageBandwidth.Load(),
			"monthly_click":     vars.MonthlyImageClick.Load(),
			"monthly_bandwidth": vars.MonthlyImageBandwidth.Load(),
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
	})
}
