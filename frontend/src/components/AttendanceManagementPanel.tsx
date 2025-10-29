import React, { useState, useEffect } from 'react';
import { attendanceAPI, userAPI } from '../services/api';
import { Plus, Edit, Trash2, Calendar, MapPin, Clock, Users as UsersIcon, Zap } from 'lucide-react';
import { User } from '../types';

interface Attendance {
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
  triggers?: any[];
  totalTriggers?: number;
}

const AttendanceManagementPanel: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);
  const [customTime, setCustomTime] = useState('21:15');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dateStart: '',
    dateEnd: '',
    locationName: '',
    latitude: 36.54651556687031,  // 默认纬度
    longitude: 116.83038792943512,  // 默认经度
    radius: 100,
    penaltyPoints: 5,
    targetGrades: ['2024', '2025'] as string[],  // 默认面向2024和2025级
    targetUserIds: [] as number[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [attendanceRes, usersRes] = await Promise.all([
        attendanceAPI.getAll(),
        userAPI.getAll()
      ]);
      setAttendances(attendanceRes.data);
      setUsers(usersRes.data.filter(u => !u.isAdmin));
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await attendanceAPI.update(editingId, formData);
        alert('点名任务更新成功');
      } else {
        await attendanceAPI.create(formData);
        alert('点名任务创建成功');
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('保存点名任务失败:', error);
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleEdit = (attendance: Attendance) => {
    setFormData({
      name: attendance.name,
      description: attendance.description || '',
      dateStart: attendance.dateStart,
      dateEnd: attendance.dateEnd,
      locationName: attendance.locationName,
      latitude: attendance.latitude,
      longitude: attendance.longitude,
      radius: attendance.radius,
      penaltyPoints: attendance.penaltyPoints,
      targetGrades: attendance.targetGrades || ['2024', '2025'],
      targetUserIds: attendance.targetUserIds || [],
    });
    setEditingId(attendance.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个点名任务吗？这将删除所有相关的签到记录。')) return;
    
    try {
      await attendanceAPI.delete(id);
      alert('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleTriggerNow = async (id: number) => {
    if (!window.confirm('确定要立即触发点名吗？将立即发送邮件通知给目标用户。')) return;
    
    try {
      await attendanceAPI.trigger(id, { immediate: true });
      alert('点名已立即触发，邮件通知已发送！');
      fetchData();
    } catch (error: any) {
      console.error('触发点名失败:', error);
      alert(error.response?.data?.error || '触发点名失败');
    }
  };

  const handleTriggerCustom = async () => {
    if (!triggeringId) return;
    
    try {
      await attendanceAPI.trigger(triggeringId, { customTime });
      alert(`点名已设置在 ${customTime} 触发！`);
      setShowTriggerModal(false);
      setTriggeringId(null);
      fetchData();
    } catch (error: any) {
      console.error('设置触发时间失败:', error);
      alert(error.response?.data?.error || '设置触发时间失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dateStart: '',
      dateEnd: '',
      locationName: '',
      latitude: 36.54651556687031,
      longitude: 116.83038792943512,
      radius: 100,
      penaltyPoints: 5,
      targetGrades: ['2024', '2025'],
      targetUserIds: [],
    });
  };

  const handleGradeToggle = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      targetGrades: prev.targetGrades.includes(grade)
        ? prev.targetGrades.filter(g => g !== grade)
        : [...prev.targetGrades, grade]
    }));
  };

  const handleUserToggle = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      targetUserIds: prev.targetUserIds.includes(userId)
        ? prev.targetUserIds.filter(id => id !== userId)
        : [...prev.targetUserIds, userId]
    }));
  };

  const getStatusText = (attendance: Attendance) => {
    const today = new Date().toISOString().split('T')[0];
    const start = attendance.dateStart;
    const end = attendance.dateEnd;

    if (attendance.completed) {
      return { text: '已完成', color: 'bg-gray-500' };
    } else if (today < start) {
      return { text: '未开始', color: 'bg-blue-500' };
    } else if (today >= start && today <= end) {
      return { text: '进行中', color: 'bg-green-500' };
    } else {
      return { text: '已结束', color: 'bg-orange-500' };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">点名任务管理</h3>
          <p className="text-sm text-gray-600 mt-1">
            设置日期范围，系统将在每天晚上9:15-9:25随机时间发送点名通知，签到时限3分钟
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          创建点名任务
        </button>
      </div>

      {/* 自定义触发时间模态框 */}
      {showTriggerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">设置触发时间</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  触发时间
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  将在今天的指定时间触发点名并发送邮件通知，签到时限3分钟
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerCustom}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  确认设置
                </button>
                <button
                  onClick={() => {
                    setShowTriggerModal(false);
                    setTriggeringId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 创建/编辑表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? '编辑点名任务' : '创建点名任务'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  点名主题 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始日期 *
                  </label>
                  <input
                    type="date"
                    value={formData.dateStart}
                    onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">点名开始日期</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束日期 *
                  </label>
                  <input
                    type="date"
                    value={formData.dateEnd}
                    onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">点名结束日期</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>触发时间说明：</strong>系统将在日期范围内的每天晚上9:15-9:25之间随机选择一个时间发送点名通知，签到时限为3分钟。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  地点名称 *
                </label>
                <input
                  type="text"
                  value={formData.locationName}
                  onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：实验室A座301"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    纬度 *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    经度 *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    签到半径 (米) *
                  </label>
                  <input
                    type="number"
                    value={formData.radius}
                    onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    缺席扣分 *
                  </label>
                  <input
                    type="number"
                    value={formData.penaltyPoints}
                    onChange={(e) => setFormData({ ...formData, penaltyPoints: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* 面向人群选择 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <UsersIcon className="inline h-4 w-4 mr-1" />
                  面向人群
                </label>
                
                {/* 年级选择 */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">按年级（默认：2024级和2025级）</p>
                  <div className="flex flex-wrap gap-2">
                    {['2023', '2024', '2025', '2026'].map(grade => (
                      <label
                        key={grade}
                        className={`flex items-center px-4 py-2 border rounded-lg cursor-pointer transition ${
                          formData.targetGrades.includes(grade)
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.targetGrades.includes(grade)}
                          onChange={() => handleGradeToggle(grade)}
                          className="mr-2"
                        />
                        {grade}级
                      </label>
                    ))}
                  </div>
                </div>

                {/* 指定人员选择 */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">或指定人员（可选，与年级取并集）</p>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50">
                    {users.length === 0 ? (
                      <p className="text-sm text-gray-500">暂无可选用户</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {users.map(user => (
                          <label
                            key={user.id}
                            className={`flex items-center px-3 py-2 border rounded cursor-pointer transition text-sm ${
                              formData.targetUserIds.includes(user.id)
                                ? 'bg-blue-50 border-blue-400 text-blue-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.targetUserIds.includes(user.id)}
                              onChange={() => handleUserToggle(user.id)}
                              className="mr-2"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{user.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {user.studentId} ({user.grade}级)
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    已选 {formData.targetUserIds.length} 人
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingId ? '保存修改' : '创建任务'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 点名列表 */}
      <div className="space-y-4">
        {attendances.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
            暂无点名任务，点击"创建点名任务"开始
          </div>
        ) : (
          attendances.map((attendance) => {
            const status = getStatusText(attendance);
            return (
              <div
                key={attendance.id}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-gray-800">{attendance.name}</h3>
                      <span className={`px-2 py-1 ${status.color} text-white text-xs rounded`}>
                        {status.text}
                      </span>
                    </div>
                    {attendance.description && (
                      <p className="text-sm text-gray-600 mt-1">{attendance.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(attendance)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                      title="编辑"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(attendance.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    日期范围：{attendance.dateStart} 至 {attendance.dateEnd}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-green-600" />
                    触发时间：每天晚上9:15-9:25随机
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-red-600" />
                    {attendance.locationName} ({attendance.radius}米)
                  </div>
                  <div className="text-sm text-gray-600">
                    扣分：{attendance.penaltyPoints} 分
                  </div>
                </div>

                {/* 触发点名按钮 */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleTriggerNow(attendance.id)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                    title="立即触发点名"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    立即点名
                  </button>
                  <button
                    onClick={() => {
                      setTriggeringId(attendance.id);
                      setShowTriggerModal(true);
                    }}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                    title="设置触发时间"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    定时点名
                  </button>
                </div>

                {attendance.triggers && attendance.triggers.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      已触发 {attendance.totalTriggers} 次
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {attendance.triggers.slice(0, 3).map((trigger: any) => (
                        <div key={trigger.id} className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium">{trigger.triggerDate}</div>
                          <div className="text-gray-600">
                            触发时间：{trigger.triggerTime}
                          </div>
                          <div className="text-gray-600">
                            签到人数：{trigger.signedCount || 0}
                          </div>
                          <div className={`${trigger.completed ? 'text-gray-500' : 'text-green-600'}`}>
                            {trigger.completed ? '已完成' : '进行中'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {attendance.triggers.length > 3 && (
                      <p className="text-xs text-gray-500 mt-2">
                        还有 {attendance.triggers.length - 3} 条记录...
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AttendanceManagementPanel;

