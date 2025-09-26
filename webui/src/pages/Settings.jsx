import React, { useEffect } from 'react';
import { Tabs } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import { UserOutlined, InfoCircleOutlined, CloudServerOutlined, LinkOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import UserManagement from './UserManagement';
import SystemInfo from './SystemInfo';
import BackupManagement from './BackupManagement';
import BaseUrlSettings from './BaseUrlSettings';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'system-info';

  // Set page title
  useEffect(() => {
    document.title = '系统设置 - Momoka 图床';
  }, []);

  // Handle tab change
  const handleTabChange = (key) => {
    setSearchParams({ tab: key });
  };

  const tabItems = [
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
  ];

  return (
    <div style={{ padding: '24px' }}>
      <ProCard title="系统设置" bordered>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="large"
          tabBarStyle={{ marginBottom: '24px' }}
        />
      </ProCard>
    </div>
  );
};

export default Settings;