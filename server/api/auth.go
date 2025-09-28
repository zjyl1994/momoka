package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/zjyl1994/cap-go"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
	"golang.org/x/crypto/bcrypt"
)

func LoginHandler(c *fiber.Ctx) error {
	// 从请求体中获取用户名和密码
	var loginReq struct {
		Username  string `json:"username"`
		Password  string `json:"password"`
		Remember  bool   `json:"remember"`
		SetCookie bool   `json:"set_cookie"`
		CapToken  string `json:"cap_token"`
	}
	if err := c.BodyParser(&loginReq); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "无效的请求参数",
		})
	}

	// 验证CAP令牌
	if loginReq.CapToken == "" || !vars.CapInstance.ValidateToken(loginReq.CapToken, false) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "CAP令牌验证失败",
		})
	}

	// 验证用户名和密码
	if loginReq.Username == "" || loginReq.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "用户名和密码不能为空",
		})
	}

	// 数据库加载用户名和hash
	adminUser, err := service.SettingService.Get(common.SETTING_KEY_ADMIN_USER)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "获取管理员用户名失败",
		})
	}
	if loginReq.Username != adminUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "用户名或密码错误",
		})
	}

	adminPass, err := service.SettingService.Get(common.SETTING_KEY_ADMIN_PASSWORD)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "获取管理员密码失败",
		})
	}

	err = bcrypt.CompareHashAndPassword([]byte(adminPass), []byte(loginReq.Password))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "用户名或密码错误",
		})
	}

	// 过期时间
	var tokenExpire time.Duration
	if loginReq.Remember {
		tokenExpire = time.Hour * 24 * 30
	} else {
		tokenExpire = time.Hour * 24
	}
	// 生成JWT令牌
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["username"] = loginReq.Username
	claims["exp"] = time.Now().Add(tokenExpire).Unix()
	claims["iat"] = time.Now().Unix()
	claims["nbf"] = time.Now().Unix()

	// 使用密钥签名JWT
	t, err := token.SignedString([]byte(vars.Secret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "生成令牌失败",
		})
	}

	// 设置Cookie
	if loginReq.SetCookie {
		cookie := fiber.Cookie{
			Name:     "momoka_token",
			Value:    t,
			Expires:  time.Now().Add(tokenExpire),
			HTTPOnly: true,
		}
		c.Cookie(&cookie)
	}

	// 返回JWT令牌
	return c.JSON(fiber.Map{
		"token": t,
		"type":  "Bearer",
	})
}

func CreateChallenge(c *fiber.Ctx) error {
	challenge := vars.CapInstance.CreateChallenge(nil)
	return c.JSON(challenge)
}

func RedeemChallenge(c *fiber.Ctx) error {
	var body cap.Solution
	err := c.BodyParser(&body)
	if err != nil {
		return err
	}
	resp := vars.CapInstance.RedeemChallenge(&body)
	return c.JSON(resp)
}

func AuthStatusHandler(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"skip_auth":  vars.SkipAuth,
		"site_name":  vars.SiteName,
	})
}
