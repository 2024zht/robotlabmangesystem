import React, { useState, useEffect } from 'react';
import { leaveAPI } from '../services/api';
import { Leave } from '../types';
import { Calendar, Clock, FileText, Send, History } from 'lucide-react';

const LeaveRequest: React.FC = () => {
  const [leaveType, setLeaveType] = useState('事假');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [myLeaves, setMyLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  useEffect(() => {
    // 自动计算时长
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diff = end.getTime() - start.getTime();
      
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setDuration(`${days}天${hours}小时`);
      } else {
        setDuration('');
      }
    }
  }, [startTime, endTime]);

  const fetchMyLeaves = async () => {
    try {
      const { data } = await leaveAPI.getMyLeaves();
      setMyLeaves(data);
    } catch (error) {
      console.error('获取请假记录失败:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startTime || !endTime || !duration || !reason) {
      alert('请填写完整信息');
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    setLoading(true);
    try {
      await leaveAPI.submit(leaveType, startTime, endTime, duration, reason);
      alert('请假申请已提交');
      // 清空表单
      setStartTime('');
      setEndTime('');
      setDuration('');
      setReason('');
      // 刷新列表
      fetchMyLeaves();
    } catch (error: any) {
      alert(error.response?.data?.error || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">待审批</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">已批准</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">已拒绝</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：提交请假申请 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Send className="h-6 w-6 mr-2 text-blue-600" />
            发起请假申请
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                请假类型
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option>事假</option>
                <option>病假</option>
                <option>年假</option>
                <option>调休</option>
                <option>其他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                开始时间
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                结束时间
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                请假时长（自动计算）
              </label>
              <input
                type="text"
                value={duration}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                placeholder="将根据起止时间自动计算"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="inline h-4 w-4 mr-1" />
                请假事由
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="请详细说明请假原因..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '提交中...' : '提交申请'}
            </button>
          </form>
        </div>

        {/* 右侧：我的请假记录 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <History className="h-6 w-6 mr-2 text-green-600" />
            我的请假记录
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {myLeaves.length > 0 ? (
              myLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-semibold text-lg">{leave.leaveType}</span>
                      <span className="ml-2">{getStatusBadge(leave.status)}</span>
                    </div>
                    <span className="text-gray-500 text-sm">
                      {new Date(leave.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <Clock className="inline h-4 w-4 mr-1" />
                      {new Date(leave.startTime).toLocaleString('zh-CN')} 至{' '}
                      {new Date(leave.endTime).toLocaleString('zh-CN')}
                    </p>
                    <p>时长: {leave.duration}</p>
                    <p>事由: {leave.reason}</p>
                    {leave.status !== 'pending' && leave.respondedByUsername && (
                      <p className="text-gray-500">
                        审批人: {leave.respondedByUsername} | 
                        时间: {new Date(leave.respondedAt!).toLocaleString('zh-CN')}
                      </p>
                    )}
                    {leave.rejectReason && (
                      <p className="text-red-600 bg-red-50 p-2 rounded">
                        拒绝理由: {leave.rejectReason}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无请假记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;

