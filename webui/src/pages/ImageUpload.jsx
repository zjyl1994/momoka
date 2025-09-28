import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Button, Form, Input, message, Space, Tabs, Tag, Progress } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import { InboxOutlined, UploadOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';
import { useAuthStore } from '../stores/authStore.jsx';

const { Dragger } = Upload;
const { TextArea } = Input;

// 复制按钮组件 - 使用React.memo优化性能
const CopyButton = React.memo(({ text, onCopy }) => (
  <Button 
    size="small" 
    icon={<CopyOutlined />}
    type="primary"
    onClick={() => {
      navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板');
      onCopy?.(text);
    }}
  />
));

// 结果链接组件 - 使用React.memo优化性能
const ResultLink = React.memo(({ result }) => {
  const linkTypes = [
    { key: 'url', label: '直链', value: result.url },
    { key: 'markdown', label: 'Markdown', value: `![${result.filename}](${result.url})` },
    { key: 'bbcode', label: 'BBCode', value: `[img]${result.url}[/img]` }
  ];

  return (
    <Tabs
      size="small"
      tabBarStyle={{ marginBottom: '12px' }}
      items={linkTypes.map(({ key, label, value }) => ({
        key,
        label,
        children: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input 
              value={value} 
              readOnly 
              size="small"
              style={{ fontSize: '12px', fontFamily: 'monospace' }}
            />
            <CopyButton text={value} />
          </div>
        )
      }))}
    />
  );
});

// 上传结果项组件 - 使用React.memo优化性能
const UploadResultItem = React.memo(({ result, index, isLast }) => (
  <div style={{
    padding: '16px',
    border: `1px solid ${result.success ? '#b7eb8f' : '#ffccc7'}`,
    borderRadius: '8px',
    marginBottom: isLast ? '0' : '16px',
    backgroundColor: result.success ? '#f6ffed' : '#fff2f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  }}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: `1px solid ${result.success ? '#d9f7be' : '#ffd8d8'}`
    }}>
      <span style={{ 
        fontWeight: 600, 
        color: result.success ? '#52c41a' : '#ff4d4f',
        fontSize: '14px'
      }}>
        {result.success ? '✓' : '✗'} {result.filename}
      </span>
      {result.success && (
        <span style={{ 
          fontSize: '12px', 
          color: '#52c41a',
          backgroundColor: '#f6ffed',
          padding: '2px 8px',
          borderRadius: '12px',
          border: '1px solid #b7eb8f'
        }}>
          上传成功
        </span>
      )}
    </div>
    
    {result.success && result.url && <ResultLink result={result} />}
    
    {!result.success && result.error && (
      <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
        错误：{result.error}
      </div>
    )}
  </div>
));

// 标签管理组件 - 使用React.memo优化性能
const TagManager = React.memo(({ tags, onTagsChange }) => {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleClose = useCallback((removedTag) => {
    onTagsChange(tags.filter(tag => tag !== removedTag));
  }, [tags, onTagsChange]);

  const handleInputConfirm = useCallback(() => {
    if (inputValue && !tags.includes(inputValue)) {
      onTagsChange([...tags, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  }, [inputValue, tags, onTagsChange]);

  const showInput = useCallback(() => {
    setInputVisible(true);
  }, []);

  return (
    <div>
      {tags.map(tag => (
        <Tag
          key={tag}
          closable
          onClose={() => handleClose(tag)}
          style={{ marginBottom: '8px' }}
        >
          {tag}
        </Tag>
      ))}
      {inputVisible ? (
        <Input
          type="text"
          size="small"
          style={{ width: 78 }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputConfirm}
          onPressEnter={handleInputConfirm}
          autoFocus
        />
      ) : (
        <Tag
          onClick={showInput}
          style={{
            background: '#fff',
            borderStyle: 'dashed',
            cursor: 'pointer'
          }}
        >
          <PlusOutlined /> 添加标签
        </Tag>
      )}
    </div>
  );
});

const ImageUpload = () => {
  const [form] = Form.useForm();
  
  // 文件相关状态
  const [fileList, setFileList] = useState([]);
  
  // 上传相关状态
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);
  
  // 标签状态
  const [tags, setTags] = useState([]);
  const { siteName, initialized } = useAuthStore();

  // 设置页面标题
  useEffect(() => {
    // 只有在站点信息初始化完成后才设置标题
    if (!initialized) return;
    document.title = `上传图片 - ${siteName}`;
  }, [siteName, initialized]);

  // 文件验证 - 使用useCallback优化性能
  const beforeUpload = useCallback((file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
      return Upload.LIST_IGNORE;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  }, []);

  // 文件变化处理 - 使用useCallback优化性能
  const handleFileChange = useCallback((info) => {
    setFileList(info.fileList);
  }, []);

  // 上传单个文件
  const uploadSingleFile = useCallback(async (file, values) => {
    const formData = new FormData();
    formData.append('file', file.originFileObj || file);
    
    if (values.remark) {
      formData.append('remark', values.remark);
    }
    
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    try {
      const response = await authFetch('/admin-api/image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        return {
          filename: file.name,
          url: result.image.url,
          success: true,
          image: result.image
        };
      } else {
        const errorData = await response.json();
        return {
          filename: file.name,
          error: errorData.error || '上传失败',
          success: false
        };
      }
    } catch (error) {
      return {
        filename: file.name,
        error: error.message,
        success: false
      };
    }
  }, [tags]);

  // 批量上传处理
  const handleUpload = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的图片');
      return;
    }

    try {
      const values = await form.validateFields();
      setUploading(true);
      setUploadProgress(0);
      setUploadResults([]);

      const results = [];
      const totalFiles = fileList.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const result = await uploadSingleFile(fileList[i], values);
        results.push(result);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      setUploadResults(results);
      setUploading(false);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      // 显示上传结果消息
      if (failCount === 0) {
        message.success(`成功上传 ${successCount} 张图片!`);
      } else if (successCount === 0) {
        message.error(`上传失败，共 ${failCount} 张图片`);
      } else {
        message.warning(`上传完成：成功 ${successCount} 张，失败 ${failCount} 张`);
      }
      
      // 清理状态
      setFileList([]);
      form.resetFields();
      setTags([]);

    } catch (error) {
      console.error('表单验证失败:', error);
      setUploading(false);
    }
  }, [fileList, form, uploadSingleFile]);

  // 清空所有状态
  const handleClear = useCallback(() => {
    setFileList([]);
    form.resetFields();
    setTags([]);
    setUploadResults([]);
    setUploadProgress(0);
  }, [form]);

  // Upload组件配置 - 使用useMemo优化性能
  const uploadProps = React.useMemo(() => ({
    name: 'file',
    multiple: true,
    fileList,
    beforeUpload,
    onChange: handleFileChange,
    showUploadList: {
      showPreviewIcon: false,
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
    onDrop: (e) => console.log('Dropped files', e.dataTransfer.files),
  }), [fileList, beforeUpload, handleFileChange]);

  return (
    <ProCard title="图片上传" bordered>
      <Form form={form} layout="vertical">
        <Form.Item label="选择图片">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个或批量上传。支持 JPG、PNG、GIF 格式，单个文件不超过 10MB
            </p>
          </Dragger>
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <TextArea
            rows={3}
            placeholder="为这批图片添加备注信息（可选）"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item label="标签">
          <TagManager tags={tags} onTagsChange={setTags} />
        </Form.Item>

        {uploading && (
          <Form.Item>
            <Progress 
              percent={uploadProgress} 
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{
                from: '#108ee9',
                to: '#87d068',
              }}
            />
          </Form.Item>
        )}

        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
            <Button onClick={handleClear} disabled={uploading}>
              清空
            </Button>
          </Space>
        </Form.Item>

        {uploadResults.length > 0 && (
          <Form.Item style={{ marginTop: '24px' }}>
            {uploadResults.map((result, index) => (
              <UploadResultItem 
                key={index}
                result={result} 
                index={index}
                isLast={index === uploadResults.length - 1}
              />
            ))}
          </Form.Item>
        )}
      </Form>
    </ProCard>
  );
};

export default ImageUpload;