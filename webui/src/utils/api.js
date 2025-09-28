// API工具函数

// 全局401错误处理回调
let global401Handler = null;

// 认证状态缓存
let authStatusCache = null;

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

// 检查后端的认证状态
export const checkAuthStatus = async () => {
  // 首先检查内存缓存
  if (authStatusCache) {
    return authStatusCache;
  }
  
  // 检查localStorage缓存
  try {
    const cachedData = localStorage.getItem('auth_status_cache');
    const cachedTimestamp = localStorage.getItem('auth_status_cache_timestamp');
    
    if (cachedData && cachedTimestamp) {
      const now = Date.now();
      const cacheAge = now - parseInt(cachedTimestamp);
      const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存时间
      
      if (cacheAge < CACHE_DURATION) {
        const parsedData = JSON.parse(cachedData);
        authStatusCache = parsedData; // 同时更新内存缓存
        console.log('[API] Using cached auth status from localStorage');
        return parsedData;
      } else {
        // 缓存过期，清除localStorage中的过期数据
        localStorage.removeItem('auth_status_cache');
        localStorage.removeItem('auth_status_cache_timestamp');
        console.log('[API] Auth status cache expired, cleared from localStorage');
      }
    }
  } catch (error) {
    console.error('[API] Error reading auth status cache from localStorage:', error);
    // 清除可能损坏的缓存数据
    localStorage.removeItem('auth_status_cache');
    localStorage.removeItem('auth_status_cache_timestamp');
  }
  
  // 从服务器获取新数据
  try {
    console.log('[API] Fetching fresh auth status from server');
    const response = await fetch('/api/auth-status');
    if (!response.ok) {
      throw new Error('Failed to fetch auth status');
    }
    const data = await response.json();
    
    // 更新内存缓存
    authStatusCache = data;
    
    // 保存到localStorage
    try {
      localStorage.setItem('auth_status_cache', JSON.stringify(data));
      localStorage.setItem('auth_status_cache_timestamp', Date.now().toString());
      console.log('[API] Auth status cached to localStorage');
    } catch (storageError) {
      console.error('[API] Failed to cache auth status to localStorage:', storageError);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking auth status:', error);
    // 出错时，默认为需要认证
    return { skip_auth: false };
  }
};

// 获取认证配置（用于其他模块）
export const getAuthConfig = () => authStatusCache;

// 清除认证状态缓存（用于强制重新获取）
export const clearAuthStatusCache = () => {
  // 清除内存缓存
  authStatusCache = null;
  
  // 清除localStorage缓存
  try {
    localStorage.removeItem('auth_status_cache');
    localStorage.removeItem('auth_status_cache_timestamp');
    console.log('[API] Cleared auth status cache from both memory and localStorage');
  } catch (error) {
    console.error('[API] Error clearing auth status cache from localStorage:', error);
  }
};