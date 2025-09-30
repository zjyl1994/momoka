import React, { useState, useEffect } from 'react';
import { Card, Form, Switch, Button, message, Spin, Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Text } = Typography;

const ImageConversionSettings = () => {
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
          auto_conv_webp: settings.auto_conv_webp === 'true',
          auto_conv_avif: settings.auto_conv_avif === 'true'
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

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings
  const handleSave = async (values) => {
    setSaving(true);
    try {
      const updateData = {
        auto_conv_webp: values.auto_conv_webp ? 'true' : 'false',
        auto_conv_avif: values.auto_conv_avif ? 'true' : 'false'
      };

      const response = await authFetch('/admin-api/setting', {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        message.success('设置保存成功');
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
            label="自动转换 WebP 格式"
            name="auto_conv_webp"
            valuePropName="checked"
            extra={
              <Text type="secondary">
                启用后，访问图片时将生成并提供 WebP 格式的副本，提供更好的压缩效果和加载速度
              </Text>
            }
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="自动转换 AVIF 格式"
            name="auto_conv_avif"
            valuePropName="checked"
            extra={
              <Text type="secondary">
                启用后，访问图片时将生成并提供 AVIF 格式的副本，提供最新的图像压缩技术
              </Text>
            }
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              size="large"
              icon={<PictureOutlined />}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
};

export default ImageConversionSettings;