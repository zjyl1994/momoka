import React, { useEffect, useState, useRef } from 'react';
import { Row, Col, Statistic, Progress, Table, message, Tooltip, Image } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import {
  FileImageOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { authFetch } from '../utils/api';
import { useSite } from '../contexts/SiteContext';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    image_count: 0,
    image_size: 0,
    cache_count: 0,
    cache_size: 0
  });
  const [statData, setStatData] = useState({
    load: { load1: 0, load5: 0, load15: 0 },
    mem: { total: 0, used: 0, free: 0 },
    disk: { total: 0, used: 0, free: 0, percent: 0 },
    boot_time: 0,
    uptime: 0
  });
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);
  const { siteName, initialized } = useSite();

  // Set page title
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) return;
    document.title = `仪表板 - ${siteName}`;
  }, [siteName, initialized]);

  // Fetch dashboard data
  useEffect(() => {
    if (hasFetched.current) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await authFetch('/admin-api/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const data = await response.json();
        setDashboardData(data.count);
        setStatData(data.stat);
        hasFetched.current = true;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        message.error('获取仪表板数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format bytes to human readable format
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = [
    {
      title: '图片总数',
      value: dashboardData.image_count,
      icon: <FileImageOutlined style={{ color: '#1890ff' }} />,
      color: '#1890ff'
    },
    {
      title: '图片总容量',
      value: formatBytes(dashboardData.image_size),
      icon: <CloudUploadOutlined style={{ color: '#52c41a' }} />,
      color: '#52c41a'
    },
    {
      title: '缓存文件数',
      value: dashboardData.cache_count,
      icon: <FileImageOutlined style={{ color: '#722ed1' }} />,
      color: '#722ed1'
    },
    {
      title: '缓存占用空间',
      value: formatBytes(dashboardData.cache_size),
      icon: <CloudUploadOutlined style={{ color: '#eb2f96' }} />,
      color: '#eb2f96'
    }
  ];

  return (
    <ProCard
      title="仪表板"
      headerBordered
      style={{ marginBottom: '24px' }}
    >
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <ProCard loading={loading} hoverable>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
            </ProCard>
          </Col>
        ))}
      </Row>
      {/* 系统状态 */}
      <Row gutter={[16, 16]}>
        {/* 系统负载 */}
        <Col xs={24} lg={8}>
          <ProCard title="系统负载" loading={loading} style={{ height: '300px' }} headerBordered>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>1分钟负载</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1890ff' }}>{statData.load.load1.toFixed(2)}</span>
                </div>
                <Progress
                  percent={Math.min(statData.load.load1 * 25, 100)}
                  size="small"
                  strokeColor={statData.load.load1 > 2 ? '#ff4d4f' : statData.load.load1 > 1 ? '#faad14' : '#52c41a'}
                  showInfo={false}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>5分钟负载</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#52c41a' }}>{statData.load.load5.toFixed(2)}</span>
                </div>
                <Progress
                  percent={Math.min(statData.load.load5 * 25, 100)}
                  size="small"
                  strokeColor={statData.load.load5 > 2 ? '#ff4d4f' : statData.load.load5 > 1 ? '#faad14' : '#52c41a'}
                  showInfo={false}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>15分钟负载</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#faad14' }}>{statData.load.load15.toFixed(2)}</span>
                </div>
                <Progress
                  percent={Math.min(statData.load.load15 * 25, 100)}
                  size="small"
                  strokeColor={statData.load.load15 > 2 ? '#ff4d4f' : statData.load.load15 > 1 ? '#faad14' : '#52c41a'}
                  showInfo={false}
                />
              </div>
            </div>
          </ProCard>
        </Col>
        {/* 磁盘使用情况 */}
        <Col xs={24} lg={8}>
          <ProCard title="磁盘使用情况" loading={loading} style={{ height: '300px' }} headerBordered>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>磁盘使用率</span>
                </div>
                <Progress percent={statData.disk.percent.toFixed(2)} strokeColor="#faad14" />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><DatabaseOutlined /> 总容量</span>
                  <span style={{ fontWeight: 600, color: '#1890ff' }}>{formatBytes(statData.disk.total)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><DatabaseOutlined /> 已使用</span>
                  <span style={{ fontWeight: 600, color: '#f5222d' }}>{formatBytes(statData.disk.used)}</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><DatabaseOutlined /> 可用空间</span>
                  <span style={{ fontWeight: 600, color: '#52c41a' }}>{formatBytes(statData.disk.free)}</span>
                </div>
              </div>
            </div>
          </ProCard>
        </Col>

        {/* 内存使用情况 */}
        <Col xs={24} lg={8}>
          <ProCard title="内存使用情况" loading={loading} style={{ height: '300px' }} headerBordered>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={Math.round((statData.mem.used / statData.mem.total) * 100)}
                format={(percent) => `${percent}%`}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                size={120}
              />
              <div style={{ marginTop: '16px' }}>
                <p style={{ margin: 0, color: '#666' }}>
                  已使用 {formatBytes(statData.mem.used)} / {formatBytes(statData.mem.total)}
                </p>
                <p style={{ margin: 0, color: '#666', marginTop: '8px' }}>
                  可用 {formatBytes(statData.mem.free)}
                </p>
              </div>
            </div>
          </ProCard>
        </Col>
      </Row>
    </ProCard>
  );
};

export default Dashboard;