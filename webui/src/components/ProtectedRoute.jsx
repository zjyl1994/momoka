import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../stores/authStore.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <Spin size="large" tip="加载中..." spinning={true}>
          <div style={{ minHeight: '200px' }} />
        </Spin>
      </div>
    );
  }

  if (!isAuthenticated) {
    // 保存用户尝试访问的页面，登录后重定向
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;