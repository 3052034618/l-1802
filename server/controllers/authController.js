const pool = require('../db');
const { generateToken, comparePassword, hashPassword } = require('../utils/auth');
const { success, error } = require('../utils/response');
const { createNotification } = require('../services/notificationService');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json(error('用户名和密码不能为空'));
    }

    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.json(error('用户名或密码错误'));
    }

    const user = users[0];
    
    if (user.status !== 'active') {
      return res.json(error('账号已被禁用'));
    }

    if (!comparePassword(password, user.password)) {
      return res.json(error('用户名或密码错误'));
    }

    const token = generateToken(user);

    let profile = null;
    if (user.role === 'designer') {
      const [profiles] = await pool.query('SELECT * FROM designer_profiles WHERE user_id = ?', [user.id]);
      profile = profiles[0] || null;
    }

    res.json(success({
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        profile
      }
    }, '登录成功'));
  } catch (err) {
    console.error('登录错误:', err);
    res.json(error('登录失败'));
  }
};

const register = async (req, res) => {
  try {
    const { username, password, realName, phone, email, role } = req.body;

    if (!username || !password || !realName) {
      return res.json(error('用户名、密码和真实姓名不能为空'));
    }

    const validRoles = ['customer', 'designer', 'production_supervisor', 'quality_inspector', 'finance'];
    if (!validRoles.includes(role)) {
      return res.json(error('无效的角色类型'));
    }

    const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.json(error('用户名已存在'));
    }

    const hashedPassword = hashPassword(password);

    const [result] = await pool.query(
      'INSERT INTO users (username, password, real_name, phone, email, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, realName, phone || null, email || null, role]
    );

    if (role === 'designer') {
      await pool.query('INSERT INTO designer_profiles (user_id) VALUES (?)', [result.insertId]);
    }

    await createNotification({
      userId: result.insertId,
      type: 'system',
      title: '注册成功',
      content: '欢迎使用定制家居设计平台！',
      relatedType: null,
      relatedId: null
    });

    res.json(success({ id: result.insertId }, '注册成功'));
  } catch (err) {
    console.error('注册错误:', err);
    res.json(error('注册失败'));
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.json(error('用户不存在', 404));
    }

    const user = users[0];
    let profile = null;

    if (user.role === 'designer') {
      const [profiles] = await pool.query('SELECT * FROM designer_profiles WHERE user_id = ?', [user.id]);
      profile = profiles[0] || null;
    }

    res.json(success({
      id: user.id,
      username: user.username,
      realName: user.real_name,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      profile
    }));
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.json(error('获取用户信息失败'));
  }
};

const updateProfile = async (req, res) => {
  try {
    const { realName, phone, email, avatar } = req.body;

    await pool.query(
      'UPDATE users SET real_name = ?, phone = ?, email = ?, avatar = ? WHERE id = ?',
      [realName || null, phone || null, email || null, avatar || null, req.user.id]
    );

    res.json(success(null, '更新成功'));
  } catch (err) {
    console.error('更新个人信息错误:', err);
    res.json(error('更新失败'));
  }
};

module.exports = {
  login,
  register,
  getCurrentUser,
  updateProfile
};
