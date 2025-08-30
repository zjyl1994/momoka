import React, { useState, useEffect, useCallback } from 'react';
import { Table, Image, Dropdown, Modal, Input, message, Button, Select, Spin, Empty, Space, Typography, Tree, Checkbox } from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FolderOutlined,
  FileImageOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Option } = Select;
const { Text } = Typography;

const FileListView = ({ folderId, onImageUpdate, onFolderUpdate, folderTree, onFolderSelect, onSelectionChange, onItemsChange }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [targetFolderId, setTargetFolderId] = useState(null);
  const [renameItemId, setRenameItemId] = useState(null);
  const [renameItemType, setRenameItemType] = useState(null); // 'folder' or 'image'
  const [moveItemId, setMoveItemId] = useState(null);
  const [moveItemType, setMoveItemType] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuRecord, setContextMenuRecord] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // Fetch folder contents (both folders and images)
  const fetchFolderContents = async (folderIdParam = folderId) => {
    setLoading(true);
    try {
      const response = await authFetch(`/admin-api/folder?id=${folderIdParam}`);
      if (response.ok) {
        const data = await response.json();
        
        // Combine folders and images into a single list
        const folders = (data.folders || []).map(folder => ({
          ...folder,
          type: 'folder',
          key: `folder-${folder.id}`,
          name: folder.name,
          size: '-',
          created_at: folder.create_time
        }));
        
        const images = (data.images || []).map(image => ({
          ...image,
          type: 'image',
          key: `image-${image.id}`,
          name: image.file_name,
          size: image.file_size,
          created_at: image.create_time
        }));
        
        // Sort: folders first, then images, both alphabetically
        const allItems = [...folders, ...images].sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        setItems(allItems);
        // 通知父组件当前的items数据
        if (onItemsChange) {
          onItemsChange(allItems);
        }
      } else {
        message.error('获取文件列表失败');
      }
    } catch (error) {
      console.error('获取文件列表失败:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (folderId !== undefined) {
      fetchFolderContents(folderId);
      // Clear selection when folder changes
      setSelectedRowKeys([]);
      setSelectedItems([]);
    }
  }, [folderId]);

  // Handle selection change
  const handleSelectionChange = (selectedKeys, selectedRows) => {
    setSelectedRowKeys(selectedKeys);
    setSelectedItems(selectedRows);
    // Notify parent component
    if (onSelectionChange) {
      onSelectionChange(selectedKeys, selectedRows);
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRowKeys([]);
    setSelectedItems([]);
    if (onSelectionChange) {
      onSelectionChange([], []);
    }
  };

  // Expose clearSelection method and selectAll method to parent
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedRowKeys, selectedItems, clearSelection, selectAll);
    }
  }, [selectedRowKeys, selectedItems]);

  // Select all items
  const selectAll = () => {
    const allKeys = items.map(item => item.key);
    setSelectedRowKeys(allKeys);
    setSelectedItems(items);
    if (onSelectionChange) {
      onSelectionChange(allKeys, items);
    }
  };

  // Handle global click to hide context menu
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Don't hide if clicking on the context menu itself
      if (e.target.closest('.context-menu')) {
        return;
      }
      if (contextMenuVisible) {
        hideContextMenu();
      }
    };

    if (contextMenuVisible) {
      // Use setTimeout to avoid immediate hiding
      setTimeout(() => {
        document.addEventListener('click', handleGlobalClick);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenuVisible]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0 || bytes === '-') return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time
  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // Handle double click - open folder or preview image
  const handleDoubleClick = (item) => {
    if (item.type === 'folder') {
      onFolderSelect && onFolderSelect(item.id);
    } else if (item.type === 'image') {
      setPreviewImage(item.url);
      setPreviewVisible(true);
    }
  };

  // View image
  const handleViewImage = (image) => {
    setPreviewImage(image.url);
    setPreviewVisible(true);
  };

  // Download image
  const handleDownloadImage = (image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('开始下载图片');
  };

  // Copy image URL
  const handleCopyUrl = async (image) => {
    try {
      await navigator.clipboard.writeText(image.url);
      message.success('URL已复制到剪贴板');
    } catch (err) {
      message.error('复制失败');
    }
  };

  // Rename item (folder or image)
  const handleRenameItem = (item) => {
    setRenameItemId(item.id);
    setRenameItemType(item.type);
    setNewItemName(item.name);
    setRenameModalVisible(true);
  };

  // Move item (folder or image)
  const handleMoveItem = (item) => {
    setMoveItemId(item.id);
    setMoveItemType(item.type);
    setTargetFolderId(folderId);
    setMoveModalVisible(true);
  };

  // Delete item (folder or image)
  const handleDeleteItem = (item) => {
    console.log("delete item", item);
    console.log("About to show delete modal");
    setDeleteItem(item);
    setDeleteModalVisible(true);
  };

  // Confirm delete item
  const confirmDeleteItem = async () => {
    if (!deleteItem) return;
    
    const itemTypeName = deleteItem.type === 'folder' ? '文件夹' : '图片';
    try {
      const endpoint = deleteItem.type === 'folder' ? '/admin-api/folder' : '/admin-api/image';
      const response = await authFetch(`${endpoint}?id=${deleteItem.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        message.success(`${itemTypeName}删除成功`);
        fetchFolderContents();
        if (deleteItem.type === 'folder') {
          onFolderUpdate && onFolderUpdate();
        } else {
          onImageUpdate && onImageUpdate();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `删除${itemTypeName}失败`;
        message.error(errorMsg);
      }
    } catch (error) {
      console.error(`删除${itemTypeName}失败:`, error);
      message.error(`删除${itemTypeName}失败: ${error.message}`);
    } finally {
      setDeleteModalVisible(false);
      setDeleteItem(null);
    }
  };

  // Confirm rename
  const confirmRenameItem = async () => {
    if (!newItemName.trim()) {
      message.error('名称不能为空');
      return;
    }

    try {
      const endpoint = renameItemType === 'folder' ? '/admin-api/folder' : '/admin-api/image';
      const bodyField = renameItemType === 'folder' ? 'name' : 'file_name';
      
      const response = await authFetch(`${endpoint}?id=${renameItemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [bodyField]: newItemName.trim()
        })
      });

      if (response.ok) {
        const itemTypeName = renameItemType === 'folder' ? '文件夹' : '图片';
        message.success(`${itemTypeName}重命名成功`);
        setRenameModalVisible(false);
        setNewItemName('');
        setRenameItemId(null);
        setRenameItemType(null);
        fetchFolderContents();
        if (renameItemType === 'folder') {
          onFolderUpdate && onFolderUpdate();
        } else {
          onImageUpdate && onImageUpdate();
        }
      } else {
        message.error('重命名失败');
      }
    } catch (error) {
      console.error('重命名失败:', error);
      message.error('重命名失败');
    }
  };

  // Confirm move
  const confirmMoveItem = async () => {
    if (targetFolderId === null) {
      message.error('请选择目标文件夹');
      return;
    }

    try {
      const endpoint = moveItemType === 'folder' ? '/admin-api/folder' : '/admin-api/image';
      const bodyField = moveItemType === 'folder' ? 'parent_id' : 'folder_id';
      
      const response = await authFetch(`${endpoint}?id=${moveItemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [bodyField]: targetFolderId
        })
      });

      if (response.ok) {
        const itemTypeName = moveItemType === 'folder' ? '文件夹' : '图片';
        message.success(`${itemTypeName}移动成功`);
        setMoveModalVisible(false);
        setTargetFolderId(null);
        setMoveItemId(null);
        setMoveItemType(null);
        fetchFolderContents();
        if (moveItemType === 'folder') {
          onFolderUpdate && onFolderUpdate();
        } else {
          onImageUpdate && onImageUpdate();
        }
      } else {
        message.error('移动失败');
      }
    } catch (error) {
      console.error('移动失败:', error);
      message.error('移动失败');
    }
  };

  // Convert folder tree to tree data for Tree component
  const convertToTreeData = (folders) => {
    return folders.map(folder => ({
      title: folder.name,
      key: folder.id.toString(),
      icon: <FolderOutlined />,
      children: folder.children && folder.children.length > 0 ? convertToTreeData(folder.children) : undefined
    }));
  };

  // Handle right click context menu
  const handleContextMenu = (e, record) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuRecord(record);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  // Hide context menu
  const hideContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuRecord(null);
  };

  // Get context menu items
  const getContextMenuItems = (record) => {
    const menuItems = [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: '重命名',
        onClick: () => {
          handleRenameItem(record);
          hideContextMenu();
        },
      },
      {
        key: 'move',
        icon: <FolderOutlined />,
        label: '移动',
        onClick: () => {
          handleMoveItem(record);
          hideContextMenu();
        },
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        danger: true,
        onClick: () => {
          handleDeleteItem(record);
          hideContextMenu();
        },
      },
    ];

    // Add image-specific actions
    if (record.type === 'image') {
      menuItems.unshift(
        {
          key: 'view',
          icon: <EyeOutlined />,
          label: '查看',
          onClick: () => {
            handleViewImage(record);
            hideContextMenu();
          },
        },
        {
          key: 'download',
          icon: <DownloadOutlined />,
          label: '下载',
          onClick: () => {
            handleDownloadImage(record);
            hideContextMenu();
          },
        },
        {
          key: 'copy',
          icon: <CopyOutlined />,
          label: '复制链接',
          onClick: () => {
            handleCopyUrl(record);
            hideContextMenu();
          },
        },
        {
          type: 'divider',
        }
      );
    }

    return menuItems;
  };

  // Table columns
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.type === 'folder' ? (
            <FolderOutlined style={{ color: '#1890ff' }} />
          ) : (
            <FileImageOutlined style={{ color: '#52c41a' }} />
          )}
          <Text
            style={{ cursor: 'pointer' }}
            onClick={() => handleDoubleClick(record)}
          >
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size) => formatFileSize(size),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (timestamp) => formatTime(timestamp),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const menuItems = [
          {
            key: 'rename',
            icon: <EditOutlined />,
            label: '重命名',
            onClick: () => handleRenameItem(record),
          },
          {
            key: 'move',
            icon: <FolderOutlined />,
            label: '移动',
            onClick: () => handleMoveItem(record),
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => handleDeleteItem(record),
          },
        ];

        // Add image-specific actions
        if (record.type === 'image') {
          menuItems.unshift(
            {
              key: 'view',
              icon: <EyeOutlined />,
              label: '查看',
              onClick: () => handleViewImage(record),
            },
            {
              key: 'download',
              icon: <DownloadOutlined />,
              label: '下载',
              onClick: () => handleDownloadImage(record),
            },
            {
              key: 'copy',
              icon: <CopyOutlined />,
              label: '复制链接',
              onClick: () => handleCopyUrl(record),
            },
            {
              type: 'divider',
            }
          );
        }

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>加载中...</div>
      </div>
    );
  }



  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <style>
        {`
          .file-list-table .ant-table-selection-column {
            padding-left: 16px !important;
          }
          .file-list-table .ant-checkbox-wrapper {
            margin-left: 0;
          }
        `}
      </style>
      <Table
        className="file-list-table"
        columns={columns}
        dataSource={items}
        pagination={false}
        scroll={{ y: 'calc(100vh - 200px)' }}
        locale={{
          emptyText: (
            <Empty
              description="暂无文件"
              style={{ padding: '50px' }}
            />
          ),
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: handleSelectionChange,
          getCheckboxProps: (record) => ({
            name: record.name,
          }),
        }}
        onRow={(record) => ({
          onDoubleClick: () => handleDoubleClick(record),
          onContextMenu: (e) => handleContextMenu(e, record),
        })}
      />

      {/* Context Menu */}
      {contextMenuVisible && contextMenuRecord && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={hideContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              hideContextMenu();
            }}
          />
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              zIndex: 1000,
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
              minWidth: '120px',
            }}
          >
            {getContextMenuItems(contextMenuRecord).map((item, index) => {
              if (item.type === 'divider') {
                return (
                  <div
                    key={index}
                    style={{
                      height: '1px',
                      background: '#f0f0f0',
                      margin: '4px 0',
                    }}
                  />
                );
              }
              return (
                <div
                  key={item.key}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    color: item.danger ? '#ff4d4f' : '#262626',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    item.onClick && item.onClick();
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <Image
          width={200}
          style={{ display: 'none' }}
          src={previewImage}
          preview={{
            visible: previewVisible,
            src: previewImage,
            onVisibleChange: (visible) => setPreviewVisible(visible),
          }}
        />
      )}

      {/* Rename Modal */}
      <Modal
        title={`重命名${renameItemType === 'folder' ? '文件夹' : '图片'}`}
        open={renameModalVisible}
        onOk={confirmRenameItem}
        onCancel={() => {
          setRenameModalVisible(false);
          setNewItemName('');
          setRenameItemId(null);
          setRenameItemType(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={`请输入新的${renameItemType === 'folder' ? '文件夹' : '图片'}名称`}
          onPressEnter={confirmRenameItem}
        />
      </Modal>

      {/* Move Modal */}
      <Modal
        title={`移动${moveItemType === 'folder' ? '文件夹' : '图片'}`}
        open={moveModalVisible}
        onOk={confirmMoveItem}
        onCancel={() => {
          setMoveModalVisible(false);
          setTargetFolderId(null);
          setMoveItemId(null);
          setMoveItemType(null);
        }}
        okText="确定"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <p>选择目标文件夹：</p>
          <Tree
            treeData={[
              {
                title: '根目录',
                key: '0',
                icon: <FolderOutlined />,
                children: convertToTreeData(folderTree || [])
              }
            ]}
            selectedKeys={[targetFolderId?.toString() || '']}
            onSelect={(selectedKeys) => {
              if (selectedKeys.length > 0) {
                setTargetFolderId(parseInt(selectedKeys[0]));
              }
            }}
            defaultExpandAll
            showIcon
            titleRender={(nodeData) => {
              const isDisabled = moveItemType === 'folder' && nodeData.key === moveItemId?.toString();
              return (
                <span style={{ color: isDisabled ? '#ccc' : 'inherit' }}>
                  {nodeData.title}
                  {isDisabled && ' (不能移动到自身)'}
                </span>
              );
            }}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={confirmDeleteItem}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteItem(null);
        }}
        okText="确定"
        cancelText="取消"
        okType="danger"
        centered
      >
        {deleteItem && (
          <p>
            {deleteItem.type === 'folder' 
              ? `确定要删除文件夹 "${deleteItem.name}" 吗？此操作将同时删除文件夹内的所有内容。`
              : `确定要删除图片 "${deleteItem.name}" 吗？`
            }
          </p>
        )}
      </Modal>
    </div>
  );
};

export default FileListView;