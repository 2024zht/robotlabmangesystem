export interface User {
  id: number;
  username: string;
  name: string;
  studentId: string;
  className: string;
  grade: string;
  email: string;
  isAdmin: boolean;
  points: number;
  createdAt: string;
}

export interface Rule {
  id: number;
  name: string;
  points: number;
  description: string;
  createdAt: string;
}

export interface PointLog {
  id: number;
  userId: number;
  points: number;
  reason: string;
  createdBy: number;
  createdByUsername: string;
  createdAt: string;
}

export interface PointRequest {
  id: number;
  userId: number;
  username: string;
  name: string;
  studentId: string;
  className: string;
  points: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: number;
  respondedByUsername?: string;
  adminComment?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Leave {
  id: number;
  userId: number;
  username?: string;
  name?: string;
  studentId?: string;
  leaveType: string;
  startTime: string;
  endTime: string;
  duration: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: number;
  respondedByUsername?: string;
  rejectReason?: string;
}

export interface Ebook {
  id?: number;
  filename: string;
  originalName: string;
  fileSize: number;
  uploadedBy?: number;
  uploadedByUsername?: string;
  uploadedAt: string;
  b2Synced: boolean;
  b2Path?: string;
  fromWorker?: boolean; // 标记是否从Worker获取（无法删除）
}

export interface UploadTask {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'syncing' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0-100
  serverProgress: number; // 上传到服务器的进度 0-100
  cloudProgress: number; // 上传到云端的进度 0-100
  error?: string;
  startTime?: number;
  endTime?: number;
  cancelTokenSource?: any; // axios CancelTokenSource
  uploadedFileId?: number; // 已上传文件的ID（用于取消时删除）
  uploadId?: string; // 分块上传的会话ID
}

export interface Attendance {
  id: number;
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  penaltyPoints: number;
  targetGrades: string[];
  targetUserIds: number[];
  createdBy: number;
  createdByUsername?: string;
  createdAt: string;
  completed: boolean;
  triggers?: DailyAttendanceTrigger[];
  totalTriggers?: number;
}

export interface DailyAttendanceTrigger {
  id: number;
  attendanceId: number;
  triggerDate: string;
  triggerTime: string;
  notificationSent: boolean;
  completed: boolean;
  signedCount?: number;
  hasSigned?: boolean;
  signedAt?: string;
  records?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: number;
  triggerId: number;
  userId: number;
  username: string;
  name: string;
  studentId: string;
  latitude: number;
  longitude: number;
  signedAt: string;
}

// ==================== 设备借用管理类型 ====================

export interface EquipmentType {
  id: number;
  name: string;
  image: string | null;
  description: string | null;
  total_count: number;
  available_count?: number;
  created_at: string;
}

export interface EquipmentInstance {
  id: number;
  type_id: number;
  code: string;
  status: 'available' | 'borrowed' | 'maintenance';
  notes: string | null;
  created_at: string;
  type_name?: string;
  type_image?: string;
  type_description?: string;
  history?: EquipmentRequest[];
}

export interface EquipmentRequest {
  id: number;
  user_id: number;
  equipment_id: number;
  borrow_date: string;
  return_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  admin_comment: string | null;
  approved_by: number | null;
  approved_at: string | null;
  returned_at: string | null;
  created_at: string;
  // 关联数据
  user_name?: string;
  student_id?: string;
  user_email?: string;
  class_name?: string;
  equipment_code?: string;
  equipment_name?: string;
  equipment_image?: string;
  equipment_description?: string;
  equipment_status?: string;
  approver_name?: string;
}

