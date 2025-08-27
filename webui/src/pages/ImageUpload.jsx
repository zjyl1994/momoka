import React, { useState } from 'react';
import { Card, Upload, Button, Form, Input, Select, message, Progress, Space } from 'antd';
import { InboxOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Option } = Select;
const { TextArea } = Input;

const ImageUpload = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 模拟文件夹数据
  const folders = [
    { id: 1, name: '默认文件夹', path: '/' },
    { id: 2, name: '风景照片', path: '/landscape' },
    { id: 3, name: '人物照片', path: '/portrait' },
    { id: 4, name: '产品图片', path: '/products' }
  ];

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB!');
        return false;
      }
      return false; // 阻止自动上传
    },
    onChange: (info) => {
      setFileList(info.fileList);
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的图片');
      return;
    }

    try {
      const values = await form.validateFields();
      setUploading(true);
      setUploadProgress(0);

      // 模拟上传进度
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploading(false);
            message.success('图片上传成功!');
            setFileList([]);
            form.resetFields();
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      console.log('上传参数:', {
        files: fileList,
        folder: values.folder,
        description: values.description,
        tags: values.tags
      });

    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleRemoveFile = (file) => {
    const newFileList = fileList.filter(item => item.uid !== file.uid);
    setFileList(newFileList);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="上传图片" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            folder: 1,
            description: '',
            tags: []
          }}
        >
          <Form.Item
            name="folder"
            label="目标文件夹"
            rules={[{ required: true, message: '请选择目标文件夹' }]}
          >
            <Select placeholder="选择文件夹">
              {folders.map(folder => (
                <Option key={folder.id} value={folder.id}>
                  {folder.name} ({folder.path})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="选择图片">
            <Dragger {...uploadProps} style={{ marginBottom: '16px' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传。支持 JPG、PNG、GIF 格式，单个文件不超过 10MB
              </p>
            </Dragger>

            {fileList.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4>待上传文件 ({fileList.length}):</h4>
                {fileList.map(file => (
                  <div key={file.uid} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{file.name}</span>
                      <span style={{ color: '#666', marginLeft: '8px' }}>
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFile(file)}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            )}
          </Form.Item>

          <Form.Item
            name="description"
            label="描述信息"
          >
            <TextArea
              rows={3}
              placeholder="请输入图片描述信息（可选）"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="输入标签，按回车添加"
              style={{ width: '100%' }}
            >
              <Option value="风景">风景</Option>
              <Option value="人物">人物</Option>
              <Option value="建筑">建筑</Option>
              <Option value="动物">动物</Option>
              <Option value="美食">美食</Option>
            </Select>
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
              <Button
                onClick={() => {
                  setFileList([]);
                  form.resetFields();
                }}
                disabled={uploading}
              >
                清空
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ImageUpload;