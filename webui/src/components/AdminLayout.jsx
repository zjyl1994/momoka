import React, { useState } from 'react';
import { ProLayout } from '@ant-design/pro-layout';
import { Avatar, Dropdown, Space } from 'antd';
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

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      title="Momoka 图床"
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
        title: user?.name || '管理员',
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
      actionsRender={() => [
        <BellOutlined key="bell" style={{ fontSize: '16px' }} />
      ]}
      menuProps={{
        selectedKeys: [location.pathname]
      }}
    >
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <Outlet />
      </div>
    </ProLayout>
  );
};

export default AdminLayout;