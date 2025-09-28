import React, { useEffect, useCallback, useMemo } from 'react';
import { Tabs } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import { UserOutlined, InfoCircleOutlined, CloudServerOutlined, LinkOutlined, EditOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import UserManagement from './UserManagement';
import SystemInfo from './SystemInfo';
import BackupManagement from './BackupManagement';
import BaseUrlSettings from './BaseUrlSettings';
import SiteNameSettings from './SiteNameSettings';
import { useAuthStore } from '../stores/authStore.jsx';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'system-info';
  const { siteName, initialized } = useAuthStore();

  // Set page title
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) return;
    document.title = `系统设置 - ${siteName}`;
  }, [siteName, initialized]);

  // Handle tab change - 使用useCallback优化性能
  const handleTabChange = useCallback((key) => {
    setSearchParams({ tab: key });
  }, [setSearchParams]);

  // Tab配置 - 使用useMemo优化性能
  const tabItems = useMemo(() => [
    {
      key: 'system-info',
      label: (
        <span>
          <InfoCircleOutlined />
          系统信息
        </span>
      ),
      children: <SystemInfo />
    },
    {
      key: 'site-name-settings',
      label: (
        <span>
          <EditOutlined />
          站点名称
        </span>
      ),
      children: <SiteNameSettings />
    },
    {
      key: 'base-url-settings',
      label: (
        <span>
          <LinkOutlined />
          基础URL配置
        </span>
      ),
      children: <BaseUrlSettings />
    },
    {
      key: 'user-management',
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      children: <UserManagement />
    },
    {
      key: 'backup-management',
      label: (
        <span>
          <CloudServerOutlined />
          备份管理
        </span>
      ),
      children: <BackupManagement />
    },
  ], []);

  return (
    <ProCard title="系统设置" bordered>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: '24px' }}
      />
    </ProCard>
  );
};

export default Settings;