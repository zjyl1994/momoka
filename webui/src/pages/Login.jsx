import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Input, Button, Card, Spin, Checkbox, App, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore.jsx';
import { useNavigate } from 'react-router-dom';
import Cap from '@cap.js/widget';
import './Login.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capToken, setCapToken] = useState('');
  const [capSolving, setCapSolving] = useState(false);
  
  const { login, isAuthenticated, siteName, initialized } = useAuthStore();
  const { message } = App.useApp();
  const navigate = useNavigate();
  
  // Cap实例引用
  const capInstanceRef = useRef(null);
  // 操作锁，防止并发操作
  const operationLockRef = useRef(false);

  // 清除错误信息
  const clearError = useCallback(() => {
    setError('');
  }, []);

  // 创建Cap实例
  const createCapInstance = useCallback(async () => {
    try {
      console.log('[Cap] Creating new Cap instance...');
      const cap = new Cap({ 
        apiEndpoint: '/api/cap/' 
      });
      
      // 监听进度事件
      cap.addEventListener('progress', (event) => {
        console.log(`[Cap] Solving... ${event.detail.progress}% done`);
      });
      
      // 监听错误事件
      cap.addEventListener('error', (event) => {
        console.error('[Cap] Error:', event.detail);
        setCapSolving(false);
        setError('验证码生成失败，请刷新页面重试');
      });
      
      capInstanceRef.current = cap;
      console.log('[Cap] ✓ Instance created successfully');
      return cap;
    } catch (error) {
      console.error('[Cap] ✗ Failed to create instance:', error);
      setError('验证码初始化失败，请刷新页面重试');
      return null;
    }
  }, []);

  // 自动solve验证码
  const solveCapChallenge = useCallback(async () => {
    if (!capInstanceRef.current) {
      console.warn('[Cap] ✗ No Cap instance available');
      return null;
    }
    
    if (capSolving) {
      console.log('[Cap] Already solving, skipping...');
      return null;
    }

    try {
      setCapSolving(true);
      console.log('[Cap] Starting solve...');
      
      const solution = await capInstanceRef.current.solve();
      const token = solution.token;
      
      console.log('[Cap] ✓ Solve completed, token:', token);
      setCapToken(token);
      setCapSolving(false);
      
      return token;
    } catch (error) {
      console.error('[Cap] ✗ Solve failed:', error);
      setCapSolving(false);
      setError('验证码生成失败，请重试');
      return null;
    }
  }, [capSolving]);

  // 重置Cap验证码
  const resetCapChallenge = useCallback(async () => {
    // 防止并发操作
    if (operationLockRef.current) {
      console.log('[Cap] Operation locked, skipping reset...');
      return;
    }
    
    operationLockRef.current = true;
    console.log('[Cap] Resetting challenge...');
    setCapToken('');
    setCapSolving(false);
    
    try {
      // 重新创建实例并solve
      const cap = await createCapInstance();
      if (cap) {
        await solveCapChallenge();
      }
    } catch (error) {
      console.error('[Cap] Reset failed:', error);
    } finally {
      operationLockRef.current = false;
    }
  }, []);

  // Set page title and setup cap
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) return;
    
    // 设置页面标题
    document.title = `登录 - ${siteName}`;

    // 防止重复初始化
    if (operationLockRef.current) {
      console.log('[Cap] Already initialized or initializing, skipping...');
      return;
    }

    // 创建Cap实例并自动solve
    const setupCap = async () => {
      operationLockRef.current = true;
      try {
        const cap = await createCapInstance();
        if (cap) {
          await solveCapChallenge();
        }
      } catch (error) {
        console.error('[Cap] Setup failed:', error);
      } finally {
        operationLockRef.current = false;
      }
    };

    setupCap();
  }, [siteName, initialized]);

  // 如果已经认证，自动跳转到管理页面
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  // 处理表单提交
  const onFinish = useCallback(async (values) => {
    // 检查是否有验证码token
    if (!capToken) {
      if (capSolving) {
        setError('验证码正在生成中，请稍候...');
      } else {
        setError('验证码未准备就绪，正在重新生成...');
        // 如果没有token，尝试重新solve
        await solveCapChallenge();
      }
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
        // 登录失败后重置cap验证码
        await resetCapChallenge();
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
      // 网络错误后也重置cap验证码
      await resetCapChallenge();
    } finally {
      setLoading(false);
    }
  }, [capToken, capSolving, login, message, navigate, solveCapChallenge, resetCapChallenge]);

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
                  className={`login-button ${capSolving ? 'captcha-generating' : ''}`}
                  loading={loading || capSolving}
                  disabled={!capToken || capSolving}
                  block
                >
                  {loading ? <Spin size="small" /> : capSolving ? '正在准备验证码...' : '登录'}
                </Button>
              </Form.Item>

              {/* 隐藏模式：无需可见的cap-widget元素 */}
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