import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Descriptions, Divider } from 'antd';
import { UserOutlined, LockOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readonlyInfo, setReadonlyInfo] = useState({});

  // 加载设置数据
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/admin-api/setting');
      if (response.ok) {
        const settings = await response.json();
        form.setFieldsValue({
          admin_user: settings.admin_user || '',
          admin_password: '' // 密码字段不显示当前值
        });
      } else {
        message.error('加载设置失败');
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载只读信息
  const loadReadonlyInfo = async () => {
    try {
      const response = await authFetch('/admin-api/readonly-setting');
      if (response.ok) {
        const info = await response.json();
        setReadonlyInfo(info);
      }
    } catch (error) {
      console.error('加载系统信息失败:', error);
    }
  };

  // 保存设置
  const handleSave = async (values) => {
    setSaving(true);
    try {
      // 只提交有值的字段
      const updateData = {};
      if (values.admin_user && values.admin_user.trim()) {
        updateData.admin_user = values.admin_user.trim();
      }
      if (values.admin_password && values.admin_password.trim()) {
        updateData.admin_password = values.admin_password.trim();
      }

      if (Object.keys(updateData).length === 0) {
        message.warning('请至少修改一个设置项');
        return;
      }

      const response = await authFetch('/admin-api/setting', {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        message.success('设置保存成功');
        // 清空密码字段
        form.setFieldValue('admin_password', '');
      } else {
        message.error('设置保存失败');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  // Set page title
  useEffect(() => {
    document.title = '系统设置 - Momoka 图床';
  }, []);

  useEffect(() => {
    loadSettings();
    loadReadonlyInfo();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>系统设置</h2>
        <Button
          type="primary"
          onClick={() => form.submit()}
          loading={saving}
          size="large"
        >
          保存设置
        </Button>
      </div>
      
      <div style={{ maxWidth: 600 }}>
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            autoComplete="off"
          >
            <Form.Item
              label="管理员用户名"
              name="admin_user"
              rules={[
                { required: true, message: '请输入管理员用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' },
                { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入管理员用户名"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="管理员密码"
              name="admin_password"
              rules={[
                { min: 6, message: '密码至少6个字符' },
                { max: 50, message: '密码最多50个字符' }
              ]}
              extra="留空表示不修改密码"
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入新密码（留空不修改）"
                size="large"
              />
            </Form.Item>
          </Form>
        </Spin>
        
        <Divider />
        
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <InfoCircleOutlined style={{ marginRight: '8px' }} />
            系统信息
          </h3>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="S3 端点">{readonlyInfo.s3_endpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 存储桶">{readonlyInfo.s3_bucket || '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 区域">{readonlyInfo.s3_region || '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 访问密钥ID">{readonlyInfo.s3_access_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="S3 前缀">{readonlyInfo.s3_prefix || '-'}</Descriptions.Item>
            <Descriptions.Item label="数据路径">{readonlyInfo.data_path || '-'}</Descriptions.Item>
            <Descriptions.Item label="自动清理天数">{readonlyInfo.auto_clean_days || '-'}</Descriptions.Item>
            <Descriptions.Item label="自动清理项目数">{readonlyInfo.auto_clean_items || '-'}</Descriptions.Item>
            <Descriptions.Item label="启动时间">
              {readonlyInfo.boot_time ? new Date(readonlyInfo.boot_time * 1000).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {readonlyInfo.boot_since ? `${Math.floor(readonlyInfo.boot_since / 3600)}小时${Math.floor((readonlyInfo.boot_since % 3600) / 60)}分钟` : '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>
    </div>
  );
};

export default Settings;