import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Text } = Typography;

const BaseUrlSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings data
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/admin-api/setting');
      if (response.ok) {
        const settings = await response.json();
        form.setFieldsValue({
          base_url: settings.base_url || ''
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

  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings
  const handleSave = async (values) => {
    setSaving(true);
    try {
      const updateData = {};
      if (values.base_url !== undefined) {
        updateData.base_url = values.base_url.trim();
      }

      const response = await authFetch('/admin-api/setting', {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        message.success('基础URL设置保存成功');
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

  return (
    <div style={{ maxWidth: 600 }}>
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            autoComplete="off"
          >
            <Form.Item
              label="基础URL"
              name="base_url"
              extra={
                <Text type="secondary">
                  设置系统的基础访问URL，用于生成图片链接等。例如：https://your-domain.com
                </Text>
              }
              rules={[
                {
                  type: 'url',
                  message: '请输入有效的URL格式'
                }
              ]}
            >
              <Input
                prefix={<LinkOutlined />}
                placeholder="https://your-domain.com"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                size="large"
              >
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </Spin>
    </div>
  );
};

export default BaseUrlSettings;