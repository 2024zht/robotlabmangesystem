import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { User, Mail, Phone, Book, Lock, Save, X } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // 个人信息表单
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [className, setClassName] = useState(user?.className || '');
  
  // 密码修改表单
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateProfile = async () => {
    if (!phone || phone.trim() === '' || phone === '未设置') {
      setError('请输入有效的电话号码');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await userAPI.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        className: className.trim()
      });
      await refreshUser();
      setSuccess('个人信息更新成功！');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写所有密码字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少为6个字符');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await userAPI.updatePassword(currentPassword, newPassword);
      setSuccess('密码修改成功！');
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setClassName(user?.className || '');
    setEditing(false);
    setError('');
  };

  const handleCancelPasswordChange = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangingPassword(false);
    setError('');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">个人信息</h1>

        {/* 成功提示 */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 电话未设置警告 */}
        {user?.phone === '未设置' && !editing && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">请设置您的电话号码</p>
                <p className="text-sm text-yellow-700 mt-1">
                  为了方便联系，请完善您的电话信息。
                </p>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-2 text-sm text-yellow-800 hover:text-yellow-900 font-medium underline"
                >
                  立即设置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 个人信息卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">基本信息</h2>
            {!editing && !changingPassword && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                编辑信息
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  班级
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  电话号码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入电话号码"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {loading ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">用户名</p>
                  <p className="font-medium text-gray-900">{user?.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">姓名</p>
                  <p className="font-medium text-gray-900">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Book className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">学号</p>
                  <p className="font-medium text-gray-900">{user?.studentId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Book className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">班级</p>
                  <p className="font-medium text-gray-900">{user?.className}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Book className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">年级</p>
                  <p className="font-medium text-gray-900">{user?.grade}级</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">邮箱</p>
                  <p className="font-medium text-gray-900">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">电话号码</p>
                  <p className={`font-medium ${user?.phone === '未设置' ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {user?.phone}
                  </p>
                </div>
              </div>

              {user?.isMember && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">积分</p>
                    <p className="font-medium text-gray-900">{user?.points}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 密码修改卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">安全设置</h2>
            {!changingPassword && !editing && (
              <button
                onClick={() => setChangingPassword(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                修改密码
              </button>
            )}
          </div>

          {changingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  当前密码
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入当前密码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="至少6个字符"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="再次输入新密码"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? '修改中...' : '确认修改'}
                </button>
                <button
                  onClick={handleCancelPasswordChange}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">
              <p className="text-sm">点击上方"修改密码"按钮来更新您的登录密码。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

