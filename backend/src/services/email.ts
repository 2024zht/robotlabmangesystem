import nodemailer from 'nodemailer';
import { db } from '../database/db';

// 创建邮件发送器（延迟创建，确保环境变量已加载）
const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER || 'roboticlab@qq.com';
  const emailPass = process.env.EMAIL_PASS || 'ghujiouvebmdcieh';
  
  console.log(`Creating email transporter with user: ${emailUser}`);
  
  return nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

// 发送邮件的通用函数
export const sendEmail = async (
  to: string | string[],
  subject: string,
  html: string
): Promise<void> => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    console.log(`Attempting to send email to ${to}`);
    console.log(`Email config - USER: ${emailUser ? 'SET' : 'NOT SET'}, PASS: ${emailPass ? 'SET' : 'NOT SET'}`);
    
    // 检查邮件配置是否有效
    if (!emailUser || !emailPass) {
      console.warn('⚠️ Email configuration not found in environment variables, skipping email sending');
      console.warn('Please set EMAIL_USER and EMAIL_PASS in .env file');
      return;
    }

    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"实验室管理系统" <${emailUser}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
    };

    console.log(`Sending email with subject: ${subject}`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    // 不抛出错误，避免影响主流程
    console.warn('Email feature is currently unavailable. Please check your email configuration.');
  }
};

// 发送请假申请通知给所有管理员
export const sendLeaveApplicationNotification = async (
  applicantName: string,
  studentId: string,
  leaveType: string,
  startTime: string,
  endTime: string,
  duration: string,
  reason: string,
  leaveId: number
): Promise<void> => {
  // 从数据库获取所有管理员的邮箱
  const adminEmails = await new Promise<string[]>((resolve, reject) => {
    db.all('SELECT email FROM users WHERE isAdmin = 1', (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.email));
    });
  });

  if (adminEmails.length === 0) {
    console.warn('No admin emails found, skipping notification');
    return;
  }

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:2111';
  
  const subject = `【请假申请提醒】用户 ${applicantName} 提交了新的请假申请`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">新的请假申请待审批</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>申请人姓名：</strong>${applicantName}</p>
        <p><strong>学号/ID：</strong>${studentId}</p>
        <p><strong>请假类型：</strong>${leaveType}</p>
        <p><strong>请假时间：</strong>${startTime} 至 ${endTime}</p>
        <p><strong>请假时长：</strong>${duration}</p>
        <p><strong>请假事由：</strong>${reason}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${baseUrl}/admin/leave-approval" 
           style="background-color: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          立即审批
        </a>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  // 发送给所有管理员
  await sendEmail(adminEmails, subject, html);
  console.log(`Leave application notification sent to ${adminEmails.length} admin(s)`);
};

// 发送审批结果通知给申请人
export const sendLeaveApprovalNotification = async (
  applicantEmail: string,
  applicantName: string,
  leaveType: string,
  startTime: string,
  endTime: string,
  reason: string,
  status: 'approved' | 'rejected',
  rejectReason?: string
): Promise<void> => {
  const statusText = status === 'approved' ? '已批准' : '已驳回';
  const statusColor = status === 'approved' ? '#10b981' : '#ef4444';
  
  const subject = `【审批结果通知】您的请假申请已处理`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">请假申请审批结果</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>申请人：</strong>${applicantName}</p>
        <p><strong>请假类型：</strong>${leaveType}</p>
        <p><strong>请假时间：</strong>${startTime} 至 ${endTime}</p>
        <p><strong>请假事由：</strong>${reason}</p>
        <div style="margin-top: 20px; padding: 15px; background-color: white; border-left: 4px solid ${statusColor}; border-radius: 4px;">
          <p style="margin: 0;"><strong>审批结果：</strong><span style="color: ${statusColor}; font-size: 18px; font-weight: bold;">${statusText}</span></p>
          ${rejectReason ? `<p style="margin-top: 10px;"><strong>审批意见：</strong>${rejectReason}</p>` : ''}
        </div>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  await sendEmail(applicantEmail, subject, html);
};

// 发送点名通知
export const sendAttendanceNotification = async (
  userEmails: string[],
  attendanceName: string,
  deadline: string,
  locationName: string,
  latitude: number,
  longitude: number,
  radius: number
): Promise<void> => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:2111';
  
  const subject = `【点名提醒】${attendanceName} 已经开始`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">点名签到提醒</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>点名主题：</strong>${attendanceName}</p>
        <p><strong>签到截止时间：</strong><span style="color: #dc2626; font-weight: bold;">${deadline}</span></p>
        <p><strong>签到地点要求：</strong>${locationName}</p>
        <p><strong>签到范围：</strong>距离指定地点 ${radius} 米内</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
          坐标：${latitude}, ${longitude}
        </p>
      </div>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>重要提示：</strong>请确保您在指定地点范围内进行签到，否则签到将无效。未签到者将自动扣除相应积分。
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${baseUrl}/attendance" 
           style="background-color: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          立即签到
        </a>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  await sendEmail(userEmails, subject, html);
};

// 发送异议提交通知给管理员
export const sendPointRequestSubmitNotification = async (
  applicantName: string,
  studentId: string,
  points: number,
  reason: string,
  requestId: number
): Promise<void> => {
  // 从数据库获取所有管理员的邮箱
  const adminEmails = await new Promise<string[]>((resolve, reject) => {
    db.all('SELECT email FROM users WHERE isAdmin = 1', (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.email));
    });
  });

  if (adminEmails.length === 0) {
    console.warn('No admin emails found, skipping notification');
    return;
  }

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:2111';
  
  const subject = `【积分异议提醒】用户 ${applicantName} 提交了新的积分异议`;
  
  const pointsColor = points > 0 ? '#10b981' : '#ef4444';
  const pointsText = points > 0 ? `+${points}` : `${points}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">新的积分异议待处理</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>申请人姓名：</strong>${applicantName}</p>
        <p><strong>学号/ID：</strong>${studentId}</p>
        <p><strong>申请调整积分：</strong><span style="color: ${pointsColor}; font-weight: bold; font-size: 18px;">${pointsText} 分</span></p>
        <p><strong>异议理由：</strong>${reason}</p>
      </div>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>提示：</strong>请及时处理用户的积分异议申请。
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${baseUrl}/admin?tab=requests" 
           style="background-color: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          立即处理
        </a>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  await sendEmail(adminEmails, subject, html);
  console.log(`Point request submit notification sent to ${adminEmails.length} admin(s)`);
};

// 发送异议处理结果通知
export const sendPointRequestNotification = async (
  userEmail: string,
  userName: string,
  points: number,
  reason: string,
  status: 'approved' | 'rejected',
  adminComment?: string
): Promise<void> => {
  const statusText = status === 'approved' ? '已批准' : '已拒绝';
  const statusColor = status === 'approved' ? '#10b981' : '#ef4444';
  
  const subject = `【异议处理结果】您的积分异议申请已处理`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">积分异议处理结果</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>申请人：</strong>${userName}</p>
        <p><strong>申请积分：</strong><span style="color: ${points > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">${points > 0 ? '+' : ''}${points} 分</span></p>
        <p><strong>申请理由：</strong>${reason}</p>
        <div style="margin-top: 20px; padding: 15px; background-color: white; border-left: 4px solid ${statusColor}; border-radius: 4px;">
          <p style="margin: 0;"><strong>处理结果：</strong><span style="color: ${statusColor}; font-size: 18px; font-weight: bold;">${statusText}</span></p>
          ${adminComment ? `<p style="margin-top: 10px;"><strong>管理员备注：</strong>${adminComment}</p>` : ''}
        </div>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  await sendEmail(userEmail, subject, html);
};

// ==================== 设备借用相关邮件 ====================

// 发送设备借用申请通知给所有管理员
export const sendEquipmentRequestEmail = async (
  data: {
    applicantName: string;
    studentId: string;
    className: string;
    equipmentName: string;
    equipmentCode: string;
    borrowDate: string;
    returnDate: string;
    reason: string;
    requestId: number;
  }
): Promise<void> => {
  // 从数据库获取所有管理员的邮箱
  const adminEmails = await new Promise<string[]>((resolve, reject) => {
    db.all('SELECT email FROM users WHERE isAdmin = 1', (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.email));
    });
  });

  if (adminEmails.length === 0) {
    console.warn('No admin emails found, skipping equipment request notification');
    return;
  }

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:2111';
  
  const subject = `【设备借用】新的借用申请待审批 - ${data.equipmentName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">📦 新的设备借用申请</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          管理员您好，
        </p>
        <p style="font-size: 16px; margin-bottom: 20px;">
          <strong>${data.applicantName}</strong> 提交了一个新的设备借用申请，请登录系统处理。
        </p>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">📋 申请人信息</h3>
          <p><strong>姓名：</strong>${data.applicantName}</p>
          <p><strong>学号：</strong>${data.studentId}</p>
          <p><strong>班级：</strong>${data.className}</p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">🔧 设备信息</h3>
          <p><strong>设备名称：</strong>${data.equipmentName}</p>
          <p><strong>设备编号：</strong><span style="color: #059669; font-weight: bold;">${data.equipmentCode}</span></p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">📅 借用信息</h3>
          <p><strong>借用时间：</strong>${new Date(data.borrowDate).toLocaleString('zh-CN')}</p>
          <p><strong>归还时间：</strong>${new Date(data.returnDate).toLocaleString('zh-CN')}</p>
          <p><strong>借用事由：</strong></p>
          <div style="background-color: #f9fafb; padding: 10px; border-left: 3px solid #3b82f6; margin-top: 5px;">
            ${data.reason}
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${baseUrl}/admin?tab=equipment" 
           style="background-color: #1e40af; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
          立即审批
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;
  
  await sendEmail(adminEmails, subject, html);
  console.log(`Equipment request notification sent to ${adminEmails.length} admin(s)`);
};

// 发送借用申请批准通知给申请人
export const sendEquipmentApprovalEmail = (
  userEmail: string,
  data: {
    userName: string;
    equipmentName: string;
    equipmentCode: string;
    borrowDate: string;
    returnDate: string;
    approverName: string;
    adminComment?: string;
  }
): void => {
  const subject = `【设备借用】您的借用申请已批准 ✅`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">✅ 借用申请已批准</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          ${data.userName} 同学您好，
        </p>
        <p style="font-size: 16px; margin-bottom: 20px;">
          您的设备借用申请已经通过审批，请按时借用和归还设备。
        </p>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #10b981; margin-top: 0;">🔧 设备信息</h3>
          <p><strong>设备名称：</strong>${data.equipmentName}</p>
          <p><strong>设备编号：</strong><span style="color: #059669; font-weight: bold;">${data.equipmentCode}</span></p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">📅 借用时间</h3>
          <p><strong>借用时间：</strong>${new Date(data.borrowDate).toLocaleString('zh-CN')}</p>
          <p><strong>归还时间：</strong><span style="color: #dc2626; font-weight: bold;">${new Date(data.returnDate).toLocaleString('zh-CN')}</span></p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>审批人：</strong>${data.approverName}</p>
          ${data.adminComment ? `<p><strong>备注：</strong>${data.adminComment}</p>` : ''}
        </div>
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>温馨提示：</strong><br/>
          • 请妥善保管设备，如有损坏请及时报告<br/>
          • 请按时归还设备，避免影响其他同学使用<br/>
          • 借用期间设备由您负责
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;
  
  sendEmail(userEmail, subject, html);
};

// 发送借用申请拒绝通知给申请人
export const sendEquipmentRejectionEmail = (
  userEmail: string,
  data: {
    userName: string;
    equipmentName: string;
    equipmentCode: string;
    borrowDate: string;
    returnDate: string;
    rejectionReason: string;
    approverName: string;
  }
): void => {
  const subject = `【设备借用】您的借用申请未通过 ❌`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ef4444;">❌ 借用申请未通过</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          ${data.userName} 同学您好，
        </p>
        <p style="font-size: 16px; margin-bottom: 20px;">
          很抱歉，您的设备借用申请未通过审批。
        </p>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">🔧 申请信息</h3>
          <p><strong>设备名称：</strong>${data.equipmentName}</p>
          <p><strong>设备编号：</strong>${data.equipmentCode}</p>
          <p><strong>借用时间：</strong>${new Date(data.borrowDate).toLocaleString('zh-CN')}</p>
          <p><strong>归还时间：</strong>${new Date(data.returnDate).toLocaleString('zh-CN')}</p>
        </div>
        
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #dc2626; margin-top: 0;">📝 拒绝理由</h3>
          <p style="margin: 0;">${data.rejectionReason}</p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>审批人：</strong>${data.approverName}</p>
        </div>
      </div>
      
      <div style="background-color: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: #075985;">
          💡 <strong>建议：</strong><br/>
          如有疑问，请联系管理员了解详情。您可以根据拒绝理由修改后重新提交申请。
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
        此邮件由实验室管理系统自动发送，请勿回复。
      </p>
    </div>
  `;
  
  sendEmail(userEmail, subject, html);
};

export default {
  sendEmail,
  sendLeaveApplicationNotification,
  sendLeaveApprovalNotification,
  sendAttendanceNotification,
  sendPointRequestSubmitNotification,
  sendPointRequestNotification,
  sendEquipmentRequestEmail,
  sendEquipmentApprovalEmail,
  sendEquipmentRejectionEmail,
};

