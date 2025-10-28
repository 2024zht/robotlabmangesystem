import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, BookOpen, Settings, LogOut, Menu, X, User, Calendar, Book, CheckCircle, MapPin, Package, Phone } from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPhoneReminder, setShowPhoneReminder] = useState(false);

  useEffect(() => {
    // 检查用户电话是否未设置，且不在个人信息页面
    if (user && user.phone === '未设置' && location.pathname !== '/profile') {
      // 延迟1秒显示提醒，避免页面刚加载就弹出
      const timer = setTimeout(() => {
        setShowPhoneReminder(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGoToProfile = () => {
    setShowPhoneReminder(false);
    navigate('/profile');
  };

  const isActive = (path: string) => location.pathname === path;

  // 非实验室成员只能看到设备借用
  const navigation = user?.isMember ? [
    { name: '积分看板', path: '/', icon: Home },
    { name: '规则展示', path: '/rules', icon: BookOpen },
    { name: '请假申请', path: '/leaves', icon: Calendar },
    { name: '点名签到', path: '/attendance', icon: MapPin },
    { name: '设备借用', path: '/equipment', icon: Package },
    { name: '电子书库', path: '/ebooks', icon: Book },
    ...(user?.isAdmin ? [
      { name: '管理面板', path: '/admin', icon: Settings },
      { name: '请假审批', path: '/admin/leave-approval', icon: CheckCircle },
    ] : []),
  ] : [
    { name: '设备借用', path: '/equipment', icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 电话号码提醒弹窗 */}
      {showPhoneReminder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  请设置您的电话号码
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  为了方便联系和设备借用管理，请完善您的电话信息。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleGoToProfile}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    立即设置
                  </button>
                  <button
                    onClick={() => setShowPhoneReminder(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    稍后提醒
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-bold text-primary-600">实验室管理系统</span>
            </div>

            {/* 桌面导航 */}
            <div className="hidden md:flex items-center space-x-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* 用户信息和登出 */}
            <div className="hidden md:flex items-center space-x-4">
              <Link 
                to="/profile"
                className="flex items-center space-x-2 text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer">
                  <span className="text-white font-bold text-sm">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-semibold">
                    {user?.username}
                    {!user?.isMember && <span className="ml-2 text-xs text-yellow-600">(访客)</span>}
                  </div>
                  {user?.isMember && <div className="text-xs text-gray-500">积分: {user?.points}</div>}
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>登出</span>
              </button>
            </div>

            {/* 移动端菜单按钮 */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 p-2"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* 用户信息 */}
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition-colors"
              >
                <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {user?.username}
                    {!user?.isMember && <span className="ml-2 text-xs text-yellow-600">(访客)</span>}
                  </div>
                  {user?.isMember && <div className="text-sm text-gray-500">积分: {user?.points}</div>}
                </div>
              </Link>

              {/* 导航链接 */}
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* 登出按钮 */}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>登出</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <p className="text-center text-xs sm:text-sm text-gray-500">
            © 2025 实验室管理系统. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

