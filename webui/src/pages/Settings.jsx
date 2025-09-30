import React, { useEffect, useCallback, useMemo } from 'react';
import { Tabs, Card } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import { UserOutlined, InfoCircleOutlined, CloudServerOutlined, LinkOutlined, EditOutlined, PictureOutlined, SettingOutlined, SafetyOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import UserManagement from './UserManagement';
import SystemInfo from './SystemInfo';
import BackupManagement from './BackupManagement';
import BaseUrlSettings from './BaseUrlSettings';
import SiteNameSettings from './SiteNameSettings';
import ImageConversionSettings from './ImageConversionSettings';
import { useAuthStore } from '../stores/authStore.jsx';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'basic-settings';
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
      key: 'basic-settings',
      icon: <SettingOutlined />,
      label: '基础设置',
      children: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '0 4px' // 移动端边距优化
        }}>
          <Card
            title="系统信息"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <SystemInfo />
          </Card>
          <Card
            title="站点配置"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <SiteNameSettings />
          </Card>
          <Card
            title="基础URL配置"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <BaseUrlSettings />
          </Card>
        </div>
      ),
    },
    {
      key: 'feature-settings',
      icon: <PictureOutlined />,
      label: '功能设置',
      children: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '0 4px'
        }}>
          <Card
            title="图像转换设置"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <ImageConversionSettings />
          </Card>
        </div>
      ),
    },
    {
      key: 'security-settings',
      icon: <SafetyOutlined />,
      label: '安全管理',
      children: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '0 4px'
        }}>
          <Card
            title="用户管理"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <UserManagement />
          </Card>
        </div>
      ),
    },
    {
      key: 'data-management',
      icon: <DatabaseOutlined />,
      label: '数据管理',
      children: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '0 4px'
        }}>
          <Card
            title="备份管理"
            size="small"
            style={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0'
            }}
          >
            <BackupManagement />
          </Card>
        </div>
      ),
    },
  ], []);

  return (
    <ProCard title="系统设置" headerBordered>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        tabPosition="top"
        size="large"
        style={{
          '--tabs-card-gutter': '16px',
        }}
        tabBarStyle={{
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px', // 添加tab之间的间隔
        }}
        tabBarGutter={16} // 增加tab按钮之间的间隔
        moreIcon={null}
        // 移动端优化：当屏幕宽度小于768px时，标签页会自动换行
        responsive={{
          xs: { tabPosition: 'top', size: 'default' },
          sm: { tabPosition: 'top', size: 'default' },
          md: { tabPosition: 'top', size: 'large' },
          lg: { tabPosition: 'top', size: 'large' },
        }}
      />
    </ProCard>
  );
};

export default Settings;