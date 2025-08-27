import React, { useState } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileImageOutlined,
  FolderOutlined,
  SettingOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 菜单项配置
  const menuItems = [
    {
      key: '/admin',
      icon: <DashboardOutlined />,
      label: '仪表板'
    },
    {
      key: '/admin/images/upload',
      icon: <CloudUploadOutlined />,
      label: '上传图片'
    },
    {
      key: '/admin/images/list',
      icon:<FileImageOutlined/>,
      label: '图片列表'
    },
    {
      key: '/admin/folders',
      icon: <FolderOutlined />,
      label: '文件夹管理'
    },
    {
      key: '/admin/analytics',
      icon: <BarChartOutlined />,
      label: '数据统计'
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ];

  // 处理菜单点击
  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const pathname = location.pathname;
    // 如果是精确匹配，直接返回
    if (menuItems.find(item => item.key === pathname)) {
      return [pathname];
    }

    // 检查子菜单
    for (const item of menuItems) {
      if (item.children) {
        const childMatch = item.children.find(child => child.key === pathname);
        if (childMatch) {
          return [pathname];
        }
      }
    }

    // 默认选中仪表板
    return ['/admin'];
  };

  // 获取展开的菜单项
  const getOpenKeys = () => {
    const pathname = location.pathname;
    const openKeys = [];

    for (const item of menuItems) {
      if (item.children) {
        const hasActiveChild = item.children.some(child =>
          pathname.startsWith(child.key)
        );
        if (hasActiveChild) {
          openKeys.push(item.key);
        }
      }
    }

    return openKeys;
  };

  return (
    <div style={{ height: '100%', borderRight: 0 }}>
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#001529'
        }}
      >
        {!collapsed && (
          <h2 style={{
            color: '#fff',
            margin: 0,
            fontSize: '18px',
            fontWeight: 600
          }}>
            Momoka
          </h2>
        )}
        {collapsed && (
          <div style={{
            width: '32px',
            height: '32px',
            background: '#1890ff',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            M
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        style={{
          height: 'calc(100% - 64px)',
          borderRight: 0,
          background: '#001529'
        }}
        items={menuItems}
        onClick={handleMenuClick}
        inlineCollapsed={collapsed}
      />
    </div>
  );
};

export default Sidebar;