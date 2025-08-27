import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateToken } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        // 验证token是否有效
        const isValid = await validateToken();
        if (isValid) {
          setIsAuthenticated(true);
          setUser(JSON.parse(userData));
        } else {
          // token无效，清除本地存储
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (username, password, remember = false) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          remember,
          set_cookie: false // 使用localStorage而不是cookie
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          const userData = { username, name: username };
          
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(userData));
          
          setIsAuthenticated(true);
          setUser(userData);
          
          return { success: true };
        } else {
          return { success: false, message: data.error || '登录失败' };
        }
      } else {
        // 处理HTTP错误状态
        let errorMessage = '登录失败';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          // 如果响应不是JSON格式，尝试获取文本
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: '网络错误，请重试' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};