import React, { useState, useEffect } from 'react';
import { User, Rule, PointRequest, EquipmentRequest, EquipmentType } from '../types';
import { userAPI, ruleAPI, equipmentRequestAPI, equipmentTypeAPI, equipmentInstanceAPI } from '../services/api';
import { Settings, Users, BookOpen, Edit2, Trash2, Plus, Save, X, Upload, Download, MessageSquare, Check, XCircle, MapPin, Package } from 'lucide-react';
import AttendanceManagementPanel from './AttendanceManagementPanel';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'rules' | 'import' | 'requests' | 'attendance' | 'equipment'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);
  const [selectedEquipmentRequest, setSelectedEquipmentRequest] = useState<EquipmentRequest | null>(null);
  const [equipmentAdminComment, setEquipmentAdminComment] = useState('');
  const [equipmentSubTab, setEquipmentSubTab] = useState<'requests' | 'types'>('requests');
  const [showBatchAddInstance, setShowBatchAddInstance] = useState(false);
  const [showAddEquipmentType, setShowAddEquipmentType] = useState(false);
  const [selectedTypeForBatch, setSelectedTypeForBatch] = useState<number | null>(null);
  const [batchAddForm, setBatchAddForm] = useState({ prefix: '', start: 1, count: 1 });
  const [newEquipmentType, setNewEquipmentType] = useState({ name: '', description: '', imageFile: null as File | null, imagePreview: '' });
  const [loading, setLoading] = useState(true);
  
  // 编辑规则状态
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState({ name: '', points: 0, description: '' });
  const [showAddRule, setShowAddRule] = useState(false);

  // 批量导入状态
  const [importData, setImportData] = useState('');
  const [importReason, setImportReason] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rulesRes, requestsRes] = await Promise.all([
        userAPI.getAll(),
        ruleAPI.getAll(),
        userAPI.getAllRequests()
      ]);
      setUsers(usersRes.data);
      setRules(rulesRes.data);
      setRequests(requestsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipmentData = async () => {
    try {
      const [typesRes, requestsRes] = await Promise.all([
        equipmentTypeAPI.getAll(),
        equipmentRequestAPI.getAll()
      ]);
      setEquipmentTypes(typesRes.data);
      setEquipmentRequests(requestsRes.data);
    } catch (error) {
      console.error('Failed to fetch equipment data:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'equipment') {
      fetchEquipmentData();
    }
  }, [activeTab]);

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('确定要删除此用户吗？')) return;
    try {
      await userAPI.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      alert('用户已删除');
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleUpdatePoints = async (id: number) => {
    const pointsStr = prompt('输入积分变化（正数加分，负数扣分）：');
    if (!pointsStr) return;
    const points = parseInt(pointsStr);
    if (isNaN(points)) {
      alert('请输入有效数字');
      return;
    }
    const reason = prompt('请输入原因：') || '管理员调整';
    
    try {
      await userAPI.updatePoints(id, points, reason);
      fetchData();
      alert('积分已更新');
    } catch (error) {
      alert('更新失败');
    }
  };

  const handleToggleAdmin = async (user: User) => {
    if (!window.confirm(`确定要${user.isAdmin ? '取消' : '设置'}此用户的管理员权限吗？`)) return;
    try {
      await userAPI.setAdmin(user.id, !user.isAdmin);
      fetchData();
      alert('权限已更新');
    } catch (error) {
      alert('更新失败');
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!window.confirm('确定要删除此规则吗？')) return;
    try {
      await ruleAPI.delete(id);
      setRules(rules.filter(r => r.id !== id));
      alert('规则已删除');
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name || newRule.points === 0) {
      alert('请填写规则名称和积分');
      return;
    }
    try {
      await ruleAPI.create(newRule.name, newRule.points, newRule.description);
      setNewRule({ name: '', points: 0, description: '' });
      setShowAddRule(false);
      fetchData();
      alert('规则已添加');
    } catch (error) {
      alert('添加失败');
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    try {
      await ruleAPI.update(editingRule.id, editingRule.name, editingRule.points, editingRule.description);
      setEditingRule(null);
      fetchData();
      alert('规则已更新');
    } catch (error) {
      alert('更新失败');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setImportData(text);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleBatchImport = async () => {
    if (!importData || !importReason) {
      alert('请填写导入数据和原因');
      return;
    }

    try {
      // 解析CSV数据
      const lines = importData.trim().split('\n');
      const records = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('学号')) continue; // 跳过空行和表头

        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          records.push({
            studentId: parts[0],
            points: parseInt(parts[1])
          });
        }
      }

      if (records.length === 0) {
        alert('没有有效的导入数据');
        return;
      }

      // 调用API
      const response = await fetch('/api/users/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ records, reason: importReason })
      });

      const result = await response.json();
      setImportResult(result);
      
      if (result.success > 0) {
        // 显示成功提示
        setShowSuccessModal(true);
        
        // 清空输入
        setImportData('');
        setImportReason('');
        setSelectedFile(null);
        
        // 清空文件输入
        const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        
        // 刷新数据
        fetchData();
        
        // 3秒后自动关闭成功提示
        setTimeout(() => {
          setShowSuccessModal(false);
        }, 3000);
      } else {
        // 如果全部失败，不清空数据，方便用户修改重试
        alert('导入失败，请检查数据格式');
      }
    } catch (error) {
      alert('导入失败');
      console.error(error);
    }
  };

  const downloadTemplate = () => {
    const template = `学号,积分,备注
2021001,10,完成实验报告
2021002,15,参加组会并发言
2021003,-5,迟到`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '批量导入模板.csv';
    link.click();
  };

  const handleApproveRequest = async (requestId: number, adminComment?: string) => {
    try {
      await userAPI.handleRequest(requestId, 'approved', adminComment);
      alert('已批准该异议');
      fetchData();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleRejectRequest = async (requestId: number, adminComment?: string) => {
    try {
      await userAPI.handleRequest(requestId, 'rejected', adminComment);
      alert('已拒绝该异议');
      fetchData();
    } catch (error) {
      alert('操作失败');
    }
  };

  // 设备借用申请处理函数
  const handleApproveEquipmentRequest = async () => {
    if (!selectedEquipmentRequest) return;
    
    try {
      await equipmentRequestAPI.approve(selectedEquipmentRequest.id, equipmentAdminComment || undefined);
      alert('申请已批准');
      setSelectedEquipmentRequest(null);
      setEquipmentAdminComment('');
      fetchEquipmentData();
    } catch (error: any) {
      alert(error.response?.data?.error || '批准申请失败');
    }
  };

  const handleRejectEquipmentRequest = async () => {
    if (!selectedEquipmentRequest) return;
    
    if (!equipmentAdminComment.trim()) {
      alert('拒绝申请时必须填写理由');
      return;
    }
    
    try {
      await equipmentRequestAPI.reject(selectedEquipmentRequest.id, equipmentAdminComment);
      alert('申请已拒绝');
      setSelectedEquipmentRequest(null);
      setEquipmentAdminComment('');
      fetchEquipmentData();
    } catch (error: any) {
      alert(error.response?.data?.error || '拒绝申请失败');
    }
  };

  const handleReturnEquipment = async (requestId: number) => {
    const notes = prompt('归还备注（可选）：');
    
    try {
      await equipmentRequestAPI.returnEquipment(requestId, notes || undefined);
      alert('设备归还确认成功');
      fetchEquipmentData();
    } catch (error: any) {
      alert(error.response?.data?.error || '确认归还失败');
    }
  };

  const getEquipmentStatusBadge = (status: string) => {
    const config: Record<string, {text: string, class: string}> = {
      pending: { text: '待审核', class: 'bg-yellow-100 text-yellow-800' },
      approved: { text: '已批准', class: 'bg-green-100 text-green-800' },
      rejected: { text: '已拒绝', class: 'bg-red-100 text-red-800' },
      returned: { text: '已归还', class: 'bg-gray-100 text-gray-800' },
    };
    const { text, class: className } = config[status] || config.pending;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${className}`}>{text}</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">管理员面板</h2>
        </div>

        {/* 标签页 */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline-block h-5 w-5 mr-2" />
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base ${
                activeTab === 'rules'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BookOpen className="inline-block h-5 w-5 mr-2" />
              规则管理
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base ${
                activeTab === 'import'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="inline-block h-5 w-5 mr-2" />
              批量导入
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base relative ${
                activeTab === 'requests'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="inline-block h-5 w-5 mr-2" />
              异议管理
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base ${
                activeTab === 'attendance'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MapPin className="inline-block h-5 w-5 mr-2" />
              点名管理
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm sm:text-base ${
                activeTab === 'equipment'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="inline-block h-5 w-5 mr-2" />
              设备管理
            </button>
          </nav>
        </div>

        {/* 用户管理 */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户名
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    邮箱
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    积分
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    角色
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                      {user.email}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.points}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm hidden md:table-cell">
                      {user.isAdmin ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          管理员
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          成员
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleUpdatePoints(user.id)}
                        className="text-primary-600 hover:text-primary-900"
                        title="修改积分"
                      >
                        <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className="text-purple-600 hover:text-purple-900"
                        title={user.isAdmin ? '取消管理员' : '设为管理员'}
                      >
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                        title="删除用户"
                      >
                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 规则管理 */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>添加规则</span>
            </button>

            {showAddRule && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 text-sm sm:text-base">新增规则</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="规则名称"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                  />
                  <input
                    type="number"
                    placeholder="积分（正数加分，负数扣分）"
                    value={newRule.points || ''}
                    onChange={(e) => setNewRule({ ...newRule, points: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                  />
                  <textarea
                    placeholder="规则描述"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                    rows={2}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddRule}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 text-sm sm:text-base"
                    >
                      <Save className="h-4 w-4" />
                      <span>保存</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRule(false);
                        setNewRule({ name: '', points: 0, description: '' });
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center space-x-2 text-sm sm:text-base"
                    >
                      <X className="h-4 w-4" />
                      <span>取消</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-lg">
                  {editingRule?.id === rule.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingRule.name}
                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                      />
                      <input
                        type="number"
                        value={editingRule.points}
                        onChange={(e) => setEditingRule({ ...editingRule, points: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                      />
                      <textarea
                        value={editingRule.description}
                        onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        rows={2}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleUpdateRule}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-1 text-sm"
                        >
                          <Save className="h-4 w-4" />
                          <span>保存</span>
                        </button>
                        <button
                          onClick={() => setEditingRule(null)}
                          className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center space-x-1 text-sm"
                        >
                          <X className="h-4 w-4" />
                          <span>取消</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-semibold text-sm sm:text-base">{rule.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs sm:text-sm font-bold ${
                            rule.points > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rule.points > 0 ? '+' : ''}{rule.points}
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-1">{rule.description}</p>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setEditingRule(rule)}
                          className="text-primary-600 hover:text-primary-900"
                          title="编辑"
                        >
                          <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-600 hover:text-red-900"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 批量导入 */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">📋 导入说明</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 支持CSV格式：学号,积分,备注</li>
                <li>• 积分可以是正数（加分）或负数（扣分）</li>
                <li>• 学号必须在系统中已存在</li>
                <li>• 每行一条记录，逗号分隔</li>
              </ul>
              <button
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                下载模板文件
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上传CSV文件或手动输入
              </label>
              
              {/* 文件上传 */}
              <div className="mb-3">
                <div className="flex items-center space-x-3">
                  <input
                    id="csvFileInput"
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="csvFileInput"
                    className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    选择CSV文件
                  </label>
                  {selectedFile && (
                    <span className="text-sm text-gray-600 flex items-center">
                      <span className="mr-2">📄 {selectedFile.name}</span>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setImportData('');
                          const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </div>
              </div>

              {/* 文本输入 */}
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                rows={10}
                placeholder={`学号,积分,备注
2021001,10,完成实验报告
2021002,15,参加组会并发言
2021003,-5,迟到`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                导入原因（必填）
              </label>
              <input
                type="text"
                value={importReason}
                onChange={(e) => setImportReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="例如：第一次作业成绩"
              />
            </div>

            <button
              onClick={handleBatchImport}
              disabled={!importData || !importReason}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center"
            >
              <Upload className="h-5 w-5 mr-2" />
              开始导入
            </button>

            {importResult && (
              <div className={`p-4 rounded-lg ${
                importResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <h4 className="font-semibold mb-2">
                  {importResult.failed === 0 ? '✅ 导入成功' : '⚠️ 导入完成（部分失败）'}
                </h4>
                <div className="text-sm space-y-1">
                  <p className="text-green-700">成功: {importResult.success} 条</p>
                  {importResult.failed > 0 && (
                    <p className="text-red-700">失败: {importResult.failed} 条</p>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-red-800 mb-1">错误详情:</p>
                      <ul className="text-red-700 space-y-1">
                        {importResult.errors.map((err: string, idx: number) => (
                          <li key={idx}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">💡 使用提示</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>1. 点击"下载模板文件"获取CSV模板</li>
                <li>2. 使用Excel或记事本编辑模板，填入数据</li>
                <li>3. 复制数据粘贴到上方文本框</li>
                <li>4. 填写导入原因（如"第一次作业"）</li>
                <li>5. 点击"开始导入"执行批量操作</li>
              </ul>
            </div>
          </div>
        )}

        {/* 点名管理 */}
        {activeTab === 'attendance' && (
          <AttendanceManagementPanel />
        )}

        {/* 设备管理 */}
        {activeTab === 'equipment' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">设备管理</h3>
            </div>

            {/* 子标签页 */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-8">
                <button
                  onClick={() => setEquipmentSubTab('requests')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                    equipmentSubTab === 'requests'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  借用审批
                  {equipmentRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {equipmentRequests.filter(r => r.status === 'pending').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setEquipmentSubTab('types')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                    equipmentSubTab === 'types'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  设备类型管理
                </button>
              </nav>
            </div>

            {/* 借用申请审批 */}
            {equipmentSubTab === 'requests' && (
              <div>
            
            {/* 待审核申请 */}
            {equipmentRequests.filter(r => r.status === 'pending').length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-yellow-700 mb-3">
                  ⏳ 待审核 ({equipmentRequests.filter(r => r.status === 'pending').length})
                </h4>
                <div className="space-y-3">
                  {equipmentRequests.filter(r => r.status === 'pending').map((request) => (
                    <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-semibold text-gray-900">{request.equipment_name}</h5>
                            <span className="text-sm text-gray-600">({request.equipment_code})</span>
                            {getEquipmentStatusBadge(request.status)}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                            <div>
                              <span className="text-gray-500">申请人：</span>
                              <span className="font-medium">{request.user_name} ({request.student_id})</span>
                            </div>
                            <div>
                              <span className="text-gray-500">班级：</span>
                              <span>{request.class_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">借用：</span>
                              <span>{new Date(request.borrow_date).toLocaleString('zh-CN')}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">归还：</span>
                              <span>{new Date(request.return_date).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">借用事由：</span>
                            <p className="text-gray-700 mt-1">{request.reason}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEquipmentRequest(request);
                            setEquipmentAdminComment('');
                          }}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          审批
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已批准申请 */}
            {equipmentRequests.filter(r => r.status === 'approved').length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-green-700 mb-3">
                  ✓ 已批准 ({equipmentRequests.filter(r => r.status === 'approved').length})
                </h4>
                <div className="space-y-3">
                  {equipmentRequests.filter(r => r.status === 'approved').map((request) => (
                    <div key={request.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-semibold text-gray-900">{request.equipment_name}</h5>
                            <span className="text-sm text-gray-600">({request.equipment_code})</span>
                            {getEquipmentStatusBadge(request.status)}
                          </div>
                          <div className="text-sm text-gray-600">
                            借用人：{request.user_name} | 
                            归还时间：{new Date(request.return_date).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleReturnEquipment(request.id)}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          确认归还
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 历史记录 */}
            {equipmentRequests.filter(r => !['pending', 'approved'].includes(r.status)).length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-3">
                  📋 历史记录 ({equipmentRequests.filter(r => !['pending', 'approved'].includes(r.status)).length})
                </h4>
                <div className="space-y-2">
                  {equipmentRequests.filter(r => !['pending', 'approved'].includes(r.status)).map((request) => (
                    <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex-1 text-sm">
                          <span className="font-medium">{request.user_name}</span> - {request.equipment_name} ({request.equipment_code})
                        </div>
                        {getEquipmentStatusBadge(request.status)}
                        <span className="text-xs text-gray-500 ml-3">
                          {new Date(request.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {equipmentRequests.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                暂无借用申请
              </div>
            )}
              </div>
            )}

            {/* 设备类型管理 */}
            {equipmentSubTab === 'types' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">管理设备类型和实例</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddEquipmentType(true);
                        setNewEquipmentType({ name: '', description: '', imageFile: null, imagePreview: '' });
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      添加设备类型
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTypeForBatch(null);
                        setShowBatchAddInstance(true);
                        setBatchAddForm({ prefix: '', start: 1, count: 1 });
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      批量添加设备
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {equipmentTypes.map((type) => (
                    <div key={type.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        {type.image ? (
                          <img 
                            src={type.image} 
                            alt={type.name} 
                            className="w-12 h-12 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Cpath d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"%3E%3C/path%3E%3Cpolyline points="3.27 6.96 12 12.01 20.73 6.96"%3E%3C/polyline%3E%3Cline x1="12" y1="22.08" x2="12" y2="12"%3E%3C/line%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{type.name}</h4>
                          <p className="text-sm text-gray-600">总数：{type.total_count}</p>
                          <p className="text-sm text-green-600">可用：{type.available_count || 0}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{type.description}</p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-400">
                          创建于 {new Date(type.created_at).toLocaleDateString('zh-CN')}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTypeForBatch(type.id);
                            setShowBatchAddInstance(true);
                            setBatchAddForm({ prefix: type.name.substring(0, 3).toUpperCase(), start: type.total_count + 1, count: 1 });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          添加实例
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {equipmentTypes.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p>暂无设备类型</p>
                    <p className="text-sm mt-2">设备数据已在系统初始化时自动创建</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 异议管理 */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                用户异议列表
                <span className="ml-2 text-sm text-gray-500">
                  (待处理: {requests.filter(r => r.status === 'pending').length})
                </span>
              </h3>
            </div>

            {/* 待处理异议 */}
            <div className="mb-6">
              <h4 className="font-medium text-orange-700 mb-3">⏳ 待处理异议</h4>
              {requests.filter(r => r.status === 'pending').length > 0 ? (
                <div className="space-y-3">
                  {requests.filter(r => r.status === 'pending').map((request) => (
                    <div key={request.id} className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-semibold text-gray-900">
                              {request.name} ({request.studentId})
                            </span>
                            <span className="text-sm text-gray-600">- {request.className}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              request.points > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              申请 {request.points > 0 ? '+' : ''}{request.points} 分
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">
                            <strong>理由:</strong> {request.reason}
                          </p>
                          <p className="text-sm text-gray-500">
                            📅 {new Date(request.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => {
                              const comment = prompt('批准理由（可选）:');
                              if (comment !== null) {
                                handleApproveRequest(request.id, comment || undefined);
                              }
                            }}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            批准
                          </button>
                          <button
                            onClick={() => {
                              const comment = prompt('拒绝理由（必填）:');
                              if (comment) {
                                handleRejectRequest(request.id, comment);
                              }
                            }}
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
                  暂无待处理异议
                </div>
              )}
            </div>

            {/* 已处理异议 */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">📋 已处理异议</h4>
              {requests.filter(r => r.status !== 'pending').length > 0 ? (
                <div className="space-y-3">
                  {requests.filter(r => r.status !== 'pending').map((request) => (
                    <div 
                      key={request.id} 
                      className={`p-4 border rounded-lg ${
                        request.status === 'approved' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-semibold text-gray-900">
                              {request.name} ({request.studentId})
                            </span>
                            <span className="text-sm text-gray-600">- {request.className}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              request.status === 'approved'
                                ? 'bg-green-200 text-green-800'
                                : 'bg-gray-200 text-gray-800'
                            }`}>
                              {request.status === 'approved' ? '✓ 已批准' : '✗ 已拒绝'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              request.points > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.points > 0 ? '+' : ''}{request.points} 分
                            </span>
                          </div>
                          <p className="text-gray-700 mb-1">
                            <strong>用户理由:</strong> {request.reason}
                          </p>
                          {request.adminComment && (
                            <p className="text-gray-700 mb-1">
                              <strong>管理员备注:</strong> {request.adminComment}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span>📅 提交时间: {new Date(request.createdAt).toLocaleString('zh-CN')}</span>
                            {request.respondedAt && (
                              <>
                                <span>✓ 处理时间: {new Date(request.respondedAt).toLocaleString('zh-CN')}</span>
                                {request.respondedByUsername && (
                                  <span>👤 处理人: {request.respondedByUsername}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  暂无历史记录
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 添加设备类型弹窗 */}
      {showAddEquipmentType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">添加设备类型</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设备名称 *
                </label>
                <input
                  type="text"
                  value={newEquipmentType.name}
                  onChange={(e) => setNewEquipmentType({ ...newEquipmentType, name: e.target.value })}
                  placeholder="例如: NAO机器人 V6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设备描述 *
                </label>
                <textarea
                  value={newEquipmentType.description}
                  onChange={(e) => setNewEquipmentType({ ...newEquipmentType, description: e.target.value })}
                  placeholder="简要描述设备的功能、用途、特点等"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设备图片（可选）
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // 预览图片
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewEquipmentType({ 
                          ...newEquipmentType, 
                          imageFile: file,
                          imagePreview: reader.result as string
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持格式：JPEG, PNG, GIF, WebP，最大 5MB
                </p>
              </div>

              {newEquipmentType.imagePreview && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-2">图片预览：</p>
                  <img 
                    src={newEquipmentType.imagePreview} 
                    alt="预览" 
                    className="w-32 h-32 object-cover rounded mx-auto"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!newEquipmentType.name.trim() || !newEquipmentType.description.trim()) {
                    alert('请填写设备名称和描述');
                    return;
                  }

                  try {
                    const formData = new FormData();
                    formData.append('name', newEquipmentType.name);
                    formData.append('description', newEquipmentType.description);
                    if (newEquipmentType.imageFile) {
                      formData.append('image', newEquipmentType.imageFile);
                    }
                    await equipmentTypeAPI.create(formData);
                    alert('设备类型创建成功！');
                    setShowAddEquipmentType(false);
                    setNewEquipmentType({ name: '', description: '', imageFile: null, imagePreview: '' });
                    fetchEquipmentData();
                  } catch (error: any) {
                    alert(error.response?.data?.error || '创建失败');
                  }
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                确认创建
              </button>
              <button
                onClick={() => {
                  setShowAddEquipmentType(false);
                  setNewEquipmentType({ name: '', description: '', imageFile: null, imagePreview: '' });
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量添加设备实例弹窗 */}
      {showBatchAddInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">批量添加设备实例</h3>
            
            <div className="space-y-4 mb-6">
              {!selectedTypeForBatch && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择设备类型 *
                  </label>
                  <select
                    value={selectedTypeForBatch || ''}
                    onChange={(e) => {
                      const typeId = parseInt(e.target.value);
                      setSelectedTypeForBatch(typeId);
                      const type = equipmentTypes.find(t => t.id === typeId);
                      if (type) {
                        setBatchAddForm({
                          prefix: type.name.substring(0, 3).toUpperCase(),
                          start: type.total_count + 1,
                          count: 1
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择设备类型</option>
                    {equipmentTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} (当前 {type.total_count} 个)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设备编号前缀 *
                </label>
                <input
                  type="text"
                  value={batchAddForm.prefix}
                  onChange={(e) => setBatchAddForm({ ...batchAddForm, prefix: e.target.value.toUpperCase() })}
                  placeholder="例如: NAO, CAR, RASP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">建议3-5个大写字母</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  起始编号 *
                </label>
                <input
                  type="number"
                  value={batchAddForm.start}
                  onChange={(e) => setBatchAddForm({ ...batchAddForm, start: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  创建数量 *
                </label>
                <input
                  type="number"
                  value={batchAddForm.count}
                  onChange={(e) => setBatchAddForm({ ...batchAddForm, count: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">最多一次创建100个</p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">预览编号：</span>
                  {batchAddForm.prefix}-{String(batchAddForm.start).padStart(3, '0')} 
                  {batchAddForm.count > 1 && ` ~ ${batchAddForm.prefix}-${String(batchAddForm.start + batchAddForm.count - 1).padStart(3, '0')}`}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!selectedTypeForBatch || !batchAddForm.prefix.trim()) {
                    alert('请填写完整信息');
                    return;
                  }

                  try {
                    await equipmentInstanceAPI.createBatch({
                      type_id: selectedTypeForBatch,
                      prefix: batchAddForm.prefix,
                      start: batchAddForm.start,
                      count: batchAddForm.count
                    });
                    alert(`成功创建 ${batchAddForm.count} 个设备实例`);
                    setShowBatchAddInstance(false);
                    fetchEquipmentData();
                  } catch (error: any) {
                    alert(error.response?.data?.error || '创建失败');
                  }
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                确认创建
              </button>
              <button
                onClick={() => {
                  setShowBatchAddInstance(false);
                  setSelectedTypeForBatch(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设备审批弹窗 */}
      {selectedEquipmentRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">审批借用申请</h3>
            
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-gray-500">申请人：</span>
                  <p className="font-medium">{selectedEquipmentRequest.user_name} ({selectedEquipmentRequest.student_id})</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">班级：</span>
                  <p className="font-medium">{selectedEquipmentRequest.class_name}</p>
                </div>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">设备：</span>
                <p className="font-medium">{selectedEquipmentRequest.equipment_name} ({selectedEquipmentRequest.equipment_code})</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-gray-500">借用时间：</span>
                  <p>{new Date(selectedEquipmentRequest.borrow_date).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">归还时间：</span>
                  <p>{new Date(selectedEquipmentRequest.return_date).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">借用事由：</span>
                <p className="mt-1 p-3 bg-gray-50 rounded text-sm">{selectedEquipmentRequest.reason}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                审批意见（拒绝时必填）
              </label>
              <textarea
                value={equipmentAdminComment}
                onChange={(e) => setEquipmentAdminComment(e.target.value)}
                rows={3}
                placeholder="请填写审批意见..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApproveEquipmentRequest}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                批准
              </button>
              <button
                onClick={handleRejectEquipmentRequest}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                拒绝
              </button>
              <button
                onClick={() => {
                  setSelectedEquipmentRequest(null);
                  setEquipmentAdminComment('');
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成功提示悬浮窗 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full text-center animate-fade-in">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">导入成功！</h3>
            {importResult && (
              <div className="text-gray-600 space-y-1">
                <p className="text-lg">成功导入 <span className="text-green-600 font-bold">{importResult.success}</span> 条记录</p>
                {importResult.failed > 0 && (
                  <p className="text-sm text-red-600">失败 {importResult.failed} 条</p>
                )}
              </div>
            )}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

