export interface User {
  id: number;
  username: string;
  name: string;
  studentId: string;
  className: string;
  email: string;
  phone: string;
  password: string;
  isAdmin: boolean;
  isMember: boolean;
  points: number;
  grade: string;
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
  createdAt: string;
}

export interface PointRequest {
  id: number;
  userId: number;
  points: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: number;
  adminComment?: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
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
  id: number;
  filename: string;
  originalName: string;
  fileSize: number;
  uploadedBy: number;
  uploadedByUsername?: string;
  uploadedAt: string;
  b2Synced: boolean;
  b2Path?: string;
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

