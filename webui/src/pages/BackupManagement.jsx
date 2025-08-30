import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message, Modal, Input, Space, Popconfirm } from 'antd';
import { PlusOutlined, CloudDownloadOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null); // Track which backup is being restored
  const [deletingBackup, setDeletingBackup] = useState(null); // Track which backup is being deleted

  // Load backup list
  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/admin-api/backup');
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      const data = await response.json();
      setBackups(data || []);
    } catch (error) {
      console.error('Error loading backups:', error);
      message.error('加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Create backup
  const handleCreateBackup = async () => {
    if (!backupName.trim()) {
      message.error('请输入备份名称');
      return;
    }

    try {
      setCreating(true);
      const response = await authFetch('/admin-api/backup/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: backupName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create backup');
      }

      message.success('备份创建成功');
      setCreateModalVisible(false);
      setBackupName('');
      loadBackups();
    } catch (error) {
      console.error('Error creating backup:', error);
      message.error('创建备份失败');
    } finally {
      setCreating(false);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (backupFileName) => {
    try {
      setRestoringBackup(backupFileName); // Set which backup is being restored
      const response = await authFetch('/admin-api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: backupFileName }),
      });

      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }

      message.success('备份恢复成功');
    } catch (error) {
      console.error('Error restoring backup:', error);
      message.error('恢复备份失败');
    } finally {
      setRestoringBackup(null); // Clear restoring state
    }
  };

  // Delete backup
  const handleDeleteBackup = async (backupFileName) => {
    try {
      setDeletingBackup(backupFileName); // Set which backup is being deleted
      const response = await authFetch(`/admin-api/backup?name=${encodeURIComponent(backupFileName)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete backup');
      }

      message.success('备份删除成功');
      loadBackups(); // Reload backup list
    } catch (error) {
      console.error('Error deleting backup:', error);
      message.error('删除备份失败');
    } finally {
      setDeletingBackup(null); // Clear deleting state
    }
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

  // Table columns
  const columns = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size),
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'mod_time',
      key: 'modTime',
      render: (time) => formatDate(time),
      width: 180,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定要恢复此备份吗？"
            description="恢复备份将覆盖当前所有数据，此操作不可逆！"
            onConfirm={() => handleRestoreBackup(record.name)}
            okText="确定"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="primary"
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={restoringBackup === record.name}
              disabled={restoringBackup !== null && restoringBackup !== record.name || deletingBackup !== null}
            >
              恢复
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要删除此备份吗？"
            description="删除后无法恢复，请谨慎操作！"
            onConfirm={() => handleDeleteBackup(record.name)}
            okText="确定"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="default"
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingBackup === record.name}
              disabled={deletingBackup !== null && deletingBackup !== record.name || restoringBackup !== null}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    loadBackups();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div><InfoCircleOutlined /> 此处只能备份元数据信息到S3，包括但不限于图片信息/文件夹结构/系统设置等。图片本身的安全性依赖S3存储桶。</div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          loading={creating}
          disabled={restoringBackup !== null || deletingBackup !== null}
        >
          创建备份
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={backups}
        loading={loading || creating || restoringBackup !== null || deletingBackup !== null}
        rowKey="name"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个备份`,
        }}
        locale={{
          emptyText: '暂无备份数据',
        }}
      />

      <Modal
        title="创建备份"
        open={createModalVisible}
        onOk={handleCreateBackup}
        onCancel={() => {
          setCreateModalVisible(false);
          setBackupName('');
        }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <label>备份名称：</label>
          <Input
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            placeholder="请输入备份名称"
            onPressEnter={handleCreateBackup}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default BackupManagement;