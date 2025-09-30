import React, { useState, useEffect } from 'react';
import { Descriptions, Spin, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const SystemInfo = () => {
  const [loading, setLoading] = useState(false);
  const [readonlyInfo, setReadonlyInfo] = useState({});

  // Load readonly information
  const loadReadonlyInfo = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/admin-api/readonly-setting');
      if (response.ok) {
        const info = await response.json();
        setReadonlyInfo(info);
      } else {
        message.error('加载系统信息失败');
      }
    } catch (error) {
      console.error('加载系统信息失败:', error);
      message.error('加载系统信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReadonlyInfo();
  }, []);

  return (
    <Spin spinning={loading}>
      <Descriptions 
        column={1} 
        size="small" 
        bordered={false}
        styles={{
          label: {
            backgroundColor: 'transparent',
            fontWeight: '500',
            color: 'rgba(0, 0, 0, 0.85)',
            width: '140px',
            paddingRight: '16px'
          },
          content: {
            backgroundColor: 'transparent',
            color: 'rgba(0, 0, 0, 0.65)'
          }
        }}
      >
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
    </Spin>
  );
};

export default SystemInfo;