import React, { useState, useEffect } from 'react';
import { ProLayout } from '@ant-design/pro-layout';
import { Dropdown, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  FileImageOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  SafetyOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.jsx';
import { getAuthConfig } from '../utils/api';

const AdminLayout = () => {
  const { user, logout, siteName, isDevMode, initialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState(['/admin/settings']);

  // 设置页面标题
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) {
      return;
    }
    
    // 根据当前路由设置不同的页面标题
    const getPageTitle = () => {
      const path = location.pathname;
      let pageTitle = '管理后台';
      
      if (path === '/admin') {
        pageTitle = '仪表板';
      } else if (path === '/admin/images-upload') {
        pageTitle = '上传图片';
      } else if (path === '/admin/images') {
        pageTitle = '图片管理';
      } else if (path === '/admin/settings') {
        pageTitle = '系统设置';
      }
      
      return `${pageTitle} - ${siteName}`;
    };

    const newTitle = getPageTitle();
    document.title = newTitle;
  }, [location.pathname, siteName, initialized]);

  // 处理退出登录
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  // 菜单配置
  const menuData = [
    {
      path: '/admin',
      name: '仪表板',
      key: '/admin',
      icon: <DashboardOutlined />
    },
    {
      path: '/admin/images-upload',
      name: '上传图片',
      key: '/admin/images-upload',
      icon: <CloudUploadOutlined />
    },
    {
      path: '/admin/images',
      name: '图片管理',
      key: '/admin/images',
      icon: <FileImageOutlined />
    },
    {
      path: '/admin/settings',
      name: '系统设置',
      key: '/admin/settings',
      icon: <SettingOutlined />,
      children: [
        {
          path: '/admin/settings/basic-info',
          name: '基础信息',
          key: '/admin/settings/basic-info',
          icon: <SettingOutlined />
        },
        {
          path: '/admin/settings/system-info',
          name: '系统信息',
          key: '/admin/settings/system-info',
          icon: <InfoCircleOutlined />
        },
        {
          path: '/admin/settings/feature-settings',
          name: '功能设置',
          key: '/admin/settings/feature-settings',
          icon: <PictureOutlined />
        },
        {
          path: '/admin/settings/security-settings',
          name: '安全管理',
          key: '/admin/settings/security-settings',
          icon: <SafetyOutlined />
        },
        {
          path: '/admin/settings/data-management',
          name: '数据管理',
          key: '/admin/settings/data-management',
          icon: <DatabaseOutlined />
        }
      ]
    }
  ];

  return (
    <ProLayout
      title={
        <Space>
          <span>{siteName}</span>
          {isDevMode && (
            <Tag color="orange" style={{ fontSize: '12px' }}>
              开发模式
            </Tag>
          )}
        </Space>
      }
      logo={false}
      layout="mix"
      navTheme="dark"
      primaryColor="#1890ff"
      fixedHeader
      fixSiderbar
      colorWeak={false}
      route={{
        routes: menuData
      }}
      location={{
        pathname: location.pathname
      }}
      menuItemRender={(item, dom) => (
        <div
          onClick={() => {
            navigate(item.path || '/admin');
          }}
        >
          {dom}
        </div>
      )}
      avatarProps={{
        src: null,
        size: 'small',
        icon: <UserOutlined />,
        render: (props, dom) => {
          return (
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer', padding: '8px' }}>
                {dom}
                <span style={{ fontWeight: 500 }}>{user?.name || '管理员'}</span>
              </Space>
            </Dropdown>
          );
        }
      }}
      menuProps={{
        selectedKeys: [location.pathname],
        openKeys: openKeys,
        onOpenChange: setOpenKeys
      }}
    >
      <Outlet />
    </ProLayout>
  );
};

export default AdminLayout;