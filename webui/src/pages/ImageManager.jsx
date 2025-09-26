import React, { useState, useEffect, useRef } from 'react';
import { 
  Button, 
  message, 
  Modal, 
  Input, 
  Space, 
  Typography, 
  Tag,
  Select,
  Image,
  Tooltip,
  Popconfirm,
  Layout
} from 'antd';
import { ProTable } from '@ant-design/pro-table';
import { ProCard } from '@ant-design/pro-card';

const { Content } = Layout;
import { 
  DeleteOutlined, 
  EditOutlined, 
  EyeOutlined, 
  SearchOutlined,
  TagsOutlined,
  CopyOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Search } = Input;
const { Text } = Typography;

const ImageManager = () => {
  const actionRef = useRef();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [tags, setTags] = useState({});
  const [selectedTag, setSelectedTag] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', remark: '', tags: [] });
  const [tagInputValue, setTagInputValue] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = '图片管理 - Momoka 图床';
  }, []);

  // Fetch images with ProTable format
  const fetchImages = async (params, sort, filter) => {
    try {
      const page = params.current || 1;
      const pageSize = params.pageSize || 20;
      const keyword = params.name || ''; // ProTable 搜索字段
      const tag = selectedTag || ''; // 从状态获取标签筛选

      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (keyword) {
        queryParams.append('keyword', keyword);
      }

      if (tag) {
        queryParams.append('tag', tag);
      }

      const response = await authFetch(`/admin-api/image?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          data: data.images || [],
          success: true,
          total: data.total || 0,
        };
      } else {
        message.error('获取图片列表失败');
        return {
          data: [],
          success: false,
          total: 0,
        };
      }
    } catch (error) {
      console.error('获取图片列表失败:', error);
      message.error('获取图片列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  // Fetch tags
  const fetchTags = async () => {
    try {
      const response = await authFetch('/admin-api/image/tags');
      if (response.ok) {
        const data = await response.json();
        // 后端返回的是 map[string]int64 格式，直接保存标签和数量的映射
        if (data.tags && typeof data.tags === 'object') {
          setTags(data.tags);
        } else {
          setTags({});
        }
      } else {
        setTags({});
      }
    } catch (error) {
      console.error('获取标签列表失败:', error);
      setTags({}); // 确保在错误情况下 tags 仍然是对象
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  // Handle batch delete
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的图片');
      return;
    }

    try {
      const response = await authFetch(`/admin-api/image?ids=${selectedRowKeys.join(',')}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        message.success(`成功删除 ${selectedRowKeys.length} 张图片`);
        setSelectedRowKeys([]);
        actionRef.current?.reload();
      } else {
        const errorData = await response.json();
        message.error(`删除失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      message.error('删除图片失败');
    }
  };

  // Handle single delete
  const handleSingleDelete = async (imageId) => {
    try {
      const response = await authFetch(`/admin-api/image?ids=${imageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        message.success('删除成功');
        actionRef.current?.reload();
      } else {
        const errorData = await response.json();
        message.error(`删除失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      message.error('删除图片失败');
    }
  };

  // Handle edit
  const handleEdit = (image) => {
    setEditingImage(image);
    setEditForm({
      name: image.name || '',
      remark: image.remark || '',
      tags: image.tags || []
    });
    setTagInputValue((image.tags || []).join(', ')); // Initialize tag input value
    setEditModalVisible(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!editingImage) return;

    // Convert tag input value to tags array before saving
    const tags = tagInputValue.split(',').map(tag => tag.trim()).filter(tag => tag);
    const formData = { ...editForm, tags };

    try {
      const response = await authFetch(`/admin-api/image/${editingImage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        message.success('更新成功');
        setEditModalVisible(false);
        setEditingImage(null);
        fetchImages();
        fetchTags(); // Refresh tags in case new ones were added
      } else {
        const errorData = await response.json();
        message.error(`更新失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新图片失败:', error);
      message.error('更新图片失败');
    }
  };

  // Handle copy URL
  const handleCopyUrl = (url) => {
    if (!url) {
      message.error('图片链接无效');
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // Handle preview
  const handlePreview = (url) => {
    if (!url) {
      message.error('图片链接无效');
      return;
    }
    setPreviewImage(url);
    setPreviewVisible(true);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'url',
      key: 'image',
      width: 120,
      render: (url, record) => (
        <div style={{ 
          width: '80px', 
          height: '80px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f5f5f5',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {url ? (
            <img
              src={url}
              alt={record.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
              onClick={() => handlePreview(url)}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '12px' }}>
              无图片
            </div>
          )}
        </div>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      hideInSearch: false,
      render: (text) => (
        <Tooltip title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags) => (
        <div>
          {tags && tags.length > 0 ? (
            tags.slice(0, 2).map((tag, index) => (
              <Tag key={index} size="small">
                {tag}
              </Tag>
            ))
          ) : (
            <span style={{ color: '#999' }}>无标签</span>
          )}
          {tags && tags.length > 2 && (
            <Tag size="small">+{tags.length - 2}</Tag>
          )}
        </div>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => formatFileSize(size),
    },
    {
      title: '上传时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 150,
      render: (time) => formatDate(time * 1000),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => record.url && handlePreview(record.url)}
              disabled={!record.url}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="复制链接">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => record.url && handleCopyUrl(record.url)}
              disabled={!record.url}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这张图片吗？"
            onConfirm={() => handleSingleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <ProCard title="图片管理" bordered>
        <ProTable
          actionRef={actionRef}
          columns={columns}
          request={fetchImages}
          rowKey="id"
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
            <Space size={24}>
              <span>
                已选择 <strong>{selectedRowKeys.length}</strong> 项
              </span>
              <Button
                type="link"
                size="small"
                onClick={onCleanSelected}
              >
                取消选择
              </Button>
            </Space>
          )}
          tableAlertOptionRender={({ selectedRowKeys }) => (
            <Space size={16}>
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
                disabled={selectedRowKeys.length === 0}
              >
                批量删除
              </Button>
            </Space>
          )}
          search={{
            labelWidth: 'auto',
          }}
          toolBarRender={() => [
             <Select
               key="tag-filter"
               placeholder="选择标签筛选"
               allowClear
               value={selectedTag || undefined}
               style={{ width: 200 }}
               showSearch
               filterOption={(input, option) =>
                 option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
               }
               onChange={(value) => {
                 setSelectedTag(value || '');
                 // 触发表格刷新
                 actionRef.current?.reload();
               }}
             >
               {Object.keys(tags).map((tag) => (
                 <Select.Option key={tag} value={tag}>
                   <TagsOutlined style={{ marginRight: '4px' }} />
                   {tag} <span style={{ color: '#999', fontSize: '12px' }}>({tags[tag]})</span>
                 </Select.Option>
               ))}
             </Select>,
             <Button
               key="refresh"
               icon={<ReloadOutlined />}
               onClick={() => actionRef.current?.reload()}
             >
               刷新
             </Button>,
           ]}
        />
      </ProCard>

      {/* Edit Modal */}
      <Modal
        title="编辑图片"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingImage(null);
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        {editingImage && (
          <div>
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <img
                src={editingImage.url}
                alt={editingImage.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>图片名称:</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="请输入图片名称"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>备注:</label>
              <Input.TextArea
                value={editForm.remark}
                onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                placeholder="请输入备注"
                rows={3}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>标签 (用逗号分隔):</label>
              <Input
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                placeholder="请输入标签，用逗号分隔"
              />
            </div>

            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>文件大小: {formatFileSize(editingImage.file_size)}</div>
              <div>上传时间: {formatDate(editingImage.create_time*1000)}</div>
              <div>文件类型: {editingImage.content_type}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview Modal */}
      {previewImage && (
        <Image
          width={200}
          style={{ display: 'none' }}
          src={previewImage}
          preview={{
            visible: previewVisible,
            src: previewImage,
            onVisibleChange: (visible) => {
              setPreviewVisible(visible);
            },
          }}
        />
      )}
    </div>
  );
};

export default ImageManager;