import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Spin, Checkbox, App, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore.jsx';
import { useNavigate } from 'react-router-dom';
import '@cap.js/widget';
import './Login.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capToken, setCapToken] = useState('');
  const { login, isAuthenticated, siteName, initialized } = useAuthStore();
  const navigate = useNavigate();
  const { message } = App.useApp();

  // Set page title and setup cap widget
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) return;
    
    // 设置页面标题
    document.title = `登录 - ${siteName}`;

    // Add cap widget event listener
    const capWidget = document.getElementById('cap');
    if (capWidget) {
      const handleSolve = (e) => {
        const token = e.detail.token;
        setCapToken(token);
      };
      capWidget.addEventListener('solve', handleSolve);

      return () => {
        capWidget.removeEventListener('solve', handleSolve);
      };
    }
  }, [siteName, initialized]);

  // 如果已经认证，自动跳转到管理页面
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  // 清除错误信息 - 使用useCallback优化性能
  const clearError = useCallback(() => {
    setError('');
  }, []);

  // 表单提交处理 - 使用useCallback优化性能
  const onFinish = useCallback(async (values) => {
    if (!capToken) {
      setError('请完成验证码验证');
      return;
    }

    setLoading(true);
    setError(''); // 清除之前的错误信息
    try {
      const result = await login(values.username, values.password, values.remember, capToken);
      if (result.success) {
        message.success('登录成功');
        navigate('/admin');
      } else {
        setError(result.message || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [capToken, login, message, navigate]);

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-form-wrapper">
          <Card className="login-card">
            <div className="login-header">
              <h1>{siteName}</h1>
              <p>请登录您的账户</p>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
                closable
                onClose={clearError}
              />
            )}

            <Form
              name="login"
              className="login-form"
              onFinish={onFinish}
              autoComplete="off"
              size="large"
            >
              <Form.Item
                name="username"
                rules={[
                  {
                    required: true,
                    message: '请输入用户名!',
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  {
                    required: true,
                    message: '请输入密码!',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                />
              </Form.Item>

              <Form.Item>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox className="remember-checkbox">记住我</Checkbox>
                </Form.Item>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  className="login-button"
                  loading={loading}
                  block
                >
                  {loading ? <Spin size="small" /> : '登录'}
                </Button>
              </Form.Item>

              <Form.Item>
                <cap-widget 
                  id="cap" 
                  data-cap-api-endpoint="/api/cap/" 
                  style={{ 
                    '--cap-widget-width': "100%", 
                    '--cap-border-color': '#d9d9d9' 
                  }}
                />
              </Form.Item>
            </Form>

            <div className="login-footer">
              <p>请使用管理员账户登录</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;