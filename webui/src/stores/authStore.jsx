import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { validateToken, set401Handler, checkAuthStatus, clearAuthStatusCache } from '../utils/api';

// 初始状态
const initialState = {
  // 认证状态
  isAuthenticated: false,
  user: null,
  
  // 站点配置
  siteName: 'Momoka 图床',
  isDevMode: false,
  skipAuth: false,
  
  // 加载状态
  loading: true,
  initialized: false,
  
  // 错误状态
  error: null
};

// Action 类型
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_AUTH_STATUS: 'SET_AUTH_STATUS',
  SET_USER: 'SET_USER',
  SET_SITE_CONFIG: 'SET_SITE_CONFIG',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  RESET: 'RESET'
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
      
    case ActionTypes.SET_AUTH_STATUS:
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        skipAuth: action.payload.skipAuth,
        loading: false,
        initialized: true,
        error: null
      };
      
    case ActionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload
      };
      
    case ActionTypes.SET_SITE_CONFIG:
      return {
        ...state,
        siteName: action.payload.siteName || state.siteName,
        isDevMode: action.payload.isDevMode || state.isDevMode
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
      
    case ActionTypes.LOGOUT:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        error: null
      };
      
    case ActionTypes.RESET:
      return { ...initialState };
      
    default:
      return state;
  }
};

// Context
const AuthStoreContext = createContext();

// Hook
export const useAuthStore = () => {
  const context = useContext(AuthStoreContext);
  if (!context) {
    throw new Error('useAuthStore must be used within an AuthStoreProvider');
  }
  return context;
};

// Provider 组件
export const AuthStoreProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Actions
  const actions = {
    setLoading: (loading) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
    },

    setAuthStatus: (isAuthenticated, skipAuth = false) => {
      dispatch({ 
        type: ActionTypes.SET_AUTH_STATUS, 
        payload: { isAuthenticated, skipAuth } 
      });
    },

    setUser: (user) => {
      dispatch({ type: ActionTypes.SET_USER, payload: user });
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    },

    setSiteConfig: (config) => {
      dispatch({ type: ActionTypes.SET_SITE_CONFIG, payload: config });
    },

    setError: (error) => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
    },

    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearAuthStatusCache();
      dispatch({ type: ActionTypes.LOGOUT });
    },

    reset: () => {
      clearAuthStatusCache();
      dispatch({ type: ActionTypes.RESET });
    },

    // 统一的初始化方法
    initialize: async () => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        
        // 获取后端认证配置
        const authStatus = await checkAuthStatus();
        console.log('[AuthStore] Auth status:', authStatus);
        
        // 设置站点配置
        actions.setSiteConfig({
          siteName: authStatus.site_name || 'Momoka 图床',
          isDevMode: authStatus.skip_auth || false
        });
        
        if (authStatus.skip_auth) {
          // SkipAuth 模式：直接设置为已认证状态
          actions.setAuthStatus(true, true);
          actions.setUser({ 
            username: 'admin', 
            name: '管理员 (开发模式)' 
          });
          console.log('[AuthStore] Skip auth mode enabled');
          return;
        }
        
        // 正常认证模式：检查本地 token
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
          // 验证token是否有效
          const isValid = await validateToken();
          if (isValid) {
            actions.setAuthStatus(true, false);
            actions.setUser(JSON.parse(userData));
            console.log('[AuthStore] Token validated, user authenticated');
          } else {
            // Token无效，清除本地数据
            actions.logout();
            console.log('[AuthStore] Token invalid, logged out');
          }
        } else {
          // 没有token，设置为未认证状态
          actions.setAuthStatus(false, false);
          console.log('[AuthStore] No token found, not authenticated');
        }
        
      } catch (error) {
        console.error('[AuthStore] Initialization error:', error);
        actions.setError(error.message);
      }
    },

    // 刷新站点信息
    refreshSiteInfo: async () => {
      try {
        clearAuthStatusCache();
        const authStatus = await checkAuthStatus();
        actions.setSiteConfig({
          siteName: authStatus.site_name || 'Momoka 图床',
          isDevMode: authStatus.skip_auth || false
        });
        console.log('[AuthStore] Site info refreshed');
      } catch (error) {
        console.error('[AuthStore] Failed to refresh site info:', error);
        actions.setError(error.message);
      }
    },

    // 登录方法
    login: async (username, password, remember = false, capToken = '') => {
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
            cap_token: capToken,
            set_cookie: false // 使用localStorage而不是cookie
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            const userData = { username, name: username };
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(userData));
            
            actions.setUser(userData);
            actions.setAuthStatus(true, false);
            
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
        console.error('[AuthStore] Login error:', error);
        return { success: false, message: '网络错误，请重试' };
      }
    },

    // 更新站点名称
    updateSiteName: async (newSiteName) => {
      try {
        const response = await fetch('/api/admin/site-name', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ site_name: newSiteName })
        });

        if (response.ok) {
          actions.setSiteConfig({
            siteName: newSiteName,
            isDevMode: state.isDevMode
          });
          return { success: true };
        } else {
          const errorData = await response.json();
          return { success: false, message: errorData.error || '更新失败' };
        }
      } catch (error) {
        console.error('[AuthStore] Update site name error:', error);
        return { success: false, message: '网络错误，请重试' };
      }
    }
  };

  // 处理401错误
  const handle401Error = () => {
    console.log('[AuthStore] 401 error detected, logging out');
    actions.logout();
  };

  // 初始化
  useEffect(() => {
    // 设置全局401错误处理器
    set401Handler(handle401Error);
    
    // 初始化认证状态
    actions.initialize();
  }, []);

  const value = {
    // 状态
    ...state,
    
    // Actions
    ...actions
  };

  return (
    <AuthStoreContext.Provider value={value}>
      {children}
    </AuthStoreContext.Provider>
  );
};

export default useAuthStore;