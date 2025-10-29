import React, { useState, useEffect } from 'react';
import { attendanceAPI } from '../services/api';
import { Attendance, DailyAttendanceTrigger } from '../types';
import { MapPin, Clock, CheckCircle, XCircle, Calendar, AlertCircle, Navigation } from 'lucide-react';

const AttendancePage: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [locationError, setLocationError] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    fetchAttendances();
  }, []);

  // 获取当前位置（用于调试和设置目标坐标）
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理定位');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        console.log('📍 当前GPS位置 (WGS84):', {
          纬度: latitude,
          经度: longitude,
          精度: accuracy + '米',
          时间: new Date().toLocaleString('zh-CN')
        });
        alert(`当前GPS坐标已获取！\n\n纬度: ${latitude}\n经度: ${longitude}\n精度: ${Math.round(accuracy)}米\n\n请复制这些坐标设置为点名目标位置`);
      },
      (error) => {
        console.error('获取位置失败:', error);
        alert('获取位置失败，请确保已开启定位权限');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getAll();
      setAttendances(response.data);
    } catch (error) {
      console.error('获取点名列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (triggerId: number) => {
    setSigning(true);
    setLocationError('');

    try {
      // 使用浏览器原生定位（返回WGS84坐标，与后端一致）
      if (!navigator.geolocation) {
        setLocationError('您的浏览器不支持地理定位');
        setSigning(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            
            // 输出地理位置信息用于调试
            console.log('🗺️ 用户签到位置信息（原生GPS WGS84）:', {
              纬度: latitude,
              经度: longitude,
              精度: accuracy + '米',
              时间: new Date().toLocaleString('zh-CN')
            });

            await attendanceAPI.sign(triggerId, latitude, longitude);
            alert('签到成功！');
            fetchAttendances();
          } catch (error: any) {
            if (error.response?.data?.error) {
              setLocationError(error.response.data.error);
              if (error.response.data.distance) {
                setLocationError(
                  `${error.response.data.error}\n当前距离：${error.response.data.distance}米，要求：${error.response.data.required}米内`
                );
              }
            } else {
              setLocationError('签到失败，请稍后重试');
            }
          } finally {
            setSigning(false);
          }
        },
        (error) => {
          setSigning(false);
          console.error('GPS定位失败:', error);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError('⚠️ 位置权限被拒绝\n\n请按以下步骤开启：\n1. 点击地址栏左侧的🔒图标\n2. 找到"位置"权限设置为"允许"\n3. 刷新页面重试\n\n如果是手机：请在系统设置中允许浏览器访问位置');
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError('❌ 无法获取您的位置信息\n\n可能原因：\n• GPS信号弱（建议到室外或窗边）\n• 定位服务未开启\n• 网络连接问题');
              break;
            case error.TIMEOUT:
              setLocationError('⏱️ 获取位置信息超时\n\n请检查：\n• GPS/定位是否开启\n• 是否在室内深处（建议到窗边）\n• 稍后重试');
              break;
            default:
              setLocationError('获取位置时发生未知错误，请稍后重试');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } catch (error) {
      console.error('定位异常:', error);
      setSigning(false);
      setLocationError('签到失败，请稍后重试');
    }
  };

  // 获取今天的触发记录
  const getTodayTrigger = (attendance: Attendance): DailyAttendanceTrigger | null => {
    if (!attendance.triggers || attendance.triggers.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    return attendance.triggers.find(t => t.triggerDate === today) || null;
  };

  const getStatusBadge = (trigger: DailyAttendanceTrigger | null) => {
    if (!trigger) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">未触发</span>;
    }

    if (trigger.hasSigned) {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
          <CheckCircle className="h-3 w-3 mr-1" />
          已签到
        </span>
      );
    } else if (trigger.completed) {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
          <XCircle className="h-3 w-3 mr-1" />
          已结束
        </span>
      );
    } else if (trigger.notificationSent) {
      return (
        <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded font-medium">
          <Clock className="h-3 w-3 mr-1" />
          签到中
        </span>
      );
    } else {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">未开始</span>;
    }
  };

  const canSign = (trigger: DailyAttendanceTrigger | null) => {
    if (!trigger) return false;
    return !trigger.hasSigned && !trigger.completed && trigger.notificationSent;
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
        <h2 className="text-2xl font-bold text-gray-800">点名签到</h2>
        <button
          onClick={getCurrentLocation}
          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition flex items-center"
          title="获取当前GPS坐标（用于设置点名目标位置）"
        >
          <Navigation className="h-4 w-4 mr-2" />
          获取当前坐标
        </button>
      </div>

      {currentLocation && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-medium text-purple-800 mb-2">📍 当前GPS坐标 (WGS84标准)</h3>
          <div className="text-sm text-purple-700 space-y-1">
            <p>纬度: <code className="bg-purple-100 px-2 py-1 rounded">{currentLocation.lat}</code></p>
            <p>经度: <code className="bg-purple-100 px-2 py-1 rounded">{currentLocation.lng}</code></p>
            <p className="text-xs text-purple-600 mt-2">💡 复制这些坐标到点名管理中设置为目标位置</p>
          </div>
        </div>
      )}

      {locationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">签到失败</h3>
            <p className="text-sm text-red-700 whitespace-pre-line mt-1">{locationError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attendances.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            暂无点名任务
          </div>
        ) : (
          attendances.map((attendance) => {
            const todayTrigger = getTodayTrigger(attendance);
            const today = new Date().toISOString().split('T')[0];
            const isActive = attendance.dateStart <= today && attendance.dateEnd >= today;

            return (
              <div
                key={attendance.id}
                className={`bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition ${
                  todayTrigger?.hasSigned ? 'border-2 border-green-200' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-800">{attendance.name}</h3>
                  {getStatusBadge(todayTrigger)}
                </div>

                {attendance.description && (
                  <p className="text-sm text-gray-600 mb-3">{attendance.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    任务期间：{attendance.dateStart} 至 {attendance.dateEnd}
                  </div>
                  {todayTrigger && (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-orange-600" />
                      今日触发时间：{todayTrigger.triggerTime}（1分钟内签到）
                    </div>
                  )}
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-green-600" />
                    {attendance.locationName}
                  </div>
                  <div className="text-xs text-gray-500">
                    要求：距离指定地点 {attendance.radius} 米内
                  </div>
                </div>

                {todayTrigger?.hasSigned && todayTrigger.signedAt && (
                  <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-700">
                    签到时间：{new Date(todayTrigger.signedAt).toLocaleString('zh-CN')}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t">
                  {canSign(todayTrigger) && todayTrigger ? (
                    <button
                      onClick={() => handleSign(todayTrigger.id)}
                      disabled={signing}
                      className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      {signing ? '定位中...' : '立即签到'}
                    </button>
                  ) : todayTrigger?.hasSigned ? (
                    <div className="text-center text-sm text-green-600 font-medium">
                      ✓ 今日已完成签到
                    </div>
                  ) : todayTrigger?.completed ? (
                    <div className="text-center text-sm text-gray-500">
                      今日点名已结束
                    </div>
                  ) : isActive ? (
                    <div className="text-center text-sm text-gray-500">
                      今日签到尚未开始（晚上9:15-9:25随机触发）
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      任务不在有效期内
                    </div>
                  )}
                </div>

                {todayTrigger && !todayTrigger.hasSigned && !todayTrigger.completed && (
                  <div className="mt-2 text-xs text-orange-600 text-center">
                    未签到将扣除 {attendance.penaltyPoints} 分
                  </div>
                )}

                {/* 显示历史记录摘要 */}
                {attendance.triggers && attendance.triggers.length > 0 && (
                  <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                    已触发 {attendance.totalTriggers || attendance.triggers.length} 次，
                    已签到 {attendance.triggers.filter(t => t.hasSigned).length} 次
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

export default AttendancePage;

