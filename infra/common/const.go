package common

const (
	ENTITY_TYPE_FILE   = 1
	ENTITY_TYPE_FOLDER = 2

	S3TASK_ACTION_UPLOAD = 1
	S3TASK_ACTION_DELETE = 2

	S3TASK_STATUS_WAITING = 0
	S3TASK_STATUS_RUNNING = 1
	S3TASK_STATUS_SUCCESS = 2
	S3TASK_STATUS_FAILED  = 3
)

const (
	SETTING_KEY_ADMIN_USER         = "admin_user"
	SETTING_KEY_ADMIN_PASSWORD     = "admin_password"
	SETTING_KEY_AUTO_BACKUP_DAY    = "auto_backup_day"
	SETTING_KEY_SYSTEM_RAND_SECRET = "system_rand_secret"
	SETTING_KEY_BASE_URL           = "base_url"
	SETTING_KEY_SITE_NAME          = "site_name"
	SETTING_KEY_AUTO_CONV_WEBP     = "auto_conv_webp"
	SETTING_KEY_AUTO_CONV_AVIF     = "auto_conv_avif"
	SETTING_KEY_CLICK_CTR_DATA     = "click_ctr_data"
)

const (
	DEFAULT_ADMIN_USER = "admin"

	MAX_IMAGE_SIZE = 50 * 1024 * 1024

	AUTO_BACKUP_PREFIX  = "auto-"
	BACKUP_FILE_VERSION = 1

	IMAGE_TYPE_WEBP = "image/webp"
	IMAGE_TYPE_AVIF = "image/avif"
)
