import React, { createContext, useContext, useState, useEffect } from 'react';

const SiteContext = createContext();

export const useSite = () => {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
};

export const SiteProvider = ({ children }) => {
  const [siteName, setSiteName] = useState('Momoka 图床');
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // 加载站点信息
  const loadSiteInfo = async () => {
    console.log('[SiteContext] loadSiteInfo called');
    try {
      // 添加时间戳防止缓存
      const timestamp = new Date().getTime();
      const url = `/api/auth-status?t=${timestamp}`;
      console.log('[SiteContext] Fetching:', url);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('[SiteContext] API response:', data);
        
        const newSiteName = data.site_name || 'Momoka 图床';
        const newIsDevMode = data.skip_auth || false;
        
        console.log('[SiteContext] Setting new values:', { newSiteName, newIsDevMode });
        setSiteName(newSiteName);
        setIsDevMode(newIsDevMode);
        setInitialized(true);
      } else {
        console.error('[SiteContext] API response not ok:', response.status);
      }
    } catch (error) {
      console.error('[SiteContext] Failed to load site info:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新站点名称（供设置页面调用）
  const updateSiteName = (newSiteName) => {
    console.log('[SiteContext] updateSiteName called with:', newSiteName);
    setSiteName(newSiteName);
    // 不在这里设置页面标题，让各个组件自己处理
  };

  useEffect(() => {
    console.log('[SiteContext] useEffect triggered, calling loadSiteInfo');
    loadSiteInfo();
  }, []);

  // 监听状态变化
  useEffect(() => {
    console.log('[SiteContext] siteName changed to:', siteName);
  }, [siteName]);

  useEffect(() => {
    console.log('[SiteContext] initialized changed to:', initialized);
  }, [initialized]);

  const value = {
    siteName,
    isDevMode,
    loading,
    initialized,
    updateSiteName,
    refreshSiteInfo: loadSiteInfo
  };

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  );
};