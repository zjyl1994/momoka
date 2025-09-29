import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';
import { useAuthStore } from '../stores/authStore.jsx';

const { Text } = Typography;

const SiteNameSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { refreshSiteInfo } = useAuthStore();

  // Load settings data
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/admin-api/setting');
      if (response.ok) {
        const settings = await response.json();
        form.setFieldsValue({
          site_name: settings.site_name || 'Momoka 图床'
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
      if (values.site_name !== undefined) {
        updateData.site_name = values.site_name.trim() || 'Momoka 图床';
      }

      const response = await authFetch('/admin-api/setting', {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        message.success('站点名称设置保存成功');
        // 刷新站点信息以更新缓存
        await refreshSiteInfo();
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
              label="站点名称"
              name="site_name"
              extra={
                <Text type="secondary">
                  设置系统的站点名称，将显示在登录页面、后台管理界面等位置
                </Text>
              }
              rules={[
                {
                  max: 50,
                  message: '站点名称不能超过50个字符'
                }
              ]}
            >
              <Input
                prefix={<EditOutlined />}
                placeholder="Momoka 图床"
                size="large"
                maxLength={50}
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

export default SiteNameSettings;