package service

import (
	"context"
	"errors"

	"github.com/samber/lo"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type imageService struct{}

var ImageService = &imageService{}

func (s *imageService) Add(db *gorm.DB, image *common.Image) error {
	image.Tags = lo.Uniq(image.Tags)
	err := db.Transaction(func(tx *gorm.DB) error {
		// Check if file with same hash already exists
		var hashCount int64
		err := tx.Model(&common.Image{}).Where("hash = ?", image.Hash).Count(&hashCount).Error
		if err != nil {
			return err
		}

		// If hash doesn't exist, add S3 upload task
		if hashCount == 0 {
			err = S3TaskService.Add(tx, []*common.S3Task{
				{
					Action:     common.S3TASK_ACTION_UPLOAD,
					LocalPath:  image.LocalPath,
					RemotePath: image.RemotePath,
				},
			})
			if err != nil {
				return err
			}
		}

		if err := tx.Create(image).Error; err != nil {
			return err
		}
		for _, tag := range image.Tags {
			if err := tx.Create(&common.ImageTags{
				ImageID: image.ID,
				TagName: tag,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	go S3TaskService.RunTask()
	s.FillModel(image)
	return nil
}

func (s *imageService) Get(db *gorm.DB, id int64) (*common.Image, error) {
	var image common.Image
	if err := db.First(&image, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	var tags []string
	if err := db.Model(&common.ImageTags{}).Where("image_id = ?", id).Pluck("tag_name", &tags).Error; err != nil {
		return nil, err
	}
	image.Tags = lo.Uniq(tags)
	s.FillModel(&image)
	return &image, nil
}

func (s *imageService) Search(db *gorm.DB, keyword string, page, pageSize int, keywordIsTag bool) ([]*common.Image, int64, error) {
	var images []*common.Image
	var total int64

	// Build base query
	query := db.Model(&common.Image{})

	// If keyword is provided, search based on keywordIsTag flag
	if keyword != "" {
		if keywordIsTag {
			// Search only in tags with exact match
			query = query.Where(
				"id IN (?)",
				db.Model(&common.ImageTags{}).Select("image_id").Where("tag_name = ?", keyword),
			)
		} else {
			// Search in image name, remark, or tags
			query = query.Where(
				"name LIKE ? OR remark LIKE ? OR id IN (?)",
				"%"+keyword+"%",
				"%"+keyword+"%",
				db.Model(&common.ImageTags{}).Select("image_id").Where("tag_name LIKE ?", "%"+keyword+"%"),
			)
		}
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination and get results
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&images).Error; err != nil {
		return nil, 0, err
	}

	// Load tags for each image
	for _, image := range images {
		var tags []string
		if err := db.Model(&common.ImageTags{}).Where("image_id = ?", image.ID).Pluck("tag_name", &tags).Error; err != nil {
			return nil, 0, err
		}
		image.Tags = lo.Uniq(tags)

		s.FillModel(image)
	}

	return images, total, nil
}

func (s *imageService) Delete(db *gorm.DB, id []int64) error {
	err := db.Transaction(func(tx *gorm.DB) error {
		// Get images to be deleted for S3 cleanup
		var imagesToDelete []common.Image
		if err := tx.Where("id IN ?", id).Find(&imagesToDelete).Error; err != nil {
			return err
		}

		// Delete image records
		if err := tx.Delete(&common.Image{}, id).Error; err != nil {
			return err
		}

		// Delete image tags
		if err := tx.Delete(&common.ImageTags{}, "image_id IN ?", id).Error; err != nil {
			return err
		}

		// Check if any other images use the same hash and add S3 delete tasks if needed
		for _, image := range imagesToDelete {
			var hashCount int64
			err := tx.Model(&common.Image{}).Where("hash = ?", image.Hash).Count(&hashCount).Error
			if err != nil {
				return err
			}

			// If no other images use this hash, add S3 delete task
			if hashCount == 0 {
				err = S3TaskService.Add(tx, []*common.S3Task{
					{
						Action:     common.S3TASK_ACTION_DELETE,
						RemotePath: image.Hash + image.ExtName,
					},
				})
				if err != nil {
					return err
				}
			}
		}

		return nil
	})
	if err != nil {
		return err
	}
	go S3TaskService.RunTask()
	return nil
}

func (s *imageService) Update(db *gorm.DB, image *common.Image) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(image).Error; err != nil {
			return err
		}
		if err := tx.Delete(&common.ImageTags{}, "image_id = ?", image.ID).Error; err != nil {
			return err
		}
		image.Tags = lo.Uniq(image.Tags)
		for _, tag := range image.Tags {
			if err := tx.Create(&common.ImageTags{
				ImageID: image.ID,
				TagName: tag,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *imageService) GetTags(db *gorm.DB) (map[string]int64, error) {
	var results []struct {
		TagName string `json:"tag_name"`
		Count   int64  `json:"count"`
	}

	// Group by tag_name and count occurrences
	err := db.Model(&common.ImageTags{}).
		Select("tag_name, COUNT(*) as count").
		Group("tag_name").
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	// Convert to map
	tagsMap := make(map[string]int64)
	for _, result := range results {
		tagsMap[result.TagName] = result.Count
	}

	return tagsMap, nil
}

func (s *imageService) FillModel(m *common.Image) {
	m.RemotePath = m.Hash + m.ExtName
	m.LocalPath = utils.DataPath("cache", m.Hash[0:2], m.Hash[2:4], m.Hash+m.ExtName)
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.ENTITY_TYPE_FILE, m.ID})
	if err == nil {
		m.URL = "/i/" + imageHashId + m.ExtName
	}
}

func (s *imageService) Download(m *common.Image) error {
	s.FillModel(m)
	if m.RemotePath == "" || m.LocalPath == "" {
		return errors.New("invalid image")
	}
	return StorageService.Download(context.Background(), m.RemotePath, m.LocalPath)
}

func (s *imageService) CountForDashboard() (int64, int64, error) {
	var count int64
	var size int64
	if err := vars.Database.Model(&common.Image{}).Count(&count).Error; err != nil {
		return 0, 0, err
	}
	if err := vars.Database.Model(&common.Image{}).Select("coalesce(sum(file_size), 0)").Scan(&size).Error; err != nil {
		return 0, 0, err
	}
	return count, size, nil
}
