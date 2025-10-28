import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Rules from './components/Rules';
import Admin from './components/Admin';
import LeaveRequest from './components/LeaveRequest';
import LeaveApproval from './components/LeaveApproval';
import Ebooks from './components/Ebooks';
import Attendance from './components/Attendance';
import Equipment from './components/Equipment';
import Profile from './components/Profile';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
};

// 实验室成员路由 - 非成员会被重定向到设备借用页面
const MemberRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // 非成员只能访问设备借用页面
  if (!user.isMember) {
    return <Navigate to="/equipment" />;
  }

  return children;
};

const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // 非成员重定向到设备借用页面，成员重定向到首页
  if (user) {
    return user.isMember ? <Navigate to="/" /> : <Navigate to="/equipment" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<MemberRoute><Dashboard /></MemberRoute>} />
            <Route path="rules" element={<MemberRoute><Rules /></MemberRoute>} />
            <Route path="leaves" element={<MemberRoute><LeaveRequest /></MemberRoute>} />
            <Route path="ebooks" element={<MemberRoute><Ebooks /></MemberRoute>} />
            <Route path="attendance" element={<MemberRoute><Attendance /></MemberRoute>} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="admin/leave-approval" element={<AdminRoute><LeaveApproval /></AdminRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

