// API工具函数

// 获取token
export const getToken = () => {
  return localStorage.getItem('token');
};

// 创建带认证的fetch请求
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  const response = await fetch(url, config);
  
  // 如果token过期或无效，清除本地存储
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // 可以在这里触发重新登录
    window.location.href = '/login';
  }
  
  return response;
};

// 验证token是否有效
export const validateToken = async () => {
  const token = getToken();
  if (!token) {
    return false;
  }
  
  try {
    // 可以调用一个验证token的接口，这里暂时返回true
    // 实际项目中可以调用 /api/validate-token 或类似接口
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};