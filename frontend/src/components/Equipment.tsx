import React, { useState, useEffect } from 'react';
import { Package, Calendar, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { equipmentTypeAPI, equipmentInstanceAPI, equipmentRequestAPI } from '../services/api';
import { EquipmentType, EquipmentInstance, EquipmentRequest } from '../types';

const Equipment: React.FC = () => {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null);
  const [instances, setInstances] = useState<EquipmentInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<EquipmentInstance | null>(null);
  const [myRequests, setMyRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'types' | 'instances' | 'borrow' | 'my-requests'>('types');
  
  // 借用表单状态
  const [borrowDate, setBorrowDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTypes();
    loadMyRequests();
  }, []);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const response = await equipmentTypeAPI.getAll();
      setTypes(response.data);
    } catch (error) {
      console.error('加载设备类型失败：', error);
      alert('加载设备类型失败');
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async (typeId: number) => {
    try {
      setLoading(true);
      const response = await equipmentInstanceAPI.getByType(typeId);
      setInstances(response.data);
    } catch (error) {
      console.error('加载设备实例失败：', error);
      alert('加载设备实例失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMyRequests = async () => {
    try {
      const response = await equipmentRequestAPI.getMyRequests();
      setMyRequests(response.data);
    } catch (error) {
      console.error('加载我的申请失败：', error);
    }
  };

  const handleSelectType = (type: EquipmentType) => {
    setSelectedType(type);
    loadInstances(type.id);
    setView('instances');
  };

  const handleSelectInstance = (instance: EquipmentInstance) => {
    if (instance.status !== 'available') {
      alert('该设备当前不可借用');
      return;
    }
    setSelectedInstance(instance);
    // 设置默认日期：明天到后天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    setBorrowDate(tomorrow.toISOString().slice(0, 16));
    setReturnDate(dayAfter.toISOString().slice(0, 16));
    setReason('');
    setView('borrow');
  };

  const handleSubmitRequest = async () => {
    if (!selectedInstance) return;
    
    if (!borrowDate || !returnDate || !reason.trim()) {
      alert('请填写完整的借用信息');
      return;
    }

    try {
      setSubmitting(true);
      await equipmentRequestAPI.create({
        equipment_id: selectedInstance.id,
        borrow_date: borrowDate,
        return_date: returnDate,
        reason: reason.trim()
      });
      
      alert('借用申请提交成功，请等待管理员审核');
      setView('my-requests');
      loadMyRequests();
      setSelectedInstance(null);
    } catch (error: any) {
      console.error('提交借用申请失败：', error);
      alert(error.response?.data?.error || '提交借用申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('确定要取消这个申请吗？')) return;
    
    try {
      await equipmentRequestAPI.cancel(requestId);
      alert('申请已取消');
      loadMyRequests();
    } catch (error: any) {
      console.error('取消申请失败：', error);
      alert(error.response?.data?.error || '取消申请失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { text: '待审核', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { text: '已批准', class: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { text: '已拒绝', class: 'bg-red-100 text-red-800', icon: XCircle },
      returned: { text: '已归还', class: 'bg-gray-100 text-gray-800', icon: CheckCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.text}
      </span>
    );
  };

  const getEquipmentStatusBadge = (status: string) => {
    const statusConfig = {
      available: { text: '可借用', class: 'bg-green-100 text-green-800' },
      borrowed: { text: '已借出', class: 'bg-blue-100 text-blue-800' },
      maintenance: { text: '维修中', class: 'bg-red-100 text-red-800' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.text}
      </span>
    );
  };

  // 设备类型列表视图
  const renderTypesView = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">设备借用</h2>
        <button
          onClick={() => setView('my-requests')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          我的申请 ({myRequests.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {types.map((type) => (
            <div
              key={type.id}
              onClick={() => handleSelectType(type)}
              className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="h-36 bg-gray-200 flex items-center justify-center">
                {type.image ? (
                  <img src={type.image} alt={type.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <Package className="w-16 h-16 text-gray-400" />
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{type.name}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{type.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">总数量: {type.total_count}</span>
                  <span className="text-lg font-bold text-green-600">
                    可用: {type.available_count || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 设备实例列表视图
  const renderInstancesView = () => (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={() => setView('types')}
          className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← 返回
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{selectedType?.name}</h2>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {instances.map((instance) => (
              <tr key={instance.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {instance.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getEquipmentStatusBadge(instance.status)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {instance.notes || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {instance.status === 'available' ? (
                    <button
                      onClick={() => handleSelectInstance(instance)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      申请借用
                    </button>
                  ) : (
                    <span className="text-gray-400">不可借用</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 借用申请表单视图
  const renderBorrowView = () => (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={() => setView('instances')}
          className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← 返回
        </button>
        <h2 className="text-2xl font-bold text-gray-900">申请借用设备</h2>
      </div>

      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">设备信息</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm"><span className="font-medium">设备类型：</span>{selectedType?.name}</p>
            <p className="text-sm"><span className="font-medium">设备编号：</span>{selectedInstance?.code}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              借用时间
            </label>
            <input
              type="datetime-local"
              value={borrowDate}
              onChange={(e) => setBorrowDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              归还时间
            </label>
            <input
              type="datetime-local"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="inline w-4 h-4 mr-1" />
              借用事由
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="请详细说明借用设备的具体用途和原因..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmitRequest}
            disabled={submitting}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>
          <button
            onClick={() => setView('instances')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );

  // 我的申请视图
  const renderMyRequestsView = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => setView('types')}
            className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold text-gray-900">我的申请</h2>
        </div>
      </div>

      <div className="space-y-4">
        {myRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无借用申请记录</p>
          </div>
        ) : (
          myRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {request.equipment_name} ({request.equipment_code})
                  </h3>
                  <p className="text-sm text-gray-500">
                    申请时间: {new Date(request.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">借用时间</p>
                  <p className="text-sm font-medium">{new Date(request.borrow_date).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">归还时间</p>
                  <p className="text-sm font-medium">{new Date(request.return_date).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">借用事由</p>
                <p className="text-sm text-gray-700">{request.reason}</p>
              </div>

              {request.admin_comment && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">管理员备注</p>
                  <p className="text-sm text-gray-700">{request.admin_comment}</p>
                  {request.approver_name && (
                    <p className="text-xs text-gray-500 mt-1">审批人: {request.approver_name}</p>
                  )}
                </div>
              )}

              {request.status === 'pending' && (
                <button
                  onClick={() => handleCancelRequest(request.id)}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-900 font-medium"
                >
                  取消申请
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {view === 'types' && renderTypesView()}
      {view === 'instances' && renderInstancesView()}
      {view === 'borrow' && renderBorrowView()}
      {view === 'my-requests' && renderMyRequestsView()}
    </div>
  );
};

export default Equipment;

