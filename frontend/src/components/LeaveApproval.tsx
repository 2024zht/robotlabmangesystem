import React, { useState, useEffect } from 'react';
import { leaveAPI } from '../services/api';
import { Leave } from '../types';
import { CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';

const LeaveApproval: React.FC = () => {
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [processedLeaves, setProcessedLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const { data } = await leaveAPI.getAll();
      setPendingLeaves(data.filter(l => l.status === 'pending'));
      setProcessedLeaves(data.filter(l => l.status !== 'pending'));
    } catch (error) {
      console.error('获取请假记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!window.confirm('确定批准此请假申请吗？')) return;

    try {
      await leaveAPI.approve(id);
      alert('已批准');
      fetchLeaves();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('请输入拒绝理由（必填）:');
    if (!reason) {
      alert('必须填写拒绝理由');
      return;
    }

    try {
      await leaveAPI.reject(id, reason);
      alert('已拒绝');
      fetchLeaves();
    } catch (error) {
      alert('操作失败');
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">请假审批管理</h2>

      {/* 待审批 */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-orange-700 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          待审批 ({pendingLeaves.length})
        </h3>
        
        {pendingLeaves.length > 0 ? (
          <div className="space-y-4">
            {pendingLeaves.map((leave) => (
              <div
                key={leave.id}
                className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-5 w-5 text-gray-600" />
                      <span className="font-semibold text-lg">
                        {leave.name} ({leave.studentId})
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-700">
                      <p><strong>类型:</strong> {leave.leaveType}</p>
                      <p>
                        <Calendar className="inline h-4 w-4 mr-1" />
                        <strong>时间:</strong> {new Date(leave.startTime).toLocaleString('zh-CN')} 
                        {' 至 '}
                        {new Date(leave.endTime).toLocaleString('zh-CN')}
                      </p>
                      <p><strong>时长:</strong> {leave.duration}</p>
                      <p><strong>事由:</strong> {leave.reason}</p>
                      <p className="text-gray-500">
                        提交时间: {new Date(leave.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleApprove(leave.id)}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      批准
                    </button>
                    <button
                      onClick={() => handleReject(leave.id)}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm whitespace-nowrap"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            暂无待审批的请假申请
          </div>
        )}
      </div>

      {/* 已处理 */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-700">
          已处理 ({processedLeaves.length})
        </h3>
        
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {processedLeaves.map((leave) => (
            <div
              key={leave.id}
              className={`p-4 border rounded-lg ${
                leave.status === 'approved'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold">
                      {leave.name} ({leave.studentId})
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      leave.status === 'approved'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {leave.status === 'approved' ? '✓ 已批准' : '✗ 已拒绝'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{leave.leaveType} | {leave.duration}</p>
                    <p>{new Date(leave.startTime).toLocaleDateString('zh-CN')} - {new Date(leave.endTime).toLocaleDateString('zh-CN')}</p>
                    {leave.rejectReason && (
                      <p className="text-red-700">拒绝理由: {leave.rejectReason}</p>
                    )}
                    <p className="text-gray-500 text-xs">
                      审批人: {leave.respondedByUsername} | {new Date(leave.respondedAt!).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeaveApproval;

