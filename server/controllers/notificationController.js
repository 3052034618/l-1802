const pool = require('../db');
const { success, error } = require('../utils/response');

const getNotificationList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, isRead, type } = req.query;
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = ?';
    const params = [userId];

    if (isRead !== undefined && isRead !== '') {
      whereClause += ' AND is_read = ?';
      params.push(isRead === 'true' ? 1 : 0);
    }

    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [list] = await pool.query(listQuery, [...params, parseInt(pageSize), offset]);

    const [unreadResult] = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.json(success({
      list,
      total,
      unreadCount: unreadResult[0].unread_count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (err) {
    console.error('获取通知列表错误:', err);
    res.json(error('获取通知列表失败'));
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json(success(null, '标记已读成功'));
  } catch (err) {
    console.error('标记已读错误:', err);
    res.json(error('标记已读失败'));
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.json(success(null, '全部标记已读成功'));
  } catch (err) {
    console.error('全部标记已读错误:', err);
    res.json(error('操作失败'));
  }
};

module.exports = {
  getNotificationList,
  markAsRead,
  markAllAsRead
};
