import React, { useEffect } from 'react';
import { Card, Tabs } from 'antd';
import { UserOutlined, InfoCircleOutlined } from '@ant-design/icons';
import UserManagement from './UserManagement';
import SystemInfo from './SystemInfo';

const Settings = () => {
  // Set page title
  useEffect(() => {
    document.title = '系统设置 - Momoka 图床';
  }, []);

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
      key: 'user-management',
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      children: <UserManagement />
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        defaultActiveKey="system-info"
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: '24px' }}
      />
    </div>
  );
};

export default Settings;