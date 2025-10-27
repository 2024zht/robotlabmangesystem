// 邮件发送测试脚本
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('========== 邮件配置测试 ==========');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '已设置' : '未设置');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('===============================\n');

async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log('正在验证SMTP连接...');
    await transporter.verify();
    console.log('✅ SMTP连接验证成功！\n');

    console.log('正在发送测试邮件...');
    const info = await transporter.sendMail({
      from: `"实验室管理系统测试" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // 发送给自己
      subject: '邮件功能测试',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1e40af;">邮件功能测试成功！</h2>
          <p>如果您收到这封邮件，说明邮件配置正确。</p>
          <p><strong>测试时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
        </div>
      `,
    });

    console.log('✅ 测试邮件发送成功！');
    console.log('Message ID:', info.messageId);
    console.log('\n请检查邮箱:', process.env.EMAIL_USER);
    
  } catch (error) {
    console.error('❌ 邮件发送失败:', error.message);
    if (error.code === 'EAUTH') {
      console.error('\n可能的原因：');
      console.error('1. QQ邮箱授权码不正确');
      console.error('2. QQ邮箱SMTP服务未开启');
      console.error('3. 授权码已过期');
      console.error('\n请前往 QQ邮箱设置 → 账户 → 开启SMTP服务 获取新的授权码');
    }
  }
}

testEmail();



