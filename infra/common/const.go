package common

const (
	ENTITY_TYPE_IMAGE  = 1
	ENTITY_TYPE_FOLDER = 2
)

const (
	SETTING_KEY_ADMIN_USER         = "admin_user"
	SETTING_KEY_ADMIN_PASSWORD     = "admin_password"
	SETTING_KEY_AUTO_BACKUP_DAY    = "auto_backup_day"
	SETTING_KEY_SYSTEM_RAND_SECRET = "system_rand_secret"
	SETTING_KEY_BASE_URL           = "base_url"
)

const (
	DEFAULT_ADMIN_USER     = "admin"
	DEFAULT_ADMIN_PASSWORD = "123456"
)

const (
	MAX_IMAGE_SIZE = 50 * 1024 * 1024

	AUTO_BACKUP_PREFIX  = "auto-"
	BACKUP_FILE_VERSION = 1
)
