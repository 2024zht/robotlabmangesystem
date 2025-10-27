import React, { useState, useEffect } from 'react';
import { ebookAPI } from '../services/api';
import { Ebook, UploadTask, DownloadTask } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Book, Download, Upload, HardDrive, X, CheckCircle, AlertCircle, Clock, Cloud, Server, Eye, ExternalLink, Trash2 } from 'lucide-react';
import axios from 'axios';

const Ebooks: React.FC = () => {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewEbook, setPreviewEbook] = useState<Ebook | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchEbooks();
  }, []);

  const fetchEbooks = async () => {
    try {
      const { data } = await ebookAPI.getAll();
      setEbooks(data);
    } catch (error) {
      console.error('获取电子书列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除电子书
  const handleDelete = async (ebook: Ebook) => {
    if (!window.confirm(`确定要删除《${ebook.originalName}》吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await ebookAPI.delete(ebook.id!);
      alert('删除成功');
      fetchEbooks();
    } catch (error) {
      console.error('Delete error:', error);
      alert('删除失败');
    }
  };

  // 清理孤儿文件
  const handleCleanupOrphans = async () => {
    if (!window.confirm('确定要清理所有孤儿文件吗？这将删除文件系统中存在但数据库中没有记录的文件（通常是上传失败或取消上传留下的文件）。')) {
      return;
    }

    try {
      const response = await ebookAPI.cleanupOrphans();
      alert(`${response.data.message}\n删除的文件：\n${response.data.deletedFiles.join('\n')}`);
      fetchEbooks();
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('清理失败');
    }
  };

  // 处理文件选择（支持多文件）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 创建上传任务
    const newTasks: UploadTask[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'waiting',
      progress: 0,
      serverProgress: 0,
      cloudProgress: 0,
      startTime: Date.now(),
      cancelTokenSource: axios.CancelToken.source(),
    }));

    setUploadTasks((prev) => [...prev, ...newTasks]);
    
    // 清空input
    e.target.value = '';

    // 开始上传队列
    if (!isUploading) {
      processUploadQueue([...uploadTasks, ...newTasks]);
    }
  };

  // 处理上传队列
  const processUploadQueue = async (tasks: UploadTask[]) => {
    setIsUploading(true);

    for (const task of tasks) {
      if (task.status !== 'waiting') continue;

      await uploadSingleFile(task);
    }

    setIsUploading(false);
    
    // 上传完成后刷新列表
    fetchEbooks();
  };

  // 上传单个文件（使用分块上传）
  const uploadSingleFile = async (task: UploadTask) => {
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
    const file = task.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`开始分块上传: ${file.name}, 大小: ${file.size} bytes, 分块数: ${totalChunks}`);

    // 更新任务状态为上传中，同时保存 uploadId
    updateTask(task.id, { status: 'uploading', serverProgress: 0, uploadId });

    let uploadedFileId: number | undefined;

    try {
      // 第一阶段：分块上传到服务器 (0-70%)
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        console.log(`上传分块 ${chunkIndex + 1}/${totalChunks}, 大小: ${chunk.size} bytes`);

        // 创建 FormData 上传分块
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('fileSize', file.size.toString());
        formData.append('uploadId', uploadId);

        // 上传分块（会在取消时抛出异常）
        await ebookAPI.uploadChunk(formData, task.cancelTokenSource);

        // 更新进度（上传分块占 70%）
        const chunkProgress = Math.round(((chunkIndex + 1) / totalChunks) * 70);
        updateTask(task.id, {
          serverProgress: Math.round(((chunkIndex + 1) / totalChunks) * 100),
          progress: chunkProgress,
        });
      }

      console.log(`所有分块上传完成，开始合并...`);

      // 第二阶段：合并分块 (70-80%)
      updateTask(task.id, { 
        status: 'uploading',
        serverProgress: 100,
        progress: 75,
      });

      const mergeResponse = await ebookAPI.mergeChunks({
        uploadId,
        fileName: file.name,
        fileSize: file.size,
      });

      console.log('文件合并完成:', mergeResponse.data);

      // 保存上传文件的ID（用于取消时删除）
      uploadedFileId = mergeResponse.data.id;
      updateTask(task.id, { 
        uploadedFileId,
        progress: 80,
      });

      // 第三阶段：同步到云端 (80-100%)
      const needsB2Sync = mergeResponse.data.needsB2Sync;
      
      if (needsB2Sync) {
        // 更新状态为同步中
        updateTask(task.id, { status: 'syncing' });

        // 模拟云端同步进度（因为后端是同步的，我们只能模拟）
        await simulateCloudSync(task.id, 80); // 从 80% 开始
      } else {
        // 不需要云端同步，直接完成
        updateTask(task.id, {
          status: 'completed',
          progress: 100,
          serverProgress: 100,
          cloudProgress: 100,
          endTime: Date.now(),
        });
      }

    } catch (error: any) {
      // 如果是取消请求，标记为已取消并清理临时文件
      if (axios.isCancel(error)) {
        console.log('上传被用户取消:', file.name);
        
        updateTask(task.id, {
          status: 'cancelled',
          error: '上传已取消',
          uploadedFileId,
        });

        // 清理服务器上的临时分块
        try {
          await ebookAPI.cancelUpload(uploadId);
          console.log('已清理临时分块文件:', uploadId);
        } catch (cleanupError) {
          console.error('清理临时文件失败:', cleanupError);
        }

        // 如果有文件ID，删除已合并的文件
        if (uploadedFileId) {
          try {
            await ebookAPI.delete(uploadedFileId);
            console.log('已删除取消上传的文件:', uploadedFileId);
            fetchEbooks();
          } catch (deleteError) {
            console.error('删除文件失败:', deleteError);
          }
        }
      } else {
        console.error('上传失败:', error);
        
        updateTask(task.id, {
          status: 'error',
          error: error.response?.data?.error || error.message || '上传失败',
          uploadedFileId,
        });

        // 上传失败时清理临时文件
        try {
          await ebookAPI.cancelUpload(uploadId);
          console.log('已清理失败上传的临时文件:', uploadId);
        } catch (cleanupError) {
          console.error('清理临时文件失败:', cleanupError);
        }
      }
    }
  };

  // 模拟云端同步进度
  const simulateCloudSync = async (taskId: string, startProgress: number = 70) => {
    return new Promise<void>((resolve) => {
      let cloudProgress = 0;
      const totalRange = 100 - startProgress; // 剩余进度范围
      
      const interval = setInterval(() => {
        cloudProgress += 10;
        const overallProgress = startProgress + Math.round((cloudProgress / 100) * totalRange);

        updateTask(taskId, {
          cloudProgress,
          progress: overallProgress,
        });

        if (cloudProgress >= 100) {
          clearInterval(interval);
          updateTask(taskId, {
            status: 'completed',
            progress: 100,
            cloudProgress: 100,
            endTime: Date.now(),
          });
          resolve();
        }
      }, 200);
    });
  };

  // 更新任务状态
  const updateTask = (taskId: string, updates: Partial<UploadTask>) => {
    setUploadTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  // 取消并移除任务
  const removeTask = async (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    
    if (task) {
      // 如果任务正在上传或等待中，取消请求
      if (task.status === 'uploading' || task.status === 'waiting' || task.status === 'syncing') {
        console.log('取消上传任务:', task.file.name);
        task.cancelTokenSource?.cancel('用户取消上传');
        
        // 等待一小段时间确保取消完成
        await new Promise(resolve => setTimeout(resolve, 200));

        // 如果有 uploadId，清理服务器上的临时分块文件
        if (task.uploadId) {
          try {
            await ebookAPI.cancelUpload(task.uploadId);
            console.log('已清理临时分块文件:', task.uploadId);
          } catch (error) {
            console.error('清理临时分块文件失败:', error);
          }
        }
      }
      
      // 如果文件已上传到服务器且任务未完成，删除文件
      // 已完成的任务只移除UI，不删除服务器文件
      if (task.uploadedFileId && task.status !== 'completed') {
        try {
          await ebookAPI.delete(task.uploadedFileId);
          console.log('已删除取消/失败的文件:', task.uploadedFileId);

          // 刷新书籍列表
          await fetchEbooks();
        } catch (error) {
          console.error('删除文件失败:', error);
          alert('删除文件失败，请手动刷新页面');
        }
      }
    }
    
    // 从列表中移除任务
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // 清除已完成的任务
  const clearCompletedTasks = () => {
    setUploadTasks((prev) =>
      prev.filter((task) => task.status !== 'completed' && task.status !== 'error' && task.status !== 'cancelled')
    );
  };

  // 清除失败和取消的任务（包括删除服务器文件）
  const clearFailedTasks = async () => {
    const failedTasks = uploadTasks.filter(
      task => (task.status === 'error' || task.status === 'cancelled')
    );
    
    if (failedTasks.length === 0) {
      alert('没有需要清理的失败任务');
      return;
    }
    
    if (!window.confirm(`确定要删除 ${failedTasks.length} 个失败/取消的任务吗？`)) {
      return;
    }
    
    // 清理所有失败任务的文件（包括临时分块和已合并文件）
    const cleanupPromises = failedTasks.map(async (task) => {
      // 清理临时分块文件
      if (task.uploadId) {
        try {
          await ebookAPI.cancelUpload(task.uploadId);
          console.log('已清理临时分块:', task.uploadId);
        } catch (error) {
          console.error('清理临时分块失败:', task.uploadId, error);
        }
      }
      
      // 删除已合并的文件
      if (task.uploadedFileId) {
        try {
          await ebookAPI.delete(task.uploadedFileId);
          console.log('已删除文件:', task.uploadedFileId);
        } catch (error) {
          console.error('删除文件失败:', task.uploadedFileId, error);
        }
      }
    });
    
    await Promise.all(cleanupPromises);
    
    // 从UI中移除这些任务
    setUploadTasks((prev) =>
      prev.filter((task) => task.status !== 'error' && task.status !== 'cancelled')
    );
    
    // 刷新书籍列表
    await fetchEbooks();
    
    alert('清理完成');
  };


  // 预览电子书（本地）
  const handlePreviewLocal = (ebook: Ebook) => {
    if (!ebook.id) {
      alert('文件信息错误，无法预览');
      console.error('Ebook missing id:', ebook);
      return;
    }
    setPreviewEbook({ ...ebook, previewSource: 'local' } as any);
  };

  // 预览电子书（云端）
  const handlePreviewCloud = (ebook: Ebook) => {
    if (!ebook.b2Synced) {
      alert('该文件尚未同步到云端');
      return;
    }
    setPreviewEbook({ ...ebook, previewSource: 'cloud' } as any);
  };

  // 关闭预览
  const closePreview = () => {
    setPreviewEbook(null);
  };

  // 从本地下载电子书（添加到下载队列）
  const handleDownloadLocal = (ebook: Ebook) => {
    if (!ebook.id) {
      alert('文件信息错误，无法下载');
      console.error('Ebook missing id:', ebook);
      return;
    }

    // 创建下载任务
    const downloadTask: DownloadTask = {
      id: `download-${Date.now()}-${Math.random()}`,
      fileName: ebook.originalName,
      fileSize: ebook.fileSize,
      source: 'local',
      status: 'waiting',
      progress: 0,
      downloadedBytes: 0,
      startTime: Date.now(),
      cancelTokenSource: axios.CancelToken.source(),
      ebookId: ebook.id,
    };

    setDownloadTasks((prev) => [...prev, downloadTask]);
    
    // 开始下载
    startDownload(downloadTask);
  };

  // 执行下载
  const startDownload = async (task: DownloadTask) => {
    const token = localStorage.getItem('token');
    if (!token) {
      updateDownloadTask(task.id, {
        status: 'error',
        error: '未登录',
      });
      return;
    }

    try {
      updateDownloadTask(task.id, { 
        status: 'downloading',
        lastUpdateTime: Date.now(),
        lastDownloadedBytes: 0,
      });

      let downloadUrl: string;
      
      if (task.source === 'local' && task.ebookId) {
        downloadUrl = `/api/ebooks/file/${task.ebookId}`;
      } else {
        // 云端下载
        downloadUrl = `https://divine-glade-0efd.hengtangzhao.workers.dev/api/${encodeURIComponent(task.fileName)}`;
      }

      const response = await axios.get(downloadUrl, {
        headers: task.source === 'local' ? { 'Authorization': `Bearer ${token}` } : {},
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const now = Date.now();
          const currentTask = downloadTasks.find(t => t.id === task.id);
          
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            
            // 计算下载速率
            let downloadSpeed = 0;
            if (currentTask?.lastUpdateTime && currentTask?.lastDownloadedBytes !== undefined) {
              const timeDiff = (now - currentTask.lastUpdateTime) / 1000; // 秒
              const bytesDiff = progressEvent.loaded - currentTask.lastDownloadedBytes;
              
              if (timeDiff > 0) {
                downloadSpeed = bytesDiff / timeDiff; // bytes/s
              }
            }
            
            updateDownloadTask(task.id, {
              progress,
              downloadedBytes: progressEvent.loaded,
              downloadSpeed,
              lastUpdateTime: now,
              lastDownloadedBytes: progressEvent.loaded,
            });
          }
        },
        cancelToken: task.cancelTokenSource?.token,
      });

      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', task.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      updateDownloadTask(task.id, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
      });
    } catch (error: any) {
      if (axios.isCancel(error)) {
        updateDownloadTask(task.id, {
          status: 'cancelled',
          error: '下载已取消',
        });
      } else {
        console.error('Download error:', error);
        updateDownloadTask(task.id, {
          status: 'error',
          error: error.response?.data?.error || '下载失败',
        });
      }
    }
  };

  // 更新下载任务
  const updateDownloadTask = (taskId: string, updates: Partial<DownloadTask>) => {
    setDownloadTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  // 取消下载
  const cancelDownload = (taskId: string) => {
    const task = downloadTasks.find(t => t.id === taskId);
    if (task && (task.status === 'downloading' || task.status === 'waiting')) {
      task.cancelTokenSource?.cancel('用户取消下载');
    }
    setDownloadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // 清除已完成的下载
  const clearCompletedDownloads = () => {
    setDownloadTasks((prev) =>
      prev.filter((task) => task.status !== 'completed' && task.status !== 'error' && task.status !== 'cancelled')
    );
  };

  // 从云端下载电子书（添加到下载队列）
  const handleDownloadCloud = (ebook: Ebook) => {
    if (!ebook.b2Synced) {
      alert('该文件尚未同步到云端');
      return;
    }

    // 创建下载任务
    const downloadTask: DownloadTask = {
      id: `download-${Date.now()}-${Math.random()}`,
      fileName: ebook.originalName,
      fileSize: ebook.fileSize,
      source: 'cloud',
      status: 'waiting',
      progress: 0,
      downloadedBytes: 0,
      startTime: Date.now(),
      cancelTokenSource: axios.CancelToken.source(),
    };

    setDownloadTasks((prev) => [...prev, downloadTask]);
    
    // 开始下载
    startDownload(downloadTask);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // 格式化时间
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分${seconds % 60}秒`;
  };

  // 格式化速率
  const formatSpeed = (bytesPerSecond: number): string => {
    if (!bytesPerSecond || bytesPerSecond < 0) return '0 B/s';
    if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s';
    if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(2) + ' KB/s';
    return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s';
  };

  // 获取预览URL
  const getPreviewUrl = (ebook: any) => {
    if (!ebook) return '';
    
    // 根据 previewSource 决定使用本地还是云端
    if (ebook.previewSource === 'cloud' && ebook.b2Synced) {
      return `https://divine-glade-0efd.hengtangzhao.workers.dev/api/${encodeURIComponent(ebook.originalName)}`;
    }
    
    // 本地预览
    if (!ebook.id) {
      console.error('Ebook missing id for preview:', ebook);
      return '';
    }
    
    const token = localStorage.getItem('token');
    return `/api/ebooks/preview/${ebook.id}?token=${token}`;
  };

  // 判断是否可以预览
  const canPreview = (filename: string) => {
    const ext = filename.toLowerCase();
    return ext.endsWith('.pdf') || ext.endsWith('.txt');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* 预览弹窗 */}
      {previewEbook && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center flex-1 min-w-0">
                <Book className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0" />
                <h3 className="text-lg font-semibold truncate" title={previewEbook.originalName}>
                  {previewEbook.originalName}
                </h3>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => (previewEbook as any).previewSource === 'cloud' ? handleDownloadCloud(previewEbook) : handleDownloadLocal(previewEbook)}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition"
                >
                  <Download className="h-4 w-4 mr-1" />
                  下载
                </button>
                <a
                  href={getPreviewUrl(previewEbook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm transition"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  新窗口打开
                </a>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              {canPreview(previewEbook.originalName) ? (
                <iframe
                  src={getPreviewUrl(previewEbook)}
                  className="w-full h-full border-0"
                  title={previewEbook.originalName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Book className="h-16 w-16 mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">该格式不支持在线预览</p>
                  <p className="text-sm mb-4">
                    支持预览格式：PDF、TXT
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (previewEbook as any).previewSource === 'cloud' ? handleDownloadCloud(previewEbook) : handleDownloadLocal(previewEbook)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载文件
                    </button>
                    <a
                      href={getPreviewUrl(previewEbook)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      尝试新窗口打开
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 下载队列悬浮窗 */}
      {downloadTasks.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50 w-[480px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white flex justify-between items-center">
            <div className="flex items-center">
              <Download className="h-5 w-5 mr-2" />
              <span className="font-semibold">下载队列 ({downloadTasks.filter(t => t.status !== 'completed').length}/{downloadTasks.length})</span>
            </div>
            <button
              onClick={clearCompletedDownloads}
              className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition"
            >
              清除已完成
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {downloadTasks.map((task) => (
              <div key={task.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.status === 'waiting' && (
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      {task.status === 'downloading' && (
                        <Download className="h-4 w-4 text-green-500 animate-pulse flex-shrink-0" />
                      )}
                      {task.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {task.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      {task.status === 'cancelled' && (
                        <X className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                      
                      <span className="text-sm font-medium text-gray-800 truncate" title={task.fileName}>
                        {task.fileName}
                      </span>
                      
                      {task.source === 'cloud' && (
                        <span title="从云端下载">
                          <Cloud className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        </span>
                      )}
                      {task.source === 'local' && (
                        <span title="从本地下载">
                          <Server className="h-3 w-3 text-gray-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {formatFileSize(task.fileSize)}
                      {task.endTime && task.startTime && (
                        <span className="ml-2">
                          · 用时 {formatDuration(task.endTime - task.startTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => cancelDownload(task.id)}
                    className="ml-2 p-1 hover:bg-gray-200 rounded transition"
                    title={task.status === 'downloading' ? '取消下载' : '移除'}
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                {/* 状态描述 */}
                <div className="text-xs text-gray-600 mb-2">
                  {task.status === 'waiting' && '等待下载...'}
                  {task.status === 'downloading' && (
                    <div className="space-y-1">
                      <div>{formatFileSize(task.downloadedBytes)} / {formatFileSize(task.fileSize)}</div>
                      {task.downloadSpeed !== undefined && task.downloadSpeed > 0 && (
                        <div className="text-blue-600 font-medium">
                          ⬇ {formatSpeed(task.downloadSpeed)}
                        </div>
                      )}
                    </div>
                  )}
                  {task.status === 'completed' && (
                    <span className="text-green-600 font-medium">✓ 下载完成</span>
                  )}
                  {task.status === 'error' && (
                    <span className="text-red-600">{task.error}</span>
                  )}
                  {task.status === 'cancelled' && (
                    <span className="text-gray-600">已取消</span>
                  )}
                </div>

                {/* 进度条 */}
                {task.status === 'downloading' && (
                  <div className="relative">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>进度</span>
                      <span className="font-semibold">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传队列悬浮窗 */}
      {uploadTasks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 w-[480px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
            <div className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              <span className="font-semibold">上传队列 ({uploadTasks.filter(t => t.status !== 'completed').length}/{uploadTasks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompletedTasks}
                className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition"
              >
                清除已完成
              </button>
              {uploadTasks.some(task => (task.status === 'error' || task.status === 'cancelled') && (task.uploadedFileId || task.uploadId)) && (
                <button
                  onClick={clearFailedTasks}
                  className="text-xs px-2 py-1 bg-red-500 bg-opacity-80 rounded hover:bg-opacity-100 transition"
                  title="清理失败/取消任务的临时文件和服务器文件"
                >
                  清理失败文件
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {uploadTasks.map((task) => (
              <div key={task.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.status === 'waiting' && (
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      {task.status === 'uploading' && (
                        <Server className="h-4 w-4 text-blue-500 animate-pulse flex-shrink-0" />
                      )}
                      {task.status === 'syncing' && (
                        <Cloud className="h-4 w-4 text-purple-500 animate-pulse flex-shrink-0" />
                      )}
                      {task.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {task.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      {task.status === 'cancelled' && (
                        <X className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                      
                      <span className="text-sm font-medium text-gray-800 truncate" title={task.file.name}>
                        {task.file.name}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {formatFileSize(task.file.size)}
                      {task.endTime && task.startTime && (
                        <span className="ml-2">
                          · 用时 {formatDuration(task.endTime - task.startTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => removeTask(task.id)}
                    className="ml-2 p-1 hover:bg-gray-200 rounded transition"
                    title={
                      task.status === 'uploading' || task.status === 'syncing' || task.status === 'waiting'
                        ? '取消上传'
                        : '移除任务'
                    }
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                {/* 状态描述 */}
                <div className="text-xs text-gray-600 mb-2">
                  {task.status === 'waiting' && '等待上传...'}
                  {task.status === 'uploading' && (
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      上传到服务器... {task.serverProgress}%
                    </span>
                  )}
                  {task.status === 'syncing' && (
                    <span className="flex items-center gap-1">
                      <Cloud className="h-3 w-3" />
                      同步到云端... {task.cloudProgress}%
                    </span>
                  )}
                  {task.status === 'completed' && (
                    <span className="text-green-600 font-medium">✓ 上传完成</span>
                  )}
                  {task.status === 'error' && (
                    <span className="text-red-600">{task.error}</span>
                  )}
                  {task.status === 'cancelled' && (
                    <span className="text-gray-600">{task.error || '已取消'}</span>
                  )}
                </div>

                {/* 进度条 */}
                {(task.status === 'uploading' || task.status === 'syncing') && (
                  <div className="space-y-2">
                    {/* 总进度 */}
                    <div className="relative">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>总进度</span>
                        <span className="font-semibold">{task.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 服务器进度 */}
                    {task.serverProgress > 0 && (
                      <div className="flex items-center gap-2">
                        <Server className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${task.serverProgress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{task.serverProgress}%</span>
                      </div>
                    )}

                    {/* 云端进度 */}
                    {task.cloudProgress > 0 && (
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3 w-3 text-purple-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${task.cloudProgress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{task.cloudProgress}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Book className="h-6 w-6 mr-2 text-blue-600" />
          电子书库
        </h2>
        
        {user?.isAdmin && (
          <div className="flex gap-2">
            <input
              type="file"
              id="fileInput"
              accept=".pdf,.epub,.mobi,.azw3,.txt,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <label
              htmlFor="fileInput"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition"
            >
              <Upload className="h-5 w-5 mr-2" />
              上传电子书
            </label>
            <button
              onClick={handleCleanupOrphans}
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              title="清理上传失败或取消上传留下的孤儿文件"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              清理损坏文件
            </button>
          </div>
        )}
      </div>

      {user?.isAdmin && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>管理员提示：</strong>
              所有书籍将同时保存在本地服务器和 Backblaze B2 云端（双重存储）。
              页面仅显示本地数据库的书籍。每本书提供"本地"和"云端"两种预览/下载方式。
              删除操作仅删除本地文件，云端备份保持不变。
              支持的格式：PDF, EPUB, MOBI, AZW3, TXT, DOC, DOCX。最大文件大小：500MB。
              <br />
              <strong className="text-green-700">✓ 已启用分块上传：</strong>文件将自动分割为 50MB 的块进行上传，支持大文件且更稳定。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ebooks.length > 0 ? (
          ebooks.map((ebook, index) => (
            <div
              key={ebook.id || ebook.filename || index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <Book className="h-8 w-8 text-blue-500 flex-shrink-0" />
                {ebook.b2Synced && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    已同步
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-lg mb-2 line-clamp-2" title={ebook.originalName}>
                {ebook.originalName}
              </h3>

              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <p className="flex items-center">
                  <HardDrive className="h-4 w-4 mr-1" />
                  {formatFileSize(ebook.fileSize)}
                </p>
                {ebook.uploadedByUsername && <p>上传者: {ebook.uploadedByUsername}</p>}
                <p className="text-xs text-gray-500">
                  {new Date(ebook.uploadedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>

              <div className="space-y-2">
                {/* 本地操作 */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 flex items-center">
                    <Server className="h-3 w-3 mr-1" />
                    本地
                  </span>
                  <button
                    onClick={() => handlePreviewLocal(ebook)}
                    className="flex-1 inline-flex items-center justify-center px-2 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs transition"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    预览
                  </button>
                  <button
                    onClick={() => handleDownloadLocal(ebook)}
                    className="flex-1 inline-flex items-center justify-center px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs transition"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    下载
                  </button>
                  {user?.isAdmin && (
                    <button
                      onClick={() => handleDelete(ebook)}
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition"
                      title="删除本地文件"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* 云端操作 */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 flex items-center">
                    <Cloud className="h-3 w-3 mr-1" />
                    云端
                  </span>
                  <button
                    onClick={() => handlePreviewCloud(ebook)}
                    disabled={!ebook.b2Synced}
                    className={`flex-1 inline-flex items-center justify-center px-2 py-1.5 rounded text-xs transition ${
                      ebook.b2Synced
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={ebook.b2Synced ? '从云端预览' : '尚未同步到云端'}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    预览
                  </button>
                  <button
                    onClick={() => handleDownloadCloud(ebook)}
                    disabled={!ebook.b2Synced}
                    className={`flex-1 inline-flex items-center justify-center px-2 py-1.5 rounded text-xs transition ${
                      ebook.b2Synced
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={ebook.b2Synced ? '从云端下载' : '尚未同步到云端'}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    下载
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            暂无电子书
            {user?.isAdmin && '，点击上方"上传电子书"按钮添加资源'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ebooks;

