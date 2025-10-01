package service

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
)

type imageCounterService struct {
	globalYearMonth  atomic.Int64
	totalClick       atomic.Int64
	totalBandwidth   atomic.Int64
	monthlyClick     atomic.Int64
	monthlyBandwidth atomic.Int64
	fileSizeSf       utils.SingleFlight[int64]
}

var ImageCounterService = &imageCounterService{}

func (s *imageCounterService) GetData() common.ClickCtrData {
	return common.ClickCtrData{
		YearMonth:        s.globalYearMonth.Load(),
		TotalClick:       s.totalClick.Load(),
		TotalBandwidth:   s.totalBandwidth.Load(),
		MonthlyClick:     s.monthlyClick.Load(),
		MonthlyBandwidth: s.monthlyBandwidth.Load(),
	}
}

func (s *imageCounterService) SetData(data common.ClickCtrData) {
	s.globalYearMonth.Store(data.YearMonth)
	s.totalClick.Store(data.TotalClick)
	s.totalBandwidth.Store(data.TotalBandwidth)
	s.monthlyClick.Store(data.MonthlyClick)
	s.monthlyBandwidth.Store(data.MonthlyBandwidth)
}

func (s *imageCounterService) Incr(path string) {
	size, err := s.fileSizeSf.Do(path, func() (int64, error) {
		return utils.GetFileSize(path)
	})
	if err != nil {
		return
	}
	s.totalClick.Add(1)
	s.totalBandwidth.Add(size)
	// monthly
	currentYM := utils.GetYearMonth(time.Now())
	if loadedYM := s.globalYearMonth.Load(); loadedYM != currentYM {
		if s.globalYearMonth.CompareAndSwap(loadedYM, currentYM) { // reset monthly counter
			s.monthlyClick.Store(0)
			s.monthlyBandwidth.Store(0)
		}
	}
	s.monthlyClick.Add(1)
	s.monthlyBandwidth.Add(size)
}

func (s *imageCounterService) BackgroundSave(ctx context.Context) {
	data := s.GetData()
	clickCtrJson, err := json.Marshal(data)
	if err != nil {
		logrus.Errorln("BackgroundSave", err)
		return
	}
	if err := SettingService.Set(common.SETTING_KEY_CLICK_CTR_DATA, string(clickCtrJson)); err != nil {
		logrus.Errorln("BackgroundSave", err)
		return
	}
}
