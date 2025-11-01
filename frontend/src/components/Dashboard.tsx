import React, { useState, useEffect } from 'react';
import { User, Rule, PointLog } from '../types';
import { userAPI, ruleAPI } from '../services/api';
import { Trophy, Medal, Award, TrendingUp, Edit2, X, History, AlertCircle, Undo2, Plus, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<number | null>(null);
  const [customPoints, setCustomPoints] = useState('');
  const [customReason, setCustomReason] = useState('');
  const { user: currentUser } = useAuth();

  // 积分历史相关
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 提交异议相关
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestPoints, setRequestPoints] = useState('');
  const [requestReason, setRequestReason] = useState('');

  // 积分管理弹窗相关
  const [showPointManageModal, setShowPointManageModal] = useState(false);
  const [manageUser, setManageUser] = useState<User | null>(null);
  const [managePointLogs, setManagePointLogs] = useState<PointLog[]>([]);
  const [loadingManageLogs, setLoadingManageLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'modify' | 'password'>('history');
  
  // 密码修改相关
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rulesRes] = await Promise.all([
        userAPI.getAll(),
        ruleAPI.getAll()
      ]);
      setUsers(usersRes.data);
      setRules(rulesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleOpenPointManageModal = async (user: User) => {
    setManageUser(user);
    setShowPointManageModal(true);
    setActiveTab('history');
    setLoadingManageLogs(true);

    try {
      const { data } = await userAPI.getLogs(user.id);
      setManagePointLogs(data);
    } catch (error) {
      console.error('Failed to fetch manage logs:', error);
      alert('获取积分记录失败');
    } finally {
      setLoadingManageLogs(false);
    }
  };

  const handleClosePointManageModal = () => {
    setShowPointManageModal(false);
    setManageUser(null);
    setManagePointLogs([]);
    setActiveTab('history');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleRevertPointLog = async (logId: number) => {
    if (!confirm('确定要撤销这条积分记录吗？此操作不可恢复。')) {
      return;
    }

    try {
      await userAPI.revertPointLog(logId);
      alert('积分记录已撤销');
      
      // 重新获取积分记录
      if (manageUser) {
        const { data } = await userAPI.getLogs(manageUser.id);
        setManagePointLogs(data);
      }
      
      // 刷新用户列表
      fetchData();
    } catch (error) {
      console.error('Failed to revert point log:', error);
      alert('撤销失败');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert('请填写完整信息');
      return;
    }

    if (newPassword.length < 6) {
      alert('密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    if (!manageUser) return;

    try {
      await userAPI.updateUserPassword(manageUser.id, newPassword);
      alert('密码修改成功');
      
      // 重置表单
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('history');
    } catch (error) {
      console.error('Failed to update password:', error);
      alert('密码修改失败');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setSelectedRule(null);
    setCustomPoints('');
    setCustomReason('');
  };

  const handleApplyRule = async () => {
    const targetUser = selectedUser || manageUser;
    if (!targetUser) return;

    let points = 0;
    let reason = '';

    if (selectedRule !== null) {
      const rule = rules.find(r => r.id === selectedRule);
      if (rule) {
        points = rule.points;
        reason = rule.name;
      }
    } else if (customPoints && customReason) {
      points = parseInt(customPoints);
      reason = customReason;
    } else {
      alert('请选择规则或输入自定义积分');
      return;
    }

    // 验证单次积分修改不超过200分（正负）
    if (Math.abs(points) > 200) {
      alert('单次积分修改不能超过200分（加分或扣分）');
      return;
    }

    try {
      await userAPI.updatePoints(targetUser.id, points, reason);
      alert('积分修改成功');
      
      // 关闭相应的弹窗
      if (selectedUser) {
        handleCloseModal();
      }
      if (manageUser) {
        // 重新获取积分记录
        const { data } = await userAPI.getLogs(manageUser.id);
        setManagePointLogs(data);
        // 重置表单
        setSelectedRule(null);
        setCustomPoints('');
        setCustomReason('');
      }
      
      fetchData();
    } catch (error) {
      alert('积分修改失败');
    }
  };

  const handleRowClick = async (user: User, e: React.MouseEvent) => {
    // 如果点击的是按钮，不触发行点击
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    // 权限检查：只有管理员或本人可以查看积分历史
    if (!currentUser?.isAdmin && currentUser?.id !== user.id) {
      alert('您只能查看自己的积分历史');
      return;
    }

    setHistoryUser(user);
    setShowHistoryModal(true);
    setLoadingLogs(true);

    try {
      const { data } = await userAPI.getLogs(user.id);
      setPointLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      alert('获取积分历史失败');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryUser(null);
    setPointLogs([]);
  };

  const handleOpenRequestModal = () => {
    setShowHistoryModal(false);
    setShowRequestModal(true);
  };

  const handleCloseRequestModal = () => {
    setShowRequestModal(false);
    setRequestPoints('');
    setRequestReason('');
  };

  const handleSubmitRequest = async () => {
    if (!requestPoints || !requestReason) {
      alert('请填写完整信息');
      return;
    }

    try {
      await userAPI.submitRequest(parseInt(requestPoints), requestReason);
      alert('异议已提交，等待管理员处理');
      handleCloseRequestModal();
      // 重新打开历史记录
      if (historyUser) {
        setShowHistoryModal(true);
      }
    } catch (error) {
      alert('提交失败');
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-500">#{index + 1}</span>;
    }
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
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">积分排行榜</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排名
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  姓名
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  学号
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  班级
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  积分
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  角色
                </th>
                {currentUser?.isAdmin && (
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user, index) => (
                <tr 
                  key={user.id} 
                  className={`${index < 3 ? 'bg-primary-50' : ''} cursor-pointer hover:bg-gray-50 transition-colors`}
                  onClick={(e) => handleRowClick(user, e)}
                  title="点击查看积分历史"
                >
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center w-8 sm:w-10">
                      {getRankIcon(index)}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 bg-primary-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm sm:text-base">
                          {user.name?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name || user.username}</div>
                        <div className="text-xs text-gray-500">{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <div className="text-sm text-gray-900">{user.studentId}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="text-sm text-gray-500">{user.className}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 sm:px-3 py-1 inline-flex text-xs sm:text-sm leading-5 font-semibold rounded-full ${
                      user.points > 0 ? 'bg-green-100 text-green-800' : 
                      user.points < 0 ? 'bg-red-100 text-red-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.points}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    {user.isAdmin && (
                      <span className="px-2 sm:px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        管理员
                      </span>
                    )}
                  </td>
                  {currentUser?.isAdmin && (
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenPointManageModal(user)}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        title="积分管理"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">积分管理</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-8 sm:py-12 text-gray-500">
            暂无用户数据
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg shadow-md p-4 sm:p-6 text-white">
        <h3 className="text-lg sm:text-xl font-semibold mb-2">系统统计</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">{users.length}</div>
            <div className="text-xs sm:text-sm opacity-90">总成员数</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">
              {users.reduce((sum, user) => sum + user.points, 0)}
            </div>
            <div className="text-xs sm:text-sm opacity-90">总积分</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">
              {users.length > 0 ? Math.round(users.reduce((sum, user) => sum + user.points, 0) / users.length) : 0}
            </div>
            <div className="text-xs sm:text-sm opacity-90">平均积分</div>
          </div>
        </div>
      </div>

      {/* 修改积分悬浮窗 */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                修改积分 - {selectedUser.name} ({selectedUser.studentId})
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                当前积分: <strong className="text-lg">{selectedUser.points}</strong>
              </p>
            </div>

            {/* 规则选择 */}
            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-lg">选择规则</h4>
              
              {/* 加分规则 */}
              <div className="mb-4">
                <p className="text-sm text-green-700 font-medium mb-2">加分规则</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rules.filter(r => r.points > 0).map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => {
                        setSelectedRule(rule.id);
                        setCustomPoints('');
                        setCustomReason('');
                      }}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        selectedRule === rule.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{rule.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                        </div>
                        <span className="ml-2 px-2 py-1 bg-green-500 text-white rounded text-sm font-bold">
                          +{rule.points}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 扣分规则 */}
              <div className="mb-4">
                <p className="text-sm text-red-700 font-medium mb-2">扣分规则</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rules.filter(r => r.points < 0).map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => {
                        setSelectedRule(rule.id);
                        setCustomPoints('');
                        setCustomReason('');
                      }}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        selectedRule === rule.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{rule.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                        </div>
                        <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm font-bold">
                          {rule.points}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义积分 */}
              <div className="mt-4 p-4 border-2 border-gray-300 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-3">或自定义积分</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      积分值（正数加分，负数扣分）
                    </label>
                    <input
                      type="number"
                      value={customPoints}
                      onChange={(e) => {
                        setCustomPoints(e.target.value);
                        setSelectedRule(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 10 或 -5"
                      min="-200"
                      max="200"
                    />
                    <p className="text-xs text-gray-500 mt-1">⚠️ 单次积分修改范围：-200 ~ +200</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      原因
                    </label>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => {
                        setCustomReason(e.target.value);
                        setSelectedRule(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入修改原因"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-3">
              <button
                onClick={handleApplyRule}
                disabled={!selectedRule && (!customPoints || !customReason)}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                确认修改
              </button>
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 积分历史悬浮窗 */}
      {showHistoryModal && historyUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <History className="h-6 w-6 mr-2 text-blue-600" />
                积分变更历史 - {historyUser.name} ({historyUser.studentId})
              </h3>
              <button
                onClick={handleCloseHistoryModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">当前积分</p>
                  <p className="text-2xl font-bold text-blue-600">{historyUser.points}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">班级</p>
                  <p className="text-lg font-semibold text-gray-800">{historyUser.className}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">学号</p>
                  <p className="text-lg font-semibold text-gray-800">{historyUser.studentId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">变更记录</p>
                  <p className="text-lg font-semibold text-gray-800">{pointLogs.length} 条</p>
                </div>
              </div>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pointLogs.length > 0 ? (
              <div className="space-y-3">
                {pointLogs.map((log) => (
                  <div 
                    key={log.id}
                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            log.points > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.points > 0 ? '+' : ''}{log.points}
                          </span>
                          <span className="text-gray-700 font-medium">{log.reason}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span>👤 操作者: {log.createdByUsername}</span>
                          <span>📅 {new Date(log.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无积分变更记录
              </div>
            )}

            <div className="mt-6 flex space-x-3">
              {currentUser?.id === historyUser.id && (
                <button
                  onClick={handleOpenRequestModal}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center"
                >
                  <AlertCircle className="h-5 w-5 mr-2" />
                  提交异议
                </button>
              )}
              <button
                onClick={handleCloseHistoryModal}
                className={`${currentUser?.id === historyUser.id ? '' : 'flex-1'} px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium`}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提交异议悬浮窗 */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <AlertCircle className="h-6 w-6 mr-2 text-orange-600" />
                提交积分异议
              </h3>
              <button
                onClick={handleCloseRequestModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 如果您对某次积分变更有异议，可以通过此功能向管理员申请修改。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  申请调整积分（正数加分，负数扣分）
                </label>
                <input
                  type="number"
                  value={requestPoints}
                  onChange={(e) => setRequestPoints(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="例如: 10 或 -5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  异议理由
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={4}
                  placeholder="请详细说明您的异议原因..."
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleSubmitRequest}
                disabled={!requestPoints || !requestReason}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                提交异议
              </button>
              <button
                onClick={handleCloseRequestModal}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 积分管理弹窗 */}
      {showPointManageModal && manageUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center">
                <Edit2 className="h-6 w-6 mr-2 text-blue-600" />
                积分管理 - {manageUser.name} ({manageUser.studentId})
              </h3>
              <button
                onClick={handleClosePointManageModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">当前积分</p>
                  <p className="text-2xl font-bold text-blue-600">{manageUser.points}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">班级</p>
                  <p className="text-lg font-semibold text-gray-800">{manageUser.className}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">学号</p>
                  <p className="text-lg font-semibold text-gray-800">{manageUser.studentId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">变更记录</p>
                  <p className="text-lg font-semibold text-gray-800">{managePointLogs.length} 条</p>
                </div>
              </div>
            </div>

            {/* 标签页 */}
            <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <History className="h-4 w-4 inline mr-2" />
                积分历史
              </button>
              <button
                onClick={() => setActiveTab('modify')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'modify'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Plus className="h-4 w-4 inline mr-2" />
                修改积分
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'password'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Key className="h-4 w-4 inline mr-2" />
                修改密码
              </button>
            </div>

            {/* 积分历史标签页 */}
            {activeTab === 'history' && (
              <div>
                {loadingManageLogs ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : managePointLogs.length > 0 ? (
                  <div className="space-y-3">
                    {managePointLogs.map((log) => (
                      <div 
                        key={log.id}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                log.points > 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.points > 0 ? '+' : ''}{log.points}
                              </span>
                              <span className="text-gray-700 font-medium">{log.reason}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                              <span>👤 操作者: {log.createdByUsername}</span>
                              <span>📅 {new Date(log.createdAt).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevertPointLog(log.id)}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="撤销此记录"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无积分变更记录
                  </div>
                )}
              </div>
            )}

            {/* 修改积分标签页 */}
            {activeTab === 'modify' && (
              <div>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    当前积分: <strong className="text-lg">{manageUser.points}</strong>
                  </p>
                </div>

                {/* 规则选择 */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-lg">选择规则</h4>
                  
                  {/* 加分规则 */}
                  <div className="mb-4">
                    <p className="text-sm text-green-700 font-medium mb-2">加分规则</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rules.filter(r => r.points > 0).map(rule => (
                        <button
                          key={rule.id}
                          onClick={() => {
                            setSelectedRule(rule.id);
                            setCustomPoints('');
                            setCustomReason('');
                          }}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            selectedRule === rule.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{rule.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                            </div>
                            <span className="ml-2 px-2 py-1 bg-green-500 text-white rounded text-sm font-bold">
                              +{rule.points}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 扣分规则 */}
                  <div className="mb-4">
                    <p className="text-sm text-red-700 font-medium mb-2">扣分规则</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rules.filter(r => r.points < 0).map(rule => (
                        <button
                          key={rule.id}
                          onClick={() => {
                            setSelectedRule(rule.id);
                            setCustomPoints('');
                            setCustomReason('');
                          }}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            selectedRule === rule.id
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 hover:border-red-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{rule.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                            </div>
                            <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm font-bold">
                              {rule.points}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 自定义积分 */}
                  <div className="mt-4 p-4 border-2 border-gray-300 rounded-lg">
                    <p className="text-sm text-gray-700 font-medium mb-3">或自定义积分</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          积分值（正数加分，负数扣分）
                        </label>
                        <input
                          type="number"
                          value={customPoints}
                          onChange={(e) => {
                            setCustomPoints(e.target.value);
                            setSelectedRule(null);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="例如: 10 或 -5"
                          min="-200"
                          max="200"
                        />
                        <p className="text-xs text-gray-500 mt-1">⚠️ 单次积分修改范围：-200 ~ +200</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          原因
                        </label>
                        <input
                          type="text"
                          value={customReason}
                          onChange={(e) => {
                            setCustomReason(e.target.value);
                            setSelectedRule(null);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="请输入修改原因"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleApplyRule}
                    disabled={!selectedRule && (!customPoints || !customReason)}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    确认修改
                  </button>
                  <button
                    onClick={handleClosePointManageModal}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 修改密码标签页 */}
            {activeTab === 'password' && (
              <div>
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 修改用户密码后，用户需要使用新密码重新登录。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      新密码
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入新密码（至少6位）"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="请再次输入新密码"
                    />
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={handleUpdatePassword}
                    disabled={!newPassword || !confirmPassword}
                    className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    确认修改密码
                  </button>
                  <button
                    onClick={handleClosePointManageModal}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

