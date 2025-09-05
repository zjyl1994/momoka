package service

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ImageService = &imageService{}

type imageService struct{}

func (s *imageService) Add(img *common.Image) (int64, error) {
	err := vars.Database.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "hash"}},
		UpdateAll: true,
	}).Create(img).Error
	return img.ID, err
}

func (s *imageService) ImageHashExists(hash string) (bool, error) {
	var count int64
	err := vars.Database.Model(&common.Image{}).Where("hash = ?", hash).Count(&count).Error
	return count > 0, err
}

func (s *imageService) GetByID(id int64) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("id = ?", id).First(&img).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &img, nil
}

func (s *imageService) GetByHash(hash string) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("hash = ?", hash).First(&img).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &img, nil
}

func (s *imageService) DeleteByID(id int64) error {
	img, err := ImageService.GetByID(id)
	if err != nil {
		return err
	}
	if img == nil {
		return errors.New("image not found")
	}
	return ImageService.Delete(img)
}

func (s *imageService) Delete(img *common.Image) (err error) {
	// 删除S3对象
	err = StorageService.Delete(context.Background(), img.Hash+img.ExtName)
	if err != nil {
		return err
	}
	// 删除本地对象
	err = os.Remove(utils.GetImageCachePath(img.Hash, img.ExtName))
	if err != nil {
		return err
	}
	// 删除数据库记录
	err = vars.Database.Delete(&common.Image{}, img.ID).Error
	if err != nil {
		return err
	}
	return nil
}

func (s *imageService) Move(id int64, folderID int64) error {
	result := vars.Database.Model(&common.Image{}).Where("id = ?", id).Update("folder_id", folderID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("image not found")
	}
	return nil
}

func (s *imageService) Rename(id int64, name string) error {
	result := vars.Database.Model(&common.Image{}).Where("id = ?", id).Update("file_name", name)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("image not found")
	}
	return nil
}

func (s *imageService) GetAllPublic(page, pageSize int) ([]common.Image, int64, error) {
	folders, err := ImageFolderService.GetAllPublicFolder()
	if err != nil {
		return nil, 0, err
	}

	publicFolderID := make([]int64, 0, len(folders))
	for _, folder := range folders {
		publicFolderID = append(publicFolderID, folder.ID)
	}

	if len(publicFolderID) == 0 {
		return []common.Image{}, 0, nil
	}

	var total int64
	if err := vars.Database.Model(&common.Image{}).Where("folder_id IN ?", publicFolderID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var images []common.Image
	if err := vars.Database.Where("folder_id IN ?", publicFolderID).Order("create_time desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&images).Error; err != nil {
		return nil, 0, err
	}
	return images, total, nil
}

func (s *imageService) GetAll(keyword string, page, pageSize int) ([]common.Image, int64, error) {
	query := vars.Database.Model(&common.Image{})
	if keyword != "" {
		query = query.Where("file_name LIKE ?", "%"+keyword+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var images []common.Image
	if err := query.Order("create_time desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&images).Error; err != nil {
		return nil, 0, err
	}
	return images, total, nil
}

func (s *imageService) GetCountForDashboard() (int64, int64, error) {
	var count int64
	if err := vars.Database.Model(&common.Image{}).Count(&count).Error; err != nil {
		return 0, 0, err
	}
	var size int64
	if err := vars.Database.Model(&common.Image{}).Select("sum(file_size)").Scan(&size).Error; err != nil {
		return 0, 0, err
	}
	return count, size, nil
}

func (s *imageService) BatchMove(ctx context.Context, ids []int64, folderID int64) error {
    // 检查是否有图片需要移动
    if len(ids) == 0 {
        return nil
    }

    // 执行批量更新
    result := vars.Database.Model(&common.Image{}).
        Where("id IN ?", ids).
        Update("folder_id", folderID)

    if result.Error != nil {
        return result.Error
    }

    // 检查是否有图片被更新
    if result.RowsAffected == 0 {
        return errors.New("no images found")
    }

    return nil
}

func (s *imageService) BatchDelete(ctx context.Context, ids []int64) error {
    // 检查是否有图片需要删除
    if len(ids) == 0 {
        return nil
    }

    // 获取所有需要删除的图片信息
    var images []common.Image
    if err := vars.Database.Where("id IN ?", ids).Find(&images).Error; err != nil {
        return err
    }

    if len(images) == 0 {
        return errors.New("no images found")
    }

    // 准备S3对象删除列表
    objKeys := make([]string, len(images))
    keyToImageMap := make(map[string]*common.Image)
    for i, img := range images {
        key := img.Hash + img.ExtName
        objKeys[i] = key
        keyToImageMap[key] = &images[i]
    }

    // 第一步：批量删除S3对象
    failedKeys, err := StorageService.DeleteObjs(ctx, objKeys)
    if err != nil {
        return err
    }

    // 创建失败key的集合，用于快速查找
    failedKeySet := make(map[string]bool)
    for _, key := range failedKeys {
        failedKeySet[key] = true
    }

    // 收集S3删除成功的图片ID和信息
    var successfulIDs []int64
    var successfulImages []common.Image
    for _, img := range images {
        key := img.Hash + img.ExtName
        // 如果S3删除失败，跳过数据库和本地缓存删除
        if failedKeySet[key] {
            continue
        }
        successfulIDs = append(successfulIDs, img.ID)
        successfulImages = append(successfulImages, img)
    }

    // 第二步：批量删除数据库记录（只删除S3删除成功的）
    if len(successfulIDs) > 0 {
        if err := vars.Database.Delete(&common.Image{}, successfulIDs).Error; err != nil {
            return err
        }
    }

    // 第三步：清理本地缓存中已删除的内容
    for _, img := range successfulImages {
        err := os.Remove(utils.GetImageCachePath(img.Hash, img.ExtName))
        if err != nil && !os.IsNotExist(err) {
            return err
        }
    }

    // 如果有删除失败的，返回错误信息
    if len(failedKeys) > 0 {
        return fmt.Errorf("failed to delete %d images from storage", len(failedKeys))
    }

    return nil
}
