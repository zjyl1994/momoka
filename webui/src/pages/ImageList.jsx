import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Image, Spin, Empty, message } from 'antd';
import { authFetch } from '../utils/api';

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
  const [columnCount, setColumnCount] = useState(4);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const initializedRef = useRef(false);
  const [layoutKey, setLayoutKey] = useState(0); // 用于强制重新布局

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
      
      const response = await authFetch(`/admin-api/image/all?${params}`);
      if (response.ok) {
        const data = await response.json();
        const newImages = data.images || [];
        
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
        
        // 触发布局重新计算
        setLayoutKey(prev => prev + 1);
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

  // 响应式列数计算
  const updateColumnCount = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const minColumnWidth = 250; // 最小列宽
      const gap = 16; // 间距
      const newColumnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)));
      setColumnCount(newColumnCount);
    }
  }, []);

  useEffect(() => {
    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, [updateColumnCount]);

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

  // 简化的瀑布流渲染
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

    // Simple waterfall layout: distribute images to shortest column
    const columns = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);

    images.forEach(image => {
      // Calculate estimated height based on aspect ratio
      const aspectRatio = image.width && image.height ? image.height / image.width : 1;
      const estimatedHeight = Math.max(200, Math.min(400, 250 * aspectRatio)) + 80;
      
      // Find the shortest column and add image to it
      const shortestIndex = heights.indexOf(Math.min(...heights));
      columns[shortestIndex].push(image);
      heights[shortestIndex] += estimatedHeight;
    });

    return (
      <div key={layoutKey} style={{ display: 'flex', gap: '16px' }}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {column.map((image) => (
              <Card
                key={image.id}
                hoverable
                style={{ borderRadius: '8px', overflow: 'hidden' }}
                styles={{ body: { padding: 0 } }}
                onClick={() => handleViewImage(image)}
              >
                <div style={{ position: 'relative' }}>
                  {image.url && (
                    <Image
                      src={image.url}
                      alt={image.file_name}
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
                      {image.file_name}
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      {formatFileSize(image.file_size)} • {formatTime(image.create_time)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
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