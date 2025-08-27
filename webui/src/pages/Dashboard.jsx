import React from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag } from 'antd';
import {
  UserOutlined,
  FileImageOutlined,
  FolderOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';

const Dashboard = () => {
  // 模拟数据
  const stats = [
    {
      title: '总用户数',
      value: 1234,
      icon: <UserOutlined style={{ color: '#1890ff' }} />,
      color: '#1890ff'
    },
    {
      title: '图片总数',
      value: 5678,
      icon: <FileImageOutlined style={{ color: '#52c41a' }} />,
      color: '#52c41a'
    },
    {
      title: '文件夹数',
      value: 89,
      icon: <FolderOutlined style={{ color: '#faad14' }} />,
      color: '#faad14'
    },
    {
      title: '今日上传',
      value: 156,
      icon: <CloudUploadOutlined style={{ color: '#f5222d' }} />,
      color: '#f5222d'
    }
  ];

  const recentUploads = [
    {
      key: '1',
      filename: 'image1.jpg',
      size: '2.5 MB',
      uploadTime: '2024-01-15 10:30:00',
      status: 'success',
      views: 125
    },
    {
      key: '2',
      filename: 'photo.png',
      size: '1.8 MB',
      uploadTime: '2024-01-15 09:15:00',
      status: 'success',
      views: 89
    },
    {
      key: '3',
      filename: 'screenshot.jpg',
      size: '3.2 MB',
      uploadTime: '2024-01-15 08:45:00',
      status: 'processing',
      views: 0
    },
    {
      key: '4',
      filename: 'avatar.png',
      size: '512 KB',
      uploadTime: '2024-01-15 08:20:00',
      status: 'success',
      views: 234
    }
  ];

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size'
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          success: { color: 'green', text: '成功' },
          processing: { color: 'blue', text: '处理中' },
          error: { color: 'red', text: '失败' }
        };
        const config = statusConfig[status] || statusConfig.success;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '查看次数',
      dataIndex: 'views',
      key: 'views',
      render: (views) => (
        <span>
          <EyeOutlined style={{ marginRight: 4 }} />
          {views}
        </span>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 600 }}>仪表板</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 存储使用情况 */}
        <Col xs={24} lg={8}>
          <Card title="存储使用情况" style={{ height: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={68}
                format={(percent) => `${percent}%`}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                size={120}
              />
              <div style={{ marginTop: '16px' }}>
                <p style={{ margin: 0, color: '#666' }}>已使用 6.8 GB / 10 GB</p>
              </div>
            </div>
          </Card>
        </Col>

        {/* 今日统计 */}
        <Col xs={24} lg={8}>
          <Card title="今日统计" style={{ height: '300px' }}>
            <div style={{ padding: '16px 0' }}>
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><CloudUploadOutlined /> 上传次数</span>
                    <span style={{ fontWeight: 600, color: '#1890ff' }}>156</span>
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><EyeOutlined /> 查看次数</span>
                    <span style={{ fontWeight: 600, color: '#52c41a' }}>2,345</span>
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><DownloadOutlined /> 下载次数</span>
                    <span style={{ fontWeight: 600, color: '#faad14' }}>789</span>
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><UserOutlined /> 新用户</span>
                    <span style={{ fontWeight: 600, color: '#f5222d' }}>12</span>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* 系统状态 */}
        <Col xs={24} lg={8}>
          <Card title="系统状态" style={{ height: '300px' }}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>CPU 使用率</span>
                  <span>45%</span>
                </div>
                <Progress percent={45} strokeColor="#1890ff" />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>内存使用率</span>
                  <span>72%</span>
                </div>
                <Progress percent={72} strokeColor="#52c41a" />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>磁盘使用率</span>
                  <span>68%</span>
                </div>
                <Progress percent={68} strokeColor="#faad14" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近上传 */}
      <Card title="最近上传" style={{ marginTop: '24px' }}>
        <Table
          columns={columns}
          dataSource={recentUploads}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default Dashboard;