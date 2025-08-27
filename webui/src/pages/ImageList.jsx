import React, { useState, useEffect } from 'react';
import { Table, Card, Image, Button, Space, Input, Popconfirm, message } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Search } = Input;

const ImageList = () => {
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [images, setImages] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取图片列表
  const fetchImages = async (page = 1, size = 10, keyword = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        ...(keyword && { keyword })
      });
      
      const response = await authFetch(`/admin-api/image/all?${params}`);
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
        setTotal(data.total || 0);
      } else {
        message.error('获取图片列表失败');
      }
    } catch (error) {
      console.error('获取图片列表失败:', error);
      message.error('获取图片列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages(currentPage, pageSize, searchText);
  }, [currentPage, pageSize, searchText]);

  const handleDelete = async (id) => {
    try {
      const response = await authFetch(`/admin-api/image?id=${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        message.success('图片删除成功');
        fetchImages(currentPage, pageSize, searchText);
      } else {
        message.error('删除图片失败');
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      message.error('删除图片失败');
    }
  };

  const handleView = (record) => {
    const imageUrl = record.url;
    window.open(imageUrl, '_blank');
  };

  const handleDownload = (record) => {
    const imageUrl = record.url;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = record.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('开始下载图片');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('URL已复制到剪贴板');
    } catch (err) {
      message.error('复制失败');
    }
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
          src={record.url}
          alt={record.file_name}
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
            {record.file_name}
          </div>
          <div 
            style={{ 
              color: '#666', 
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => handleCopyUrl(record.url)}
            title="点击复制URL"
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.url}
            </span>
            {/* <CopyOutlined style={{ color: '#1890ff', fontSize: '12px' }} /> */}
          </div>
        </div>
      )
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => formatFileSize(size)
    },
    {
      title: '上传时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 150,
      render: (timestamp) => formatTime(timestamp)
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

  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  return (
    <Card title="图片列表" style={{ height: '100%', borderRadius: 0, border: 'none' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Search
          placeholder="搜索图片名称"
          allowClear
          style={{ width: 300 }}
          onSearch={handleSearch}
          onChange={(e) => {
            if (e.target.value === '') {
              setSearchText('');
              setCurrentPage(1);
            }
          }}
        />
        <Button type="primary" onClick={() => window.location.href = '/admin/images/upload'}>
          上传图片
        </Button>
      </div>
        
        <Table
          columns={columns}
          dataSource={images}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }
          }}
        />
    </Card>
  );
};

export default ImageList;