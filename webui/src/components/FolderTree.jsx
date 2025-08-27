import React, { useState, useEffect, useRef } from 'react';
import { Tree, Dropdown, Modal, Input, message, Button } from 'antd';
import {
  FolderOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  DragOutlined
} from '@ant-design/icons';
import { authFetch } from '../utils/api';

const FolderTree = ({ onFolderSelect, selectedFolderId, onFolderUpdate }) => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(['0']);
  const [selectedKeys, setSelectedKeys] = useState(['0']);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFolderName, setRenameFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState(0);
  const [renameFolderId, setRenameFolderId] = useState(null);
  const [moveFolderId, setMoveFolderId] = useState(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState(0);
  const treeRef = useRef(null);

  // 获取文件夹树
  const fetchFolderTree = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/admin-api/folder/tree');
      if (response.ok) {
        const data = await response.json();
        const formattedData = formatTreeData(data);
        setTreeData(formattedData);
      } else {
        message.error('获取文件夹树失败');
      }
    } catch (error) {
      console.error('获取文件夹树失败:', error);
      message.error('获取文件夹树失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化树数据
  const formatTreeData = (folders) => {
    const rootNode = {
      title: '根目录',
      key: '0',
      icon: <FolderOutlined />,
      children: folders ? folders.map(formatNode) : []
    };
    return [rootNode];
  };

  const formatNode = (folder) => ({
    title: folder.name,
    key: folder.id.toString(),
    icon: <FolderOutlined />,
    children: folder.children ? folder.children.map(formatNode) : [],
    isLeaf: !folder.children || folder.children.length === 0
  });

  useEffect(() => {
    fetchFolderTree();
  }, []);

  useEffect(() => {
    if (selectedFolderId !== undefined) {
      setSelectedKeys([selectedFolderId.toString()]);
    }
  }, [selectedFolderId]);

  // 处理节点选择
  const handleSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0) {
      const folderId = parseInt(selectedKeys[0]);
      setSelectedKeys(selectedKeys);
      onFolderSelect && onFolderSelect(folderId);
    }
  };

  // 处理右键菜单
  const handleRightClick = (info) => {
    const { event, node } = info;
    event.preventDefault();
    setContextMenuNode(node);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuVisible(true);
  };

  // 隐藏右键菜单
  const hideContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuNode(null);
  };

  // 创建文件夹
  const handleCreateFolder = () => {
    setParentFolderId(parseInt(contextMenuNode.key));
    setNewFolderName('');
    setCreateModalVisible(true);
    hideContextMenu();
  };

  // 重命名文件夹
  const handleRenameFolder = () => {
    setRenameFolderId(parseInt(contextMenuNode.key));
    setRenameFolderName(contextMenuNode.title);
    setRenameModalVisible(true);
    hideContextMenu();
  };

  // 删除文件夹
  const handleDeleteFolder = () => {
    const folderId = parseInt(contextMenuNode.key);
    if (folderId === 0) {
      message.error('根目录不能删除');
      hideContextMenu();
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件夹 "${contextMenuNode.title}" 吗？此操作将同时删除文件夹内的所有内容。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await authFetch(`/admin-api/folder?id=${folderId}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            message.success('文件夹删除成功');
            fetchFolderTree();
            onFolderUpdate && onFolderUpdate();
            // 如果删除的是当前选中的文件夹，切换到根目录
            if (selectedKeys[0] === folderId.toString()) {
              setSelectedKeys(['0']);
              onFolderSelect && onFolderSelect(0);
            }
          } else {
            message.error('删除文件夹失败');
          }
        } catch (error) {
          console.error('删除文件夹失败:', error);
          message.error('删除文件夹失败');
        }
      }
    });
    hideContextMenu();
  };

  // 确认创建文件夹
  const confirmCreateFolder = async () => {
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
          parent_id: parentFolderId,
          public: false
        })
      });

      if (response.ok) {
        message.success('文件夹创建成功');
        setCreateModalVisible(false);
        setNewFolderName('');
        fetchFolderTree();
        onFolderUpdate && onFolderUpdate();
        // 展开父文件夹
        if (!expandedKeys.includes(parentFolderId.toString())) {
          setExpandedKeys([...expandedKeys, parentFolderId.toString()]);
        }
      } else {
        message.error('创建文件夹失败');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      message.error('创建文件夹失败');
    }
  };

  // 确认重命名文件夹
  const confirmRenameFolder = async () => {
    if (!renameFolderName.trim()) {
      message.error('文件夹名称不能为空');
      return;
    }

    try {
      const response = await authFetch(`/admin-api/folder?id=${renameFolderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: renameFolderName.trim()
        })
      });

      if (response.ok) {
        message.success('文件夹重命名成功');
        setRenameModalVisible(false);
        setRenameFolderName('');
        setRenameFolderId(null);
        fetchFolderTree();
        onFolderUpdate && onFolderUpdate();
      } else {
        message.error('重命名文件夹失败');
      }
    } catch (error) {
      console.error('重命名文件夹失败:', error);
      message.error('重命名文件夹失败');
    }
  };

  // 处理移动文件夹
  const handleMoveFolder = () => {
    if (!contextMenuNode) return;
    setMoveFolderId(parseInt(contextMenuNode.key));
    setMoveTargetFolderId(0); // 默认移动到根目录
    setMoveModalVisible(true);
    hideContextMenu();
  };

  // 确认移动文件夹
  const confirmMoveFolder = async () => {
    if (moveFolderId === moveTargetFolderId) {
      message.error('不能移动到自身');
      return;
    }

    // 检查是否移动到自己的子文件夹
    const isMovingToChild = (folderId, targetId, tree) => {
      for (const folder of tree) {
        if (folder.id === folderId) {
          return checkIsChild(targetId, folder.children || []);
        }
        if (folder.children && folder.children.length > 0) {
          const result = isMovingToChild(folderId, targetId, folder.children);
          if (result) return true;
        }
      }
      return false;
    };

    const checkIsChild = (targetId, children) => {
      for (const child of children) {
        if (child.id === targetId) return true;
        if (child.children && child.children.length > 0) {
          if (checkIsChild(targetId, child.children)) return true;
        }
      }
      return false;
    };

    // 获取原始树数据进行检查
    try {
      const response = await authFetch('/admin-api/folder/tree');
      if (response.ok) {
        const treeData = await response.json();
        if (isMovingToChild(moveFolderId, moveTargetFolderId, treeData)) {
          message.error('不能移动到自己的子文件夹');
          return;
        }
      }
    } catch (error) {
      console.error('检查文件夹层级关系失败:', error);
    }

    try {
      const response = await authFetch(`/admin-api/folder?id=${moveFolderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent_id: moveTargetFolderId
        })
      });

      if (response.ok) {
        message.success('文件夹移动成功');
        setMoveModalVisible(false);
        setMoveFolderId(null);
        setMoveTargetFolderId(0);
        fetchFolderTree();
        onFolderUpdate && onFolderUpdate();
      } else {
        message.error('移动文件夹失败');
      }
    } catch (error) {
      console.error('移动文件夹失败:', error);
      message.error('移动文件夹失败');
    }
  };

  // 右键菜单项
  const contextMenuItems = [
    {
      key: 'create',
      icon: <PlusOutlined />,
      label: '新建文件夹',
      onClick: handleCreateFolder
    },
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: handleRenameFolder,
      disabled: contextMenuNode?.key === '0' // 根目录不能重命名
    },
    {
      key: 'move',
      icon: <DragOutlined />,
      label: '移动',
      onClick: handleMoveFolder,
      disabled: contextMenuNode?.key === '0' // 根目录不能移动
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      onClick: handleDeleteFolder,
      disabled: contextMenuNode?.key === '0', // 根目录不能删除
      danger: true
    }
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部新建按钮区域 */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
        flexShrink: 0
      }}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => {
            setParentFolderId(parseInt(selectedKeys[0]) || 0);
            setNewFolderName('');
            setCreateModalVisible(true);
          }}
          style={{
            width: '100%',
            height: '32px',
            border: '1px dashed #d9d9d9',
            borderRadius: '6px',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontSize: '13px'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#1890ff';
            e.target.style.color = '#1890ff';
            e.target.style.background = '#f6ffed';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#d9d9d9';
            e.target.style.color = '#666';
            e.target.style.background = 'transparent';
          }}
        >
          新建文件夹
        </Button>
      </div>
      
      {/* 文件夹树区域 - 占满剩余空间 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '8px 0'
      }}>
        <Tree
          ref={treeRef}
          treeData={treeData}
          loading={loading}
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onSelect={handleSelect}
          onExpand={setExpandedKeys}
          onRightClick={handleRightClick}
          showIcon
          blockNode
          defaultExpandAll
          style={{ 
            background: 'transparent',
            padding: '0 8px',
            height: '100%'
          }}
        />
      </div>

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

      {/* 创建文件夹模态框 */}
      <Modal
        title="新建文件夹"
        open={createModalVisible}
        onOk={confirmCreateFolder}
        onCancel={() => {
          setCreateModalVisible(false);
          setNewFolderName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={confirmCreateFolder}
          autoFocus
        />
      </Modal>

      {/* 重命名文件夹模态框 */}
      <Modal
        title="重命名文件夹"
        open={renameModalVisible}
        onOk={confirmRenameFolder}
        onCancel={() => {
          setRenameModalVisible(false);
          setRenameFolderName('');
          setRenameFolderId(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新的文件夹名称"
          value={renameFolderName}
          onChange={(e) => setRenameFolderName(e.target.value)}
          onPressEnter={confirmRenameFolder}
          autoFocus
        />
      </Modal>

      {/* 移动文件夹模态框 */}
      <Modal
        title="移动文件夹"
        open={moveModalVisible}
        onOk={confirmMoveFolder}
        onCancel={() => {
          setMoveModalVisible(false);
          setMoveFolderId(null);
          setMoveTargetFolderId(0);
        }}
        okText="移动"
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
                children: treeData
              }
            ]}
            selectedKeys={[moveTargetFolderId.toString()]}
            onSelect={(selectedKeys) => {
              if (selectedKeys.length > 0) {
                setMoveTargetFolderId(parseInt(selectedKeys[0]));
              }
            }}
            defaultExpandAll
            showIcon
            titleRender={(nodeData) => {
              const isDisabled = nodeData.key === moveFolderId?.toString();
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

export default FolderTree;