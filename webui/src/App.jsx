import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ImageList from './pages/ImageList';
import ImageUpload from './pages/ImageUpload';
import FileManager from './pages/FileManager';
import './App.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* 登录页面 */}
            <Route path="/login" element={<Login />} />
            
            {/* 受保护的管理后台路由 */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              {/* 仪表板 */}
              <Route index element={<Dashboard />} />
              
              {/* 图片管理 */}
              <Route path="images">
                <Route path="list" element={<ImageList />} />
                <Route path="upload" element={<ImageUpload />} />
              </Route>
              
              {/* 文件夹管理 */}
              <Route path="folders" element={<FileManager />} />
              
              <Route path="users" element={
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <h2>用户管理</h2>
                  <p>功能开发中...</p>
                </div>
              } />
              
              <Route path="analytics" element={
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <h2>数据统计</h2>
                  <p>功能开发中...</p>
                </div>
              } />
              
              <Route path="tags" element={
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <h2>标签管理</h2>
                  <p>功能开发中...</p>
                </div>
              } />
              
              <Route path="settings" element={
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <h2>系统设置</h2>
                  <p>功能开发中...</p>
                </div>
              } />
            </Route>
            
            {/* 根路径重定向到管理后台 */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            
            {/* 404 页面 */}
            <Route path="*" element={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column'
              }}>
                <h1>404</h1>
                <p>页面不存在</p>
                <a href="/admin">返回首页</a>
              </div>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
