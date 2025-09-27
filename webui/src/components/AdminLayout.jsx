import React, { useState, useEffect } from 'react';
import { ProLayout } from '@ant-design/pro-layout';
import { Avatar, Dropdown, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  FileImageOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuthConfig } from '../utils/api';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDevMode, setIsDevMode] = useState(false);

  // 检查是否为开发模式
  useEffect(() => {
    const checkDevMode = async () => {
      const authConfig = getAuthConfig();
      if (authConfig && authConfig.skip_auth) {
        setIsDevMode(true);
      }
    };
    checkDevMode();
  }, []);

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
      icon: <DashboardOutlined />
    },
    {
      path: '/admin/images-upload',
      name: '上传图片',
      icon: <CloudUploadOutlined />
    },
    {
      path: '/admin/images',
      name: '图片管理',
      icon: <FileImageOutlined />
    },
    {
      path: '/admin/settings',
      name: '系统设置',
      icon: <SettingOutlined />
    }
  ];

  return (
    <ProLayout
      title={
        <Space>
          <span>Momoka 图床</span>
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
        selectedKeys: [location.pathname]
      }}
    >
      <Outlet />
    </ProLayout>
  );
};

export default AdminLayout;