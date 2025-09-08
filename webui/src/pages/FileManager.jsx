import React, { useState, useEffect } from 'react';
import { Layout, Card, Breadcrumb, Button, message, Spin, Modal, Input, Checkbox, Space, Typography, Tree } from 'antd';
import { HomeOutlined, FolderOutlined, PlusOutlined, DeleteOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import FileListView from '../components/FileListView';
import { authFetch } from '../utils/api';

const { Content } = Layout;

const FileManager = () => {
  const [selectedFolderId, setSelectedFolderId] = useState(0);
  const [folderTree, setFolderTree] = useState([]);
  const [folderPath, setFolderPath] = useState([{ id: 0, name: '根目录' }]);
  const [uploading, setUploading] = useState(false);
  const [createFolderModalVisible, setCreateFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPublic, setNewFolderPublic] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [clearSelectionFn, setClearSelectionFn] = useState(null);
  const [selectAllFn, setSelectAllFn] = useState(null);
  const [currentItems, setCurrentItems] = useState([]);
  const [batchMoveModalVisible, setBatchMoveModalVisible] = useState(false);
  const [batchMoveTargetFolderId, setBatchMoveTargetFolderId] = useState(null);
  const [batchDeleteModalVisible, setBatchDeleteModalVisible] = useState(false);

  const [dragOver, setDragOver] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = '文件管理 - Momoka 图床';
  }, []);

  // 获取文件夹树
  const fetchFolderTree = async () => {
    try {
      const response = await authFetch('/admin-api/file/tree');
      if (response.ok) {
        const data = await response.json();
        setFolderTree(data);
      }
    } catch (error) {
      console.error('获取文件夹树失败:', error);
    }
  };

  // 构建文件夹路径（优化版本，直接使用folderTree数据）
  const buildFolderPath = (folderId) => {
    if (folderId === 0) {
      setFolderPath([{ id: 0, name: '根目录' }]);
      return;
    }

    const folder = findFolderInTree(folderId, folderTree);
    if (folder) {
      // 递归构建路径
      const buildPath = (currentFolder, tree) => {
        const path = [{ id: currentFolder.id, name: currentFolder.name }];
        if (currentFolder.parent_id !== 0) {
          const parent = findFolderInTree(currentFolder.parent_id, tree);
          if (parent) {
            path.unshift(...buildPath(parent, tree));
          }
        } else {
          path.unshift({ id: 0, name: '根目录' });
        }
        return path;
      };

      const path = buildPath(folder, folderTree);
      setFolderPath(path);
    } else {
      // 如果在树中找不到文件夹，设置为根目录
      setFolderPath([{ id: 0, name: '根目录' }]);
    }
  };

  // 在树中查找文件夹
  const findFolderInTree = (folderId, tree) => {
    for (const folder of tree) {
      if (folder.id === folderId) {
        return folder;
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolderInTree(folderId, folder.children);
        if (found) return found;
      }
    }
    return null;
  };

  // 构建当前路径字符串
  const getCurrentPath = () => {
    if (folderPath.length === 0 || folderPath[0].id === 0) {
      return '/';
    }
    return folderPath.slice(1).map(folder => folder.name).join('/');
  };

  // 根据文件夹ID构建路径字符串
  const getPathByFolderId = (folderId) => {
    if (folderId === 0) {
      return '/';
    }
    
    const folder = findFolderInTree(folderId, folderTree);
    if (!folder) {
      return '/';
    }
    
    // 递归构建路径
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
    
    const pathArray = buildPath(folder, folderTree);
    return '/' + pathArray.join('/');
  };

  useEffect(() => {
    fetchFolderTree();
  }, []);

  useEffect(() => {
    if (folderTree.length > 0) {
      buildFolderPath(selectedFolderId);
    }
  }, [selectedFolderId, folderTree]);

  // 处理文件夹选择
  const handleFolderSelect = (folderId) => {
    setSelectedFolderId(folderId);
  };

  // 处理文件夹更新
  const handleFolderUpdate = () => {
    fetchFolderTree();
  };

  // 处理图片更新
  const handleImageUpdate = () => {
    // 图片更新时可能需要刷新其他数据
  };

  // 处理面包屑点击
  const handleBreadcrumbClick = (folderId) => {
    setSelectedFolderId(folderId);
  };

  // 处理选中状态变化
  const handleSelectionChange = (selectedKeys, selectedRows, clearFn, selectAllFn) => {
    setSelectedRowKeys(selectedKeys);
    setSelectedItems(selectedRows);
    if (clearFn) {
      setClearSelectionFn(() => clearFn);
    }
    if (selectAllFn) {
      setSelectAllFn(() => selectAllFn);
    }
  };

  // 处理items变化
  const handleItemsChange = (items) => {
    setCurrentItems(items);
  };

  // 清空选中状态
  const clearSelection = () => {
    if (clearSelectionFn) {
      clearSelectionFn();
    }
  };

  // 全选当前文件夹中的所有项目
  const selectAll = () => {
    if (selectAllFn) {
      selectAllFn();
    } else {
      message.warning('全选功能暂不可用');
    }
  };

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+A 全选
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      // Delete 键删除选中项
      if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        handleBatchDelete();
      }
      // Escape 键取消选择
      if (e.key === 'Escape' && selectedItems.length > 0) {
        e.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItems]);

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedItems.length === 0) {
      message.warning('请先选择要删除的项目');
      return;
    }
    
    // Debug: Add console log to check if function is called
    console.log('handleBatchDelete called, selectedItems:', selectedItems);
    
    // Use custom modal instead of Modal.confirm
    setBatchDeleteModalVisible(true);
  };
  
  // 确认批量删除
  const confirmBatchDelete = async () => {
    console.log('Modal confirmed, starting batch delete');
    setBatchDeleteModalVisible(false);
    await performBatchDelete();
  };
  
  // 取消批量删除
  const cancelBatchDelete = () => {
    console.log('Modal cancelled');
    setBatchDeleteModalVisible(false);
  };

  // 执行批量删除
  const performBatchDelete = async () => {
    const currentPath = getCurrentPath();
    
    // 构建所有选中项目的完整路径
    const paths = selectedItems.map(item => {
      return currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    });

    try {
      const response = await authFetch('/admin-api/file/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          paths: paths
        })
      });
      
      if (response.ok) {
        message.success(`成功删除 ${selectedItems.length} 个项目`);
        // 刷新文件列表
        handleFolderUpdate();
        handleImageUpdate();
        // 清空选中状态
        clearSelection();
        // 刷新当前页面
        window.location.reload();
      } else {
        const errorData = await response.json().catch(() => ({}));
        message.error(`批量删除失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      message.error(`批量删除失败: ${error.message}`);
    }
  };

   // 批量移动
    const handleBatchMove = () => {
      if (selectedItems.length === 0) {
        message.warning('请先选择要移动的项目');
        return;
      }
      setBatchMoveTargetFolderId(selectedFolderId);
      setBatchMoveModalVisible(true);
    };

    // 执行批量移动
    const performBatchMove = async () => {
      if (batchMoveTargetFolderId === null) {
        message.error('请选择目标文件夹');
        return;
      }

      const currentPath = getCurrentPath();
      const targetPath = getPathByFolderId(batchMoveTargetFolderId);
      
      // 构建所有选中项目的源路径和目标路径
      const moveOperations = selectedItems.map(item => {
        const sourcePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const destinationPath = targetPath === '/' ? `/${item.name}` : `${targetPath}/${item.name}`;
        return {
          src: sourcePath,
          dst: destinationPath
        };
      });

      try {
        const response = await authFetch('/admin-api/file/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'move',
            paths: moveOperations
          })
        });
        
        if (response.ok) {
          message.success(`成功移动 ${selectedItems.length} 个项目`);
          // 刷新文件列表
          handleFolderUpdate();
          handleImageUpdate();
          // 清空选中状态
          clearSelection();
          // 关闭模态框
          setBatchMoveModalVisible(false);
          setBatchMoveTargetFolderId(null);
          // 刷新当前页面
          window.location.reload();
        } else {
          const errorData = await response.json().catch(() => ({}));
          message.error(`批量移动失败: ${errorData.error || '未知错误'}`);
        }
      } catch (error) {
        message.error(`批量移动失败: ${error.message}`);
      }
    };

    // 转换文件夹树为Tree组件数据
  const convertToTreeData = (treeData) => {
    // 如果是单个对象（根节点），处理其children
    if (treeData && !Array.isArray(treeData)) {
      if (treeData.children && treeData.children.length > 0) {
        return treeData.children.map(folder => ({
          title: folder.name,
          key: folder.id.toString(),
          icon: <FolderOutlined />,
          children: folder.children && folder.children.length > 0 ? convertToTreeData(folder.children) : undefined
        }));
      }
      return [];
    }
    // 如果是数组，按原逻辑处理
    if (Array.isArray(treeData)) {
      return treeData.map(folder => ({
        title: folder.name,
        key: folder.id.toString(),
        icon: <FolderOutlined />,
        children: folder.children && folder.children.length > 0 ? convertToTreeData(folder.children) : undefined
      }));
    }
    return [];
  };

  // 处理新建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('文件夹名称不能为空');
      return;
    }

    try {
      const currentPath = getCurrentPath();
      const newFolderPath = currentPath === '/' ? `/${newFolderName.trim()}` : `${currentPath}/${newFolderName.trim()}`;
      
      const response = await authFetch('/admin-api/file/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mkdir',
          dst: newFolderPath
        })
      });

      if (response.ok) {
        message.success('文件夹创建成功');
        setCreateFolderModalVisible(false);
        setNewFolderName('');
        setNewFolderPublic(false);
        handleFolderUpdate();
        // 刷新当前文件夹内容
        window.location.reload();
      } else {
        message.error('创建文件夹失败');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      message.error('创建文件夹失败');
    }
  };

  // 处理文件上传
  const handleFileUpload = async (files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      message.warning('请选择图片文件');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    // 获取当前路径
    const currentPath = getCurrentPath();

    for (const file of imageFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);

        const response = await authFetch('/admin-api/file/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('上传失败:', error);
        failCount++;
      }
    }

    setUploading(false);
    
    if (successCount > 0) {
      message.success(`成功上传 ${successCount} 张图片`);
      handleImageUpdate();
      // 刷新当前文件夹的图片
      window.location.reload();
    }
    
    if (failCount > 0) {
      message.error(`${failCount} 张图片上传失败`);
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Layout style={{ height: '100%', background: '#fff' }}>
        {/* 主内容区域 */}
        <Layout style={{ background: '#fff', height: '100%', overflow: 'hidden' }}>
          {/* 顶部工具栏 */}
          <div
            style={{
              background: '#fff',
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {/* 主工具栏 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* 面包屑导航 */}
              <Breadcrumb>
                {folderPath.map((folder, index) => (
                  <Breadcrumb.Item
                    key={folder.id}
                    onClick={() => index < folderPath.length - 1 && handleBreadcrumbClick(folder.id)}
                    style={{
                      cursor: index < folderPath.length - 1 ? 'pointer' : 'default',
                      color: index < folderPath.length - 1 ? '#1890ff' : 'inherit'
                    }}
                  >
                    {index === 0 ? (
                      <><HomeOutlined /> {folder.name}</>
                    ) : (
                      <><FolderOutlined /> {folder.name}</>
                    )}
                  </Breadcrumb.Item>
                ))}
              </Breadcrumb>
            </div>

            {/* 右侧操作按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* 批量操作按钮组 */}
              {selectedItems.length > 0 && (
                <>
                  <Typography.Text style={{ marginRight: '8px', alignSelf: 'center' }}>
                    已选中 {selectedItems.length} 个项目
                  </Typography.Text>
                  {selectedItems.length < currentItems.length && (
                    <Button
                      icon={<CheckOutlined />}
                      onClick={selectAll}
                    >
                      全选
                    </Button>
                  )}
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    onClick={handleBatchDelete}
                  >
                    批量删除
                  </Button>
                  <Button
                    icon={<FolderOutlined />}
                    onClick={handleBatchMove}
                  >
                    批量移动
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={clearSelection}
                  >
                    取消选择
                  </Button>
                </>
              )}
              
              {/* 常规操作按钮 */}
              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateFolderModalVisible(true)}
                type="primary"
              >
                新建文件夹
              </Button>
            </div>
          </div>
          </div>

          {/* 主内容区域 */}
          <Content 
            style={{ height: 'calc(100% - 73px)', background: '#fff', position: 'relative', overflow: 'hidden' }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDragOver(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0) {
                handleFileUpload(files);
              }
            }}
          >
            {/* 文件列表视图 */}
            <FileListView
              folderId={selectedFolderId}
              onImageUpdate={handleImageUpdate}
              onFolderUpdate={handleFolderUpdate}
              folderTree={folderTree}
              onFolderSelect={handleFolderSelect}
              onSelectionChange={handleSelectionChange}
              onItemsChange={handleItemsChange}
            />
            
            {/* 拖拽提示层 */}
            {dragOver && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(24, 144, 255, 0.1)',
                  border: '2px dashed #1890ff',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 1000,
                  pointerEvents: 'none'
                }}
              >
                <FolderOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <div style={{ fontSize: '18px', color: '#1890ff', fontWeight: 500 }}>
                  拖拽图片到此处上传
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                  支持 JPG、PNG、GIF 格式
                </div>
              </div>
            )}

            {/* 上传中遮罩 */}
            {uploading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 1000
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px', fontSize: '16px' }}>正在上传...</div>
                </div>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>

      {/* 新建文件夹模态框 */}
      <Modal
        title="新建文件夹"
        open={createFolderModalVisible}
        onOk={handleCreateFolder}
        onCancel={() => {
           setCreateFolderModalVisible(false);
           setNewFolderName('');
           setNewFolderPublic(false);
         }}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
           <Input
             value={newFolderName}
             onChange={(e) => setNewFolderName(e.target.value)}
             placeholder="请输入文件夹名称"
             onPressEnter={handleCreateFolder}
           />
         </div>
         <Checkbox
           checked={newFolderPublic}
           onChange={(e) => setNewFolderPublic(e.target.checked)}
         >
           公开文件夹
         </Checkbox>
      </Modal>

      {/* 批量移动模态框 */}
      <Modal
        title={`批量移动 ${selectedItems.length} 个项目`}
        open={batchMoveModalVisible}
        onOk={performBatchMove}
        onCancel={() => {
          setBatchMoveModalVisible(false);
          setBatchMoveTargetFolderId(null);
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
            selectedKeys={[batchMoveTargetFolderId?.toString() || '']}
            onSelect={(selectedKeys) => {
              if (selectedKeys.length > 0) {
                setBatchMoveTargetFolderId(parseInt(selectedKeys[0]));
              }
            }}
            defaultExpandAll
            showIcon
            titleRender={(nodeData) => {
              // 检查是否有文件夹试图移动到自身或其子文件夹
              const hasConflict = selectedItems.some(item => {
                if (item.type === 'folder') {
                  return nodeData.key === item.id.toString();
                }
                return false;
              });
              
              return (
                <span style={{ color: hasConflict ? '#ccc' : 'inherit' }}>
                  {nodeData.title}
                  {hasConflict && ' (不能移动到自身)'}
                </span>
              );
            }}
          />
        </div>
        <div style={{ marginTop: 16, padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            将要移动的项目：{selectedItems.map(item => item.name).join(', ')}
          </Typography.Text>
        </div>
      </Modal>

      {/* 批量删除确认模态框 */}
      <Modal
        title="确认批量删除"
        open={batchDeleteModalVisible}
        onOk={confirmBatchDelete}
        onCancel={cancelBatchDelete}
        okText="确定"
        cancelText="取消"
        okType="danger"
        centered
      >
        <p>
          确定要删除选中的 <strong>{selectedItems.length}</strong> 个项目吗？此操作不可撤销。
        </p>
        <div style={{ marginTop: 16, padding: '8px', background: '#fff2f0', borderRadius: '4px', border: '1px solid #ffccc7' }}>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            将要删除的项目：{selectedItems.map(item => item.name).join(', ')}
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
};

export default FileManager;