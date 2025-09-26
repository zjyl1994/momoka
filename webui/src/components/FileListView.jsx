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
  MoreOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Option } = Select;
const { Text } = Typography;

const FileListView = ({ folderId, onImageUpdate, onFolderUpdate, folderTree, onFolderSelect, onSelectionChange, onItemsChange }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // Find folder in tree recursively
  const findFolderInTree = (folderId, tree) => {
    if (!tree || !Array.isArray(tree)) {
      return null;
    }
    for (const folder of tree) {
      if (folder.id === folderId) {
        return folder;
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolderInTree(folderId, folder.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // Build path string from folder ID
  const getPathByFolderId = (folderId) => {
    if (folderId === 0) {
      return '/';
    }
    
    const folder = findFolderInTree(folderId, folderTree || []);
    if (!folder) {
      return '/';
    }
    
    // Recursively build path
    const buildPath = (currentFolder, tree) => {
      const path = [currentFolder.name];
      if (currentFolder.parent_id !== 0) {
        const parent = findFolderInTree(currentFolder.parent_id, tree);
        if (parent) {
          path.unshift(...buildPath(parent, tree));
        }
      }
      return path;
    };
    
    const pathArray = buildPath(folder, folderTree || []);
    return '/' + pathArray.join('/');
  };

  // Get current path string
  const getCurrentPath = useCallback(() => {
    return getPathByFolderId(folderId);
  }, [folderId, folderTree]);

  // Fetch folder contents by path
  const fetchFolderContentsByPath = useCallback(async (path) => {
    setLoading(true);
    try {
      const response = await authFetch(`/admin-api/file/list?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        
        // Process file list data - backend returns VirtualFAT array directly
        const allItems = (data || []).map((item, index) => {
          const isFolder = item.is_folder;
          return {
            ...item,
            type: isFolder ? 'folder' : 'image',
            key: `${isFolder ? 'folder' : 'image'}-${item.id || index}`,
            name: isFolder ? item.name : (item.name + (item.ext_name || '')),
            size: isFolder ? '-' : item.file_size,
            created_at: item.create_time,
            // Keep original fields for compatibility
            id: item.id,
            file_name: isFolder ? item.name : (item.name + (item.ext_name || '')),
            file_size: item.file_size,
            create_time: item.create_time,
            url: isFolder ? null : item.url
          };
        });
        
        // Sort: folders first, then images, both alphabetically
        const sortedItems = allItems.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        setItems(sortedItems);
        
        // Notify parent component about items change
        if (onItemsChange) {
          onItemsChange(sortedItems);
        }
      } else {
        console.error('Failed to fetch folder contents');
        message.error('获取文件列表失败');
      }
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  }, [onItemsChange]);

  // Fetch folder contents
  const fetchFolderContents = useCallback(() => {
    if (folderId !== undefined && folderTree) {
      const path = getCurrentPath();
      fetchFolderContentsByPath(path);
    }
  }, [folderId, folderTree, getCurrentPath, fetchFolderContentsByPath]);

  // Effect to fetch folder contents when folderId changes
  useEffect(() => {
    fetchFolderContents();
  }, [fetchFolderContents]);

  // Handle selection change
  const handleSelectionChange = (selectedKeys, selectedRows) => {
    setSelectedRowKeys(selectedKeys);
    setSelectedItems(selectedRows);
    if (onSelectionChange) {
      onSelectionChange(selectedKeys, selectedRows);
    }
  };

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedItems([]);
    if (onSelectionChange) {
      onSelectionChange([], []);
    }
  }, [onSelectionChange]);

  // Expose methods to parent component
  useEffect(() => {
    if (onFolderUpdate) {
      onFolderUpdate({
        refresh: fetchFolderContents,
        clearSelection
      });
    }
  }, [onFolderUpdate, fetchFolderContents, clearSelection]);

  // Select all items
  const selectAll = () => {
    const allKeys = items.map(item => item.key);
    setSelectedRowKeys(allKeys);
    setSelectedItems(items);
    if (onSelectionChange) {
      onSelectionChange(allKeys, items);
    }
  };

  // Handle double click - open folder or preview image
  const handleDoubleClick = (item) => {
    if (item.type === 'folder') {
      // For folders, build new path and get contents directly
      const currentPath = getCurrentPath();
      const newPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      
      // Use path to get folder contents directly
      fetchFolderContentsByPath(newPath);
      
      // Also notify parent component to update selected folder ID (if needed)
      onFolderSelect && onFolderSelect(item.id);
    } else if (item.type === 'image') {
      setPreviewImage(item.url);
      setPreviewVisible(true);
    }
  };

  // Handle go back to parent directory
  const handleGoBack = () => {
    const currentPath = getCurrentPath();
    if (currentPath === '/') {
      return; // Already at root
    }
    
    // Get parent path
    const pathParts = currentPath.split('/').filter(part => part !== '');
    pathParts.pop(); // Remove last directory
    const parentPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/');
    
    // Navigate to parent directory
    fetchFolderContentsByPath(parentPath);
    
    // Find parent folder ID and notify parent component
    if (folderTree && onFolderSelect) {
      const currentFolder = findFolderInTree(folderId, folderTree);
      if (currentFolder && currentFolder.parent_id !== undefined) {
        onFolderSelect(currentFolder.parent_id);
      }
    }
  };

  // Check if we can go back (not at root)
  const canGoBack = () => {
    const currentPath = getCurrentPath();
    return currentPath !== '/';
  };

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      {/* Navigation Bar */}
      <div style={{ 
        padding: '8px 16px', 
        borderBottom: '1px solid #f0f0f0', 
        backgroundColor: '#fafafa'
      }}>
        <Space align="center">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
            disabled={!canGoBack()}
            title="返回上级目录"
          >
            返回
          </Button>
          <Text type="secondary">
            当前位置: {getCurrentPath()}
          </Text>
        </Space>
      </div>
      
      <Table
        loading={loading}
        columns={[
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
            render: (size) => {
              if (size === '-' || !size) return '-';
              const bytes = parseInt(size);
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 180,
            render: (timestamp) => {
              if (!timestamp) return '-';
              return new Date(timestamp * 1000).toLocaleString('zh-CN');
            },
          },
        ]}
        dataSource={items}
        pagination={false}
        scroll={{ y: 'calc(100vh - 250px)' }}
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
        })}
      />

      {/* Image Preview Modal */}
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
              if (!visible) {
                setPreviewImage('');
              }
            },
          }}
        />
      )}
    </div>
  );
};

export default FileListView;