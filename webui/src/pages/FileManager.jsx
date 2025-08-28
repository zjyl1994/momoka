import React, { useState, useEffect } from 'react';
import { Layout, Card, Breadcrumb, Button, message, Spin, Modal, Input, Checkbox } from 'antd';
import { CloudUploadOutlined, HomeOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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

  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  // 获取文件夹树
  const fetchFolderTree = async () => {
    try {
      const response = await authFetch('/admin-api/folder/tree');
      if (response.ok) {
        const data = await response.json();
        setFolderTree(data);
      }
    } catch (error) {
      console.error('获取文件夹树失败:', error);
    }
  };

  // 获取文件夹路径
  const fetchFolderPath = async (folderId) => {
    if (folderId === 0) {
      setFolderPath([{ id: 0, name: '根目录' }]);
      return;
    }

    try {
      const response = await authFetch(`/admin-api/folder?id=${folderId}&meta_only=true`);
      if (response.ok) {
        const data = await response.json();
        const folder = data.meta;
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
        }
      }
    } catch (error) {
      console.error('获取文件夹路径失败:', error);
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

  useEffect(() => {
    fetchFolderTree();
  }, []);

  useEffect(() => {
    if (folderTree.length > 0) {
      fetchFolderPath(selectedFolderId);
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

  // 处理新建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('文件夹名称不能为空');
      return;
    }

    try {
      const response = await authFetch('/admin-api/folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: selectedFolderId,
          public: newFolderPublic
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

    for (const file of imageFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', selectedFolderId);

        const response = await authFetch('/admin-api/image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
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
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Layout style={{ height: '100vh', background: '#fff' }}>
        {/* 主内容区域 */}
        <Layout style={{ background: '#fff', height: '100vh', overflow: 'hidden' }}>
          {/* 顶部工具栏 */}
          <div
            style={{
              background: '#fff',
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
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
              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateFolderModalVisible(true)}
              >
                新建文件夹
              </Button>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={() => navigate('/admin/images-upload')}
              >
                批量上传
              </Button>
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
                <CloudUploadOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
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
    </div>
  );
};

export default FileManager;