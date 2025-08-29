import React, { useState, useEffect } from 'react';
import { Card, Upload, Button, Form, TreeSelect, message, Progress, Space, Tabs, Input } from 'antd';
import { InboxOutlined, UploadOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { authFetch } from '../utils/api';

const { Dragger } = Upload;

const ImageUpload = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderTree, setFolderTree] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);

  // Set page title
  useEffect(() => {
    document.title = '图片上传 - Momoka 图床';
  }, []);

  // 获取文件夹树
  const fetchFolderTree = async () => {
    setLoadingFolders(true);
    try {
      const response = await authFetch('/admin-api/folder/tree');
      if (response.ok) {
        const data = await response.json();
        const treeData = convertToTreeSelectData(data);
        setFolderTree(treeData);
      } else {
        message.error('获取文件夹列表失败');
      }
    } catch (error) {
      console.error('获取文件夹树失败:', error);
      message.error('获取文件夹列表失败');
    } finally {
      setLoadingFolders(false);
    }
  };

  // 转换文件夹数据为TreeSelect格式
  const convertToTreeSelectData = (folders) => {
    if (!folders || folders.length === 0) {
      return [{ title: '根目录', value: 0, key: 0 }];
    }
    
    const convertNode = (folder) => ({
      title: folder.name,
      value: folder.id,
      key: folder.id,
      children: folder.children ? folder.children.map(convertNode) : []
    });
    
    const rootNode = { title: '根目录', value: 0, key: 0, children: folders.map(convertNode) };
    return [rootNode];
  };

  useEffect(() => {
    fetchFolderTree();
  }, []);

  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false, // Hide default upload list
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
      setUploadResults([]);

      const results = [];
      const totalFiles = fileList.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file.originFileObj);
        formData.append('folder_id', values.folder.toString());

        try {
          const response = await authFetch('/admin-api/image', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();
            results.push({
              filename: file.name,
              url: result.url,
              success: true
            });
          } else {
            results.push({
              filename: file.name,
              error: '上传失败',
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

        // 更新进度
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

    } catch (error) {
      console.error('表单验证失败:', error);
      setUploading(false);
    }
  };

  const handleRemoveFile = (file) => {
    const newFileList = fileList.filter(item => item.uid !== file.uid);
    setFileList(newFileList);
  };

  return (
    <Card title="上传图片" style={{ height: '100%', borderRadius: 0, border: 'none' }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            folder: 0
          }}
        >
          <Form.Item
            name="folder"
            label="目标文件夹"
            rules={[{ required: true, message: '请选择目标文件夹' }]}
          >
            <TreeSelect
              style={{ width: '100%' }}
              value={undefined}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              treeData={folderTree}
              placeholder="请选择文件夹"
              treeDefaultExpandAll
              loading={loadingFolders}
              showSearch
              treeNodeFilterProp="title"
            />
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
        
        {/* 上传结果展示 */}
        {uploadResults.length > 0 && (
          <Card 
            title={(
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>上传结果 ({uploadResults.filter(r => r.success).length}/{uploadResults.length})</span>
                <Space>
                  <Button 
                    size="small" 
                    onClick={() => {
                      const urls = uploadResults.filter(r => r.success).map(r => r.url).join('\n');
                      navigator.clipboard.writeText(urls);
                      message.success('已复制所有直链到剪贴板');
                    }}
                    disabled={uploadResults.filter(r => r.success).length === 0}
                  >
                    批量复制直链
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => {
                      const markdowns = uploadResults.filter(r => r.success).map(r => `![${r.filename}](${r.url})`).join('\n');
                      navigator.clipboard.writeText(markdowns);
                      message.success('已复制所有Markdown到剪贴板');
                    }}
                    disabled={uploadResults.filter(r => r.success).length === 0}
                  >
                    批量复制Markdown
                  </Button>
                </Space>
              </div>
            )} 
            style={{ marginTop: '24px' }}
          >
            {uploadResults.map((result, index) => (
              <div key={index} style={{
                padding: '16px',
                border: `1px solid ${result.success ? '#b7eb8f' : '#ffccc7'}`,
                borderRadius: '8px',
                marginBottom: '16px',
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
          </Card>
        )}
      </Card>
  );
};

export default ImageUpload;