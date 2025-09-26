import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Upload, Button, Form, Input, message, Space, Tabs, Tag, Progress } from 'antd';
import { ProCard } from '@ant-design/pro-card';
import { InboxOutlined, UploadOutlined, DeleteOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Dragger } = Upload;
const { TextArea } = Input;

// 文件项组件，使用 React.memo 优化
const FileItem = React.memo(({ file, onRemove }) => {
  const fileSizeMB = useMemo(() => {
    return (file.size / 1024 / 1024).toFixed(2);
  }, [file.size]);

  return (
    <div style={{ 
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
          ({fileSizeMB} MB)
        </span>
      </div>
      <Button
        type="text"
        danger
        icon={<DeleteOutlined />}
        onClick={() => onRemove(file)}
        size="small"
      />
    </div>
  );
});

const ImageUpload = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);
  const [tags, setTags] = useState([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Set page title
  useEffect(() => {
    document.title = '图片上传 - Momoka 图床';
  }, []);



  // 简化的文件验证函数
  const validateFile = useCallback((file) => {
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
    return true;
  }, []);



  // 简化的文件处理函数
  const handleFileChange = useCallback((info) => {
    // 过滤有效文件
    const newFiles = info.fileList.filter(file => 
      file.status !== 'error' && 
      (file.status === 'uploading' || file.status === 'done' || !file.status)
    );
    
    // 验证文件
    const validFiles = newFiles.filter(file => {
      const fileObj = file.originFileObj || file;
      return validateFile(fileObj);
    });
    
    setFileList(validFiles);
  }, [validateFile]);

  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false, // Hide default upload list
    fileList: fileList, // 控制Upload组件的内部文件列表状态
    beforeUpload: () => false, // 简化 beforeUpload，只阻止自动上传
    onChange: handleFileChange,
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const handleClose = (removedTag) => {
    const newTags = tags.filter(tag => tag !== removedTag);
    setTags(newTags);
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && tags.indexOf(inputValue) === -1) {
      setTags([...tags, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
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
      setUploadResults([]);

      const results = [];
      const totalFiles = fileList.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file.originFileObj);
        
        // Add remark if provided
        if (values.remark) {
          formData.append('remark', values.remark);
        }
        
        // Add tags if any
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
            results.push({
              filename: file.name,
              url: result.image.url,
              success: true,
              image: result.image
            });
          } else {
            const errorData = await response.json();
            results.push({
              filename: file.name,
              error: errorData.error || '上传失败',
              success: false
            });
          }
        } catch (error) {
          results.push({
            filename: file.name,
            error: error.message,
            success: false
          });
        }

        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      setUploadResults(results);
      setUploading(false);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (failCount === 0) {
        message.success(`成功上传 ${successCount} 张图片!`);
      } else if (successCount === 0) {
        message.error(`上传失败，共 ${failCount} 张图片`);
      } else {
        message.warning(`上传完成：成功 ${successCount} 张，失败 ${failCount} 张`);
      }
      
      setFileList([]);
      form.resetFields();
      setTags([]);

    } catch (error) {
      console.error('表单验证失败:', error);
      setUploading(false);
    }
  };

  const handleRemoveFile = useCallback((file) => {
    setFileList(prevList => prevList.filter(item => item.uid !== file.uid));
  }, []);

  // 使用 useMemo 优化文件列表渲染
  const fileListComponent = useMemo(() => {
    if (fileList.length === 0) return null;

    return (
      <div style={{ marginTop: '16px' }}>
        <h4>待上传文件 ({fileList.length}):</h4>
        {fileList.map(file => (
          <FileItem 
            key={file.uid} 
            file={file} 
            onRemove={handleRemoveFile}
          />
        ))}
      </div>
    );
  }, [fileList, handleRemoveFile]);

  return (
    <>
      <ProCard title="图片上传" bordered>
        <Form form={form} layout="vertical">
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

            {fileListComponent}
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
            <div>
              {tags.map((tag, index) => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => handleClose(tag)}
                  style={{ marginBottom: '8px' }}
                >
                  {tag}
                </Tag>
              ))}
              {inputVisible && (
                <Input
                  type="text"
                  size="small"
                  style={{ width: 78 }}
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputConfirm}
                  onPressEnter={handleInputConfirm}
                  autoFocus
                />
              )}
              {!inputVisible && (
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
                  // 清除所有状态
                  setFileList([]);
                  form.resetFields();
                  setTags([]);
                  setUploadResults([]);
                  setUploadProgress(0);
                }}
                disabled={uploading}
              >
                清空
              </Button>
            </Space>
          </Form.Item>

          {/* Upload results display */}
          {uploadResults.length > 0 && (
            <Form.Item 
              style={{ marginTop: '24px' }}
            >
                {uploadResults.map((result, index) => (
                  <div key={index} style={{
                    padding: '16px',
                    border: `1px solid ${result.success ? '#b7eb8f' : '#ffccc7'}`,
                    borderRadius: '8px',
                    marginBottom: index === uploadResults.length - 1 ? '0' : '16px',
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
                    
                    {result.success && result.url && (
                        <div>
                          <Tabs
                            size="small"
                            tabBarStyle={{ marginBottom: '12px' }}
                            items={[
                             {
                               key: 'url',
                               label: '直链',
                               children: (
                                 <div style={{ display: 'flex', gap: '8px' }}>
                                    <Input 
                                      value={result.url} 
                                      readOnly 
                                      size="small"
                                      style={{ fontSize: '12px', fontFamily: 'monospace' }}
                                    />
                                    <Button 
                                      size="small" 
                                      icon={<CopyOutlined />}
                                      type="primary"
                                      onClick={() => {
                                        navigator.clipboard.writeText(result.url);
                                        message.success('已复制到剪贴板');
                                      }}
                                    />
                                  </div>
                               )
                             },
                             {
                               key: 'markdown',
                               label: 'Markdown',
                               children: (
                                 <div style={{ display: 'flex', gap: '8px' }}>
                                    <Input 
                                      value={`![${result.filename}](${result.url})`} 
                                      readOnly 
                                      size="small"
                                      style={{ fontSize: '12px', fontFamily: 'monospace' }}
                                    />
                                    <Button 
                                      size="small" 
                                      icon={<CopyOutlined />}
                                      type="primary"
                                      onClick={() => {
                                        navigator.clipboard.writeText(`![${result.filename}](${result.url})`);
                                        message.success('已复制到剪贴板');
                                      }}
                                    />
                                  </div>
                               )
                             },
                             {
                               key: 'bbcode',
                               label: 'BBCode',
                               children: (
                                 <div style={{ display: 'flex', gap: '8px' }}>
                                    <Input 
                                      value={`[img]${result.url}[/img]`} 
                                      readOnly 
                                      size="small"
                                      style={{ fontSize: '12px', fontFamily: 'monospace' }}
                                    />
                                    <Button 
                                      size="small" 
                                      icon={<CopyOutlined />}
                                      type="primary"
                                      onClick={() => {
                                        navigator.clipboard.writeText(`[img]${result.url}[/img]`);
                                        message.success('已复制到剪贴板');
                                      }}
                                    />
                                  </div>
                               )
                             }
                           ]}
                         />
                       </div>
                     )}
                    
                    {!result.success && result.error && (
                      <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
                        错误：{result.error}
                      </div>
                    )}
                  </div>
                ))}
            </Form.Item>
          )}
        </Form>
      </ProCard>
    </>
  );
};

export default ImageUpload;