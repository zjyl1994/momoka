import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Image, Spin, Empty, message } from 'antd';
import { authFetch } from '../utils/api';
import Masonry from 'react-masonry-css';

const ImageList = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = '图片列表 - Momoka 图床';
  }, []);

  const [images, setImages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const containerRef = useRef(null);
  const currentPageRef = useRef(1);
  const [breakpointColumnsObj, setBreakpointColumnsObj] = useState({
    default: 4,
    1400: 4,
    1100: 3,
    800: 2,
    500: 1
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const initializedRef = useRef(false);

  // 获取图片列表
  const fetchImages = async (page = 1, size = 20, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      const response = await authFetch(`/admin-api/file/all?${params}`);
      if (response.ok) {
        const data = await response.json();
        const rawImages = data.files || [];
        // 适配后端数据结构：将name和ext_name组合成file_name
        const newImages = rawImages.map(img => ({
          ...img,
          file_name: img.name + (img.ext_name || '')
        }));
        
        if (isLoadMore) {
          // Merge and deduplicate images by ID to avoid duplicate keys
          setImages(prev => {
            const existingIds = new Set(prev.map(img => img.id));
            const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));
            return [...prev, ...uniqueNewImages];
          });
        } else {
          setImages(newImages);
        }
        
        // 检查是否还有更多数据
        setHasMore(newImages.length === size);
        
        // Update current page after successful fetch
        if (isLoadMore) {
          setCurrentPage(page);
        }
        
        // 布局会自动重新计算
      } else {
        message.error('获取图片列表失败');
      }
    } catch (error) {
      console.error('获取图片列表失败:', error);
      message.error('获取图片列表失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 响应式列数已通过 breakpointColumnsObj 设置，不需要额外计算

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchImages(1, pageSize, false);
    }
  }, []);

  // Update currentPageRef when currentPage changes
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // 滚动监听 - 监听window滚动而不是容器滚动
  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || loadingMore || !hasMore) return;
    
    const windowScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollBottom = windowScrollTop + windowHeight;
    const threshold = documentHeight - 200; // Increase threshold to 200px
    
    if (scrollBottom >= threshold) {
      const nextPage = currentPageRef.current + 1;
      console.log('Loading next page:', nextPage);
      fetchImages(nextPage, pageSize, true);
    }
  }, [loading, loadingMore, hasMore, pageSize]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // 查看图片
  const handleViewImage = (image) => {
    setPreviewImage(image.url);
    setPreviewVisible(true);
  };

  // 使用 react-masonry-css 组件，不需要自定义瀑布流布局算法

  // 瀑布流渲染
  const renderWaterfall = () => {
    if (loading && images.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!images || images.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Empty description="暂无图片" />
        </div>
      );
    }

    return (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {images.map((image) => (
          <Card
            key={image.id}
            hoverable
            style={{ marginBottom: '16px', borderRadius: '8px', overflow: 'hidden' }}
            styles={{ body: { padding: 0 } }}
            onClick={() => handleViewImage(image)}
          >
            <div style={{ position: 'relative' }}>
              {image.url && (
                <Image
                  src={image.url}
                  alt={image.name + (image.ext_name || '')}
                  style={{ width: '100%', display: 'block' }}
                  preview={false}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  color: 'white',
                  padding: '20px 12px 12px',
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {image.name + (image.ext_name || '')}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {formatFileSize(image.file_size)} • {formatTime(image.create_time)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </Masonry>
    );
  };



  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* 瀑布流容器 */}
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          padding: '16px',
          background: '#f5f5f5'
        }}
      >
        <style>
          {`
            .masonry-grid {
              display: flex;
              width: 100%;
              margin-left: -16px; /* 负边距，与列间距相同 */
            }
            .masonry-grid_column {
              padding-left: 16px; /* 列间距 */
              background-clip: padding-box;
            }
          `}
        </style>
        {renderWaterfall()}
        
        {/* 加载更多提示 */}
        {loadingMore && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px', color: '#666' }}>加载更多图片...</div>
          </div>
        )}
        
        {!hasMore && images.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            已加载全部图片
          </div>
        )}
      </div>

      {/* 图片预览 */}
      {previewImage && (
        <Image
          style={{ display: 'none' }}
          src={previewImage}
          preview={{
            visible: previewVisible,
            onVisibleChange: setPreviewVisible
          }}
        />
      )}
    </div>
  );
};

export default ImageList;