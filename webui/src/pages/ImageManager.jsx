import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Button, 
  message, 
  Spin, 
  Modal, 
  Input, 
  Space, 
  Typography, 
  Tag,
  Pagination,
  Select,
  Checkbox,
  Row,
  Col,
  Image,
  Tooltip,
  Popconfirm
} from 'antd';
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

const { Content } = Layout;
const { Search } = Input;
const { Text } = Typography;

const ImageManager = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [tags, setTags] = useState({});
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  
  // Modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', remark: '', tags: [] });
  const [tagInputValue, setTagInputValue] = useState(''); // Temporary string for tag input
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // Set page title
  useEffect(() => {
    document.title = '图片管理 - Momoka 图床';
  }, []);

  // Fetch images
  const fetchImages = async () => {
    setLoading(true);
    try {
      const searchKeyword = selectedTag || keyword;
      const isTagSearch = !!selectedTag;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        keyword: searchKeyword,
        keywordIsTag: isTagSearch.toString()
      });

      const response = await authFetch(`/admin-api/image?${params}`);
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
    fetchImages();
    fetchTags();
  }, [currentPage, pageSize, keyword, selectedTag]);

  // Handle search
  const handleSearch = (value) => {
    setKeyword(value);
    setSelectedTag(''); // Clear tag selection when searching by keyword
    setCurrentPage(1);
  };

  // Handle tag selection
  const handleTagSelect = (value) => {
    setSelectedTag(value);
    setKeyword(''); // Clear keyword when selecting tag
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    if (size !== pageSize) {
      setPageSize(size);
    }
  };

  // Handle image selection
  const handleImageSelect = (imageId, checked) => {
    let newSelectedImages;
    if (checked) {
      newSelectedImages = [...selectedImages, imageId];
    } else {
      newSelectedImages = selectedImages.filter(id => id !== imageId);
    }
    setSelectedImages(newSelectedImages);
    
    // 如果没有选中任何图片，隐藏批量操作区域
    if (newSelectedImages.length === 0) {
      setShowBatchOperations(false);
    }
  };

  // Handle select all
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedImages(images.map(img => img.id));
    } else {
      setSelectedImages([]);
    }
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    if (selectedImages.length === 0) {
      message.warning('请先选择要删除的图片');
      return;
    }

    try {
      const response = await authFetch(`/admin-api/image?ids=${selectedImages.join(',')}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        message.success(`成功删除 ${selectedImages.length} 张图片`);
        setSelectedImages([]);
        setShowBatchOperations(false);
        fetchImages();
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
        fetchImages();
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

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Layout style={{ height: '100%', background: '#fff' }}>
        <Content style={{ padding: '24px', height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Typography.Title level={2} style={{ margin: 0 }}>
                图片管理
              </Typography.Title>
              <Space>
                {!showBatchOperations ? (
                  <Button 
                    onClick={() => {
                      setShowBatchOperations(true);
                      handleSelectAll(true);
                    }}
                  >
                    全选当前页
                  </Button>
                ) : (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Text>已选中 {selectedImages.length} 张图片</Text>
                    <Popconfirm
                      title="确定要删除选中的图片吗？"
                      onConfirm={handleBatchDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        批量删除
                      </Button>
                    </Popconfirm>
                    <Button 
                      onClick={() => {
                        setSelectedImages([]);
                        setShowBatchOperations(false);
                      }}
                    >
                      取消选择
                    </Button>
                  </div>
                )}
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => fetchImages()}
                  loading={loading}
                >
                  刷新
                </Button>
              </Space>
            </div>

            {/* Search and filters */}
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Select
                  placeholder="选择标签筛选"
                  allowClear
                  value={selectedTag || undefined}
                  onChange={handleTagSelect}
                  style={{ width: '100%' }}
                  showSearch
                  filterOption={(input, option) =>
                    option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {Object.keys(tags).map((tag) => (
                    <Select.Option key={tag} value={tag}>
                      <TagsOutlined style={{ marginRight: '4px' }} />
                      {tag} <span style={{ color: '#999', fontSize: '12px' }}>({tags[tag]})</span>
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <Search
                  placeholder="搜索图片名称"
                  allowClear
                  enterButton={<SearchOutlined />}
                  onSearch={handleSearch}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>




          </div>

          {/* Image grid */}
          <Spin spinning={loading}>
            {images.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 0',
                color: '#999'
              }}>
                暂无图片
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                {images.map((image) => (
                  <Col key={image.id} xs={24} sm={12} md={8} lg={6} xl={4}>
                    <Card
                      hoverable
                      style={{ 
                        height: '380px',
                        border: selectedImages.includes(image.id) ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      bodyStyle={{
                        padding: '16px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                      cover={
                        <div style={{ 
                          height: '200px', 
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f5f5f5',
                          position: 'relative'
                        }}>
                          <Checkbox
                            checked={selectedImages.includes(image.id)}
                            onChange={(e) => handleImageSelect(image.id, e.target.checked)}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              zIndex: 1
                            }}
                          />
                          {image.url ? (
                            <img
                              src={image.url}
                              alt={image.name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                cursor: 'pointer'
                              }}
                              onClick={() => handlePreview(image.url)}
                            />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#999',
                              fontSize: '14px'
                            }}>
                              图片加载失败
                            </div>
                          )}
                        </div>
                      }
                      actions={[
                        <Tooltip key="preview" title={image.url ? "预览" : "图片链接无效"}>
                          <EyeOutlined 
                            onClick={() => image.url && handlePreview(image.url)}
                            style={{ 
                              cursor: image.url ? 'pointer' : 'not-allowed',
                              opacity: image.url ? 1 : 0.5
                            }}
                          />
                        </Tooltip>,
                        <Tooltip key="edit" title="编辑">
                          <EditOutlined 
                            onClick={() => handleEdit(image)}
                            style={{ 
                              cursor: 'pointer'
                            }}
                          />
                        </Tooltip>,
                        <Tooltip key="copy" title={image.url ? "复制链接" : "图片链接无效"}>
                          <CopyOutlined 
                            onClick={() => image.url && handleCopyUrl(image.url)}
                            style={{ 
                              cursor: image.url ? 'pointer' : 'not-allowed',
                              opacity: image.url ? 1 : 0.5
                            }}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title="确定要删除这张图片吗？"
                          onConfirm={() => handleSingleDelete(image.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
                            <DeleteOutlined 
                              style={{ 
                                cursor: 'pointer'
                              }}
                            />
                          </Tooltip>
                        </Popconfirm>
                      ]}
                    >
                      {/* 内容区域 */}
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 0
                      }}>
                        <Card.Meta
                          title={
                            <Tooltip title={image.name}>
                              <div style={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {image.name}
                              </div>
                            </Tooltip>
                          }
                          description={
                            <div>
                              {image.remark && (
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#666', 
                                    marginBottom: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                  {image.remark}
                                  </div>
                              )}
                              
                              {image.tags && image.tags.length > 0 && (
                                <div style={{ marginBottom: '4px' }}>
                                  {image.tags.slice(0, 2).map((tag, index) => (
                                    <Tag key={index} size="small" style={{ fontSize: '10px' }}>
                                      {tag}
                                    </Tag>
                                  ))}
                                  {image.tags.length > 2 && (
                                    <Tag size="small" style={{ fontSize: '10px' }}>
                                      +{image.tags.length - 2}
                                    </Tag>
                                  )}
                                </div>
                              )}
                              
                            </div>
                          }
                        />
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Spin>

          {/* Pagination */}
          {total > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              alignItems: 'center',
              marginTop: '24px',
              paddingBottom: '24px',
              borderTop: '1px solid #f0f0f0',
              paddingTop: '16px'
            }}>
              <Pagination
                current={currentPage}
                total={total}
                pageSize={pageSize}
                showSizeChanger
                showQuickJumper
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                onChange={handlePageChange}
                pageSizeOptions={['20', '50', '100']}
              />
            </div>
          )}
        </Content>
      </Layout>

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