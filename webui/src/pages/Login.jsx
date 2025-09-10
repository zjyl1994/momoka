import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Spin, Checkbox, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '@cap.js/widget';
import './Login.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capToken, setCapToken] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Set page title
  useEffect(() => {
    document.title = '登录 - Momoka 图床';
    
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
  }, []);

  const onFinish = async (values) => {
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
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-form-wrapper">
          <Card className="login-card">
            <div className="login-header">
              <h1>Momoka 图床</h1>
              <p>请登录您的账户</p>
            </div>
            
            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
                closable
                onClose={() => setError('')}
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
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
              </Form.Item>

              <Form.Item>
                <cap-widget id="cap" data-cap-api-endpoint="/api/cap/"></cap-widget>
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