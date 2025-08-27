import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Image, Dropdown, Modal, Input, message, Button, Select, Spin, Empty } from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Option } = Select;

const ImageWaterfall = ({ folderId, onImageUpdate, folderTree }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuImage, setContextMenuImage] = useState(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [newImageName, setNewImageName] = useState('');
  const [targetFolderId, setTargetFolderId] = useState(null);
  const [renameImageId, setRenameImageId] = useState(null);
  const [moveImageId, setMoveImageId] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const containerRef = useRef(null);
  const [columnCount, setColumnCount] = useState(4);
  const [columnHeights, setColumnHeights] = useState([]);

  // 获取文件夹内容
  const fetchFolderContents = async (folderIdParam = folderId) => {
    setLoading(true);
    try {
      const response = await authFetch(`/admin-api/folder?id=${folderIdParam}`);
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
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
    if (folderId !== undefined) {
      fetchFolderContents(folderId);
    }
  }, [folderId]);

  // 响应式列数计算
  const updateColumnCount = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const minColumnWidth = 250; // 最小列宽
      const gap = 16; // 间距
      const newColumnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)));
      setColumnCount(newColumnCount);
      setColumnHeights(new Array(newColumnCount).fill(0));
    }
  }, []);

  useEffect(() => {
    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, [updateColumnCount]);

  // 计算图片应该放在哪一列
  const getShortestColumn = () => {
    let shortestIndex = 0;
    let shortestHeight = columnHeights[0];
    for (let i = 1; i < columnHeights.length; i++) {
      if (columnHeights[i] < shortestHeight) {
        shortestHeight = columnHeights[i];
        shortestIndex = i;
      }
    }
    return shortestIndex;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // 处理右键菜单
  const handleRightClick = (e, image) => {
    e.preventDefault();
    setContextMenuImage(image);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  // 隐藏右键菜单
  const hideContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuImage(null);
  };

  // 查看图片
  const handleViewImage = (image) => {
    setPreviewImage(image.url);
    setPreviewVisible(true);
    hideContextMenu();
  };

  // 下载图片
  const handleDownloadImage = (image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('开始下载图片');
    hideContextMenu();
  };

  // 复制图片URL
  const handleCopyUrl = async (image) => {
    try {
      await navigator.clipboard.writeText(image.url);
      message.success('URL已复制到剪贴板');
    } catch (err) {
      message.error('复制失败');
    }
    hideContextMenu();
  };

  // 重命名图片
  const handleRenameImage = () => {
    setRenameImageId(contextMenuImage.id);
    setNewImageName(contextMenuImage.file_name);
    setRenameModalVisible(true);
    hideContextMenu();
  };

  // 移动图片
  const handleMoveImage = () => {
    setMoveImageId(contextMenuImage.id);
    setTargetFolderId(folderId);
    setMoveModalVisible(true);
    hideContextMenu();
  };

  // 删除图片
  const handleDeleteImage = () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除图片 "${contextMenuImage.file_name}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await authFetch(`/admin-api/image?id=${contextMenuImage.id}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            message.success('图片删除成功');
            fetchFolderContents();
            onImageUpdate && onImageUpdate();
          } else {
            message.error('删除图片失败');
          }
        } catch (error) {
          console.error('删除图片失败:', error);
          message.error('删除图片失败');
        }
      }
    });
    hideContextMenu();
  };

  // 确认重命名图片
  const confirmRenameImage = async () => {
    if (!newImageName.trim()) {
      message.error('图片名称不能为空');
      return;
    }

    try {
      const response = await authFetch(`/admin-api/image?id=${renameImageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_name: newImageName.trim()
        })
      });

      if (response.ok) {
        message.success('图片重命名成功');
        setRenameModalVisible(false);
        setNewImageName('');
        setRenameImageId(null);
        fetchFolderContents();
        onImageUpdate && onImageUpdate();
      } else {
        message.error('重命名图片失败');
      }
    } catch (error) {
      console.error('重命名图片失败:', error);
      message.error('重命名图片失败');
    }
  };

  // 确认移动图片
  const confirmMoveImage = async () => {
    if (targetFolderId === null) {
      message.error('请选择目标文件夹');
      return;
    }

    try {
      const response = await authFetch(`/admin-api/image?id=${moveImageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folder_id: targetFolderId
        })
      });

      if (response.ok) {
        message.success('图片移动成功');
        setMoveModalVisible(false);
        setTargetFolderId(null);
        setMoveImageId(null);
        fetchFolderContents();
        onImageUpdate && onImageUpdate();
      } else {
        message.error('移动图片失败');
      }
    } catch (error) {
      console.error('移动图片失败:', error);
      message.error('移动图片失败');
    }
  };

  // 转换文件夹树为选择器数据
  const convertToSelectData = (folders, level = 0) => {
    const result = [];
    if (level === 0) {
      result.push({ value: 0, label: '根目录' });
    }
    if (folders && folders.length > 0) {
      folders.forEach(folder => {
        result.push({
          value: folder.id,
          label: '　'.repeat(level) + folder.name
        });
        if (folder.children && folder.children.length > 0) {
          result.push(...convertToSelectData(folder.children, level + 1));
        }
      });
    }
    return result;
  };

  // 右键菜单项
  const contextMenuItems = [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: '查看',
      onClick: () => handleViewImage(contextMenuImage)
    },
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: '下载',
      onClick: () => handleDownloadImage(contextMenuImage)
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制链接',
      onClick: () => handleCopyUrl(contextMenuImage)
    },
    {
      type: 'divider'
    },
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: handleRenameImage
    },
    {
      key: 'move',
      icon: <FolderOutlined />,
      label: '移动',
      onClick: handleMoveImage
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      onClick: handleDeleteImage,
      danger: true
    }
  ];

  // 渲染瀑布流
  const renderWaterfall = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!images || images.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Empty description="暂无图片" />
        </div>
      );
    }

    const columns = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);

    images.forEach((image, index) => {
      const shortestIndex = heights.indexOf(Math.min(...heights));
      columns[shortestIndex].push(image);
      // 估算图片高度（实际应该根据图片尺寸计算）
      heights[shortestIndex] += 300; // 基础高度
    });

    return (
      <div style={{ display: 'flex', gap: '16px' }}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {column.map((image) => (
              <Card
                key={image.id}
                hoverable
                style={{ borderRadius: '8px', overflow: 'hidden' }}
                bodyStyle={{ padding: 0 }}
                onContextMenu={(e) => handleRightClick(e, image)}
                onClick={() => handleViewImage(image)}
              >
                <div style={{ position: 'relative' }}>
                  <Image
                    src={image.url}
                    alt={image.file_name}
                    style={{ width: '100%', display: 'block' }}
                    preview={false}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      color: 'white',
                      padding: '20px 12px 12px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {image.file_name}
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      {formatFileSize(image.file_size)} • {formatTime(image.create_time)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'hidden', padding: '16px' }}>
      {renderWaterfall()}

      {/* 右键菜单 */}
      {contextMenuVisible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
        >
          <Dropdown
            menu={{ items: contextMenuItems }}
            open={true}
            onOpenChange={(open) => {
              if (!open) hideContextMenu();
            }}
          >
            <div style={{ width: 1, height: 1 }} />
          </Dropdown>
        </div>
      )}

      {/* 图片预览 */}
      <Image
        style={{ display: 'none' }}
        src={previewImage}
        preview={{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible
        }}
      />

      {/* 重命名图片模态框 */}
      <Modal
        title="重命名图片"
        open={renameModalVisible}
        onOk={confirmRenameImage}
        onCancel={() => {
          setRenameModalVisible(false);
          setNewImageName('');
          setRenameImageId(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新的图片名称"
          value={newImageName}
          onChange={(e) => setNewImageName(e.target.value)}
          onPressEnter={confirmRenameImage}
          autoFocus
        />
      </Modal>

      {/* 移动图片模态框 */}
      <Modal
        title="移动图片"
        open={moveModalVisible}
        onOk={confirmMoveImage}
        onCancel={() => {
          setMoveModalVisible(false);
          setTargetFolderId(null);
          setMoveImageId(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>选择目标文件夹：</div>
        <Select
          style={{ width: '100%' }}
          placeholder="请选择目标文件夹"
          value={targetFolderId}
          onChange={setTargetFolderId}
          options={convertToSelectData(folderTree)}
        />
      </Modal>

      {/* 点击其他地方隐藏右键菜单 */}
      {contextMenuVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={hideContextMenu}
        />
      )}
    </div>
  );
};

export default ImageWaterfall;