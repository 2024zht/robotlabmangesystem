import axios from 'axios';
import { User, Rule, AuthResponse, PointLog, PointRequest, Leave, Ebook, Attendance, EquipmentType, EquipmentInstance, EquipmentRequest } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证API
export const authAPI = {
  register: (username: string, name: string, studentId: string, className: string, grade: string, email: string, phone: string, password: string, isMember: boolean) =>
    api.post('/auth/register', { username, name, studentId, className, grade, email, phone, password, isMember }),
  
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
};

// 用户API
export const userAPI = {
  getAll: () => api.get<User[]>('/users'),
  
  getMe: () => api.get<User>('/users/me'),
  
  updateProfile: (data: { name?: string; email?: string; phone?: string; className?: string }) =>
    api.patch('/users/me/profile', data),
  
  updatePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/users/me/password', { currentPassword, newPassword }),
  
  deleteUser: (id: number) => api.delete(`/users/${id}`),
  
  updatePoints: (id: number, points: number, reason: string) =>
    api.patch(`/users/${id}/points`, { points, reason }),
  
  setAdmin: (id: number, isAdmin: boolean) =>
    api.patch(`/users/${id}/admin`, { isAdmin }),
  
  updateUserPassword: (id: number, newPassword: string) =>
    api.patch(`/users/${id}/password`, { newPassword }),
  
  getLogs: (id: number) => api.get<PointLog[]>(`/users/${id}/logs`),
  
  // 撤销积分修改
  revertPointLog: (logId: number) => api.delete(`/users/point-logs/${logId}`),
  
  // 异议相关
  submitRequest: (points: number, reason: string) =>
    api.post('/users/requests', { points, reason }),
  
  getMyRequests: () => api.get<PointRequest[]>('/users/my-requests'),
  
  getAllRequests: () => api.get<PointRequest[]>('/users/requests'),
  
  handleRequest: (id: number, status: 'approved' | 'rejected', adminComment?: string) =>
    api.patch(`/users/requests/${id}`, { status, adminComment }),
};

// 规则API
export const ruleAPI = {
  getAll: () => api.get<Rule[]>('/rules'),
  
  getOne: (id: number) => api.get<Rule>(`/rules/${id}`),
  
  create: (name: string, points: number, description: string) =>
    api.post('/rules', { name, points, description }),
  
  update: (id: number, name: string, points: number, description: string) =>
    api.put(`/rules/${id}`, { name, points, description }),
  
  delete: (id: number) => api.delete(`/rules/${id}`),
};

// 请假API
export const leaveAPI = {
  submit: (leaveType: string, startTime: string, endTime: string, duration: string, reason: string) =>
    api.post('/leaves', { leaveType, startTime, endTime, duration, reason }),
  
  getMyLeaves: () => api.get<Leave[]>('/leaves/my-leaves'),
  
  getAll: (status?: string) => api.get<Leave[]>('/leaves', { params: { status } }),
  
  approve: (id: number, rejectReason?: string) =>
    api.patch(`/leaves/${id}`, { status: 'approved', rejectReason }),
  
  reject: (id: number, rejectReason: string) =>
    api.patch(`/leaves/${id}`, { status: 'rejected', rejectReason }),
};

// 电子书API
export const ebookAPI = {
  getAll: () => api.get<Ebook[]>('/ebooks'),
  
  upload: (formData: FormData, onUploadProgress?: (progressEvent: any) => void, cancelTokenSource?: any) =>
    api.post('/ebooks/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
      cancelToken: cancelTokenSource?.token,
      timeout: 600000, // 10分钟超时，支持大文件上传
    }),
  
  // 分块上传（使用 FormData）
  uploadChunk: (formData: FormData, cancelTokenSource?: any) =>
    api.post('/ebooks/upload-chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      cancelToken: cancelTokenSource?.token,
      timeout: 120000, // 单个分块 2 分钟超时
    }),
  
  // 合并分块
  mergeChunks: (data: {
    uploadId: string;
    fileName: string;
    fileSize: number;
  }) =>
    api.post('/ebooks/merge-chunks', data, {
      timeout: 300000, // 合并操作 5 分钟超时
    }),
  
  // 取消上传
  cancelUpload: (uploadId: string) =>
    api.delete(`/ebooks/cancel-upload/${uploadId}`),
  
  delete: (id: number) => api.delete(`/ebooks/${id}`),
  
  cleanupOrphans: () => api.post<{message: string; deletedCount: number; deletedFiles: string[]}>('/ebooks/cleanup-orphans'),
  
  getDownloadUrl: (filename: string) => api.get(`/ebooks/download/${encodeURIComponent(filename)}`),
};

// 点名API
export const attendanceAPI = {
  getAll: () => api.get<Attendance[]>('/attendances'),
  
  getOne: (id: number) => api.get<Attendance>(`/attendances/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    dateStart: string;
    dateEnd: string;
    locationName: string;
    latitude: number;
    longitude: number;
    radius: number;
    penaltyPoints?: number;
    targetGrades?: string[];
    targetUserIds?: number[];
  }) => api.post('/attendances', data),
  
  update: (id: number, data: {
    name: string;
    description?: string;
    dateStart: string;
    dateEnd: string;
    locationName: string;
    latitude: number;
    longitude: number;
    radius: number;
    penaltyPoints?: number;
    targetGrades?: string[];
    targetUserIds?: number[];
  }) => api.put(`/attendances/${id}`, data),
  
  delete: (id: number) => api.delete(`/attendances/${id}`),
  
  sign: (triggerId: number, latitude: number, longitude: number) =>
    api.post(`/attendances/${triggerId}/sign`, { latitude, longitude }),
  
  // 手动触发点名
  trigger: (id: number, options: { immediate?: boolean; customTime?: string }) =>
    api.post(`/attendances/${id}/trigger`, options),
};

// 设备类型API
export const equipmentTypeAPI = {
  getAll: () => api.get<EquipmentType[]>('/equipment/types'),
  
  getOne: (id: number) => api.get<EquipmentType>(`/equipment/types/${id}`),
  
  create: (formData: FormData) =>
    api.post('/equipment/types', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  update: (id: number, formData: FormData) =>
    api.put(`/equipment/types/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  delete: (id: number) => api.delete(`/equipment/types/${id}`),
};

// 设备实例API
export const equipmentInstanceAPI = {
  getByType: (typeId: number) => api.get<EquipmentInstance[]>(`/equipment/instances/type/${typeId}`),
  
  getOne: (id: number) => api.get<EquipmentInstance>(`/equipment/instances/${id}`),
  
  create: (data: { type_id: number; code: string; notes?: string }) =>
    api.post('/equipment/instances', data),
  
  createBatch: (data: { type_id: number; prefix: string; start: number; count: number }) =>
    api.post('/equipment/instances/batch', data),
  
  updateStatus: (id: number, status: string, notes?: string) =>
    api.patch(`/equipment/instances/${id}/status`, { status, notes }),
  
  delete: (id: number) => api.delete(`/equipment/instances/${id}`),
};

// 设备借用申请API
export const equipmentRequestAPI = {
  getAll: (status?: string) => 
    api.get<EquipmentRequest[]>('/equipment-requests', { params: { status } }),
  
  getMyRequests: () => api.get<EquipmentRequest[]>('/equipment-requests/my-requests'),
  
  getOne: (id: number) => api.get<EquipmentRequest>(`/equipment-requests/${id}`),
  
  create: (data: {
    equipment_id: number;
    borrow_date: string;
    return_date: string;
    reason: string;
  }) => api.post('/equipment-requests', data),
  
  approve: (id: number, admin_comment?: string) =>
    api.patch(`/equipment-requests/${id}/approve`, { admin_comment }),
  
  reject: (id: number, admin_comment: string) =>
    api.patch(`/equipment-requests/${id}/reject`, { admin_comment }),
  
  returnEquipment: (id: number, return_notes?: string) =>
    api.patch(`/equipment-requests/${id}/return`, { return_notes }),
  
  cancel: (id: number) => api.delete(`/equipment-requests/${id}`),
};

export default api;

