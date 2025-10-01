package common

type ClickCtrData struct {
	YearMonth        int64 `json:"year_month"`
	TotalClick       int64 `json:"total_click"`
	TotalBandwidth   int64 `json:"total_bandwidth"`
	MonthlyClick     int64 `json:"monthly_click"`
	MonthlyBandwidth int64 `json:"monthly_bandwidth"`
}
