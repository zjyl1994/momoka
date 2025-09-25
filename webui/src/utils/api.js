// API工具函数

// 全局401错误处理回调
let global401Handler = null;

// 设置全局401错误处理回调
export const set401Handler = (handler) => {
  global401Handler = handler;
};

// 获取token
export const getToken = () => {
  return localStorage.getItem('token');
};

// 创建带认证的fetch请求
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  const defaultHeaders = {};
  
  // 如果不是FormData，则设置Content-Type为application/json
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }
  
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
  
  // 如果token过期或无效，触发401错误处理
  if (response.status === 401) {
    if (global401Handler) {
      global401Handler();
    } else {
      // 如果没有设置全局处理器，则清除本地存储并跳转
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
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