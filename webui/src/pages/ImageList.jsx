import React, { useState } from 'react';
import { Table, Card, Image, Button, Space, Tag, Input, Select, Popconfirm, message } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;

const ImageList = () => {
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 模拟数据
  const [images] = useState([
    {
      id: 1,
      filename: 'image1.jpg',
      originalName: '风景照片.jpg',
      size: '2.5 MB',
      dimensions: '1920x1080',
      uploadTime: '2024-01-15 10:30:00',
      status: 'active',
      views: 125,
      downloads: 45,
      url: 'https://via.placeholder.com/150x100/1890ff/ffffff?text=Image1'
    },
    {
      id: 2,
      filename: 'photo.png',
      originalName: '头像.png',
      size: '1.8 MB',
      dimensions: '800x600',
      uploadTime: '2024-01-15 09:15:00',
      status: 'active',
      views: 89,
      downloads: 23,
      url: 'https://via.placeholder.com/150x100/52c41a/ffffff?text=Image2'
    },
    {
      id: 3,
      filename: 'screenshot.jpg',
      originalName: '屏幕截图.jpg',
      size: '3.2 MB',
      dimensions: '1366x768',
      uploadTime: '2024-01-15 08:45:00',
      status: 'processing',
      views: 0,
      downloads: 0,
      url: 'https://via.placeholder.com/150x100/faad14/ffffff?text=Image3'
    }
  ]);

  const handleDelete = (id) => {
    message.success('图片删除成功');
  };

  const handleView = (record) => {
    window.open(record.url, '_blank');
  };

  const handleDownload = (record) => {
    message.success('开始下载图片');
  };

  const columns = [
    {
      title: '预览',
      dataIndex: 'url',
      key: 'preview',
      width: 100,
      render: (url, record) => (
        <Image
          width={60}
          height={40}
          src={url}
          alt={record.filename}
          style={{ objectFit: 'cover', borderRadius: '4px' }}
        />
      )
    },
    {
      title: '文件信息',
      key: 'fileInfo',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>
            {record.originalName}
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.filename} • {record.size} • {record.dimensions}
          </div>
        </div>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          active: { color: 'green', text: '正常' },
          processing: { color: 'blue', text: '处理中' },
          error: { color: 'red', text: '错误' }
        };
        const config = statusConfig[status] || statusConfig.active;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '统计',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div><EyeOutlined /> {record.views}</div>
          <div><DownloadOutlined /> {record.downloads}</div>
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
            title="查看"
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            title="下载"
          />
          <Popconfirm
            title="确定要删除这张图片吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="删除"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const filteredImages = images.filter(image => {
    const matchesSearch = image.originalName.toLowerCase().includes(searchText.toLowerCase()) ||
                         image.filename.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || image.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>图片列表</h2>
          <Button type="primary" onClick={() => window.location.href = '/admin/images/upload'}>
            上传图片
          </Button>
        </div>
        
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
          <Search
            placeholder="搜索图片名称或文件名"
            allowClear
            style={{ width: 300 }}
            onSearch={setSearchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="active">正常</Option>
            <Option value="processing">处理中</Option>
            <Option value="error">错误</Option>
          </Select>
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredImages}
          rowKey="id"
          loading={loading}
          pagination={{
            total: filteredImages.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      </Card>
    </div>
  );
};

export default ImageList;