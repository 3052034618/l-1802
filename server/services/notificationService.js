const pool = require('../db');

let io = null;

const initNotification = (socketIO) => {
  io = socketIO;
};

const createNotification = async ({ userId, type, title, content, relatedType, relatedId }) => {
  const [result] = await pool.query(
    'INSERT INTO notifications (user_id, type, title, content, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, type, title, content, relatedType, relatedId]
  );

  if (io) {
    io.to(`user_${userId}`).emit('notification', {
      id: result.insertId,
      type,
      title,
      content,
      relatedType,
      relatedId,
      isRead: false,
      createdAt: new Date()
    });
  }

  return result.insertId;
};

const batchCreateNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) return;

  const values = notifications.map(n => [
    n.userId, n.type, n.title, n.content, n.relatedType, n.relatedId
  ]);

  const [result] = await pool.query(
    'INSERT INTO notifications (user_id, type, title, content, related_type, related_id) VALUES ?',
    [values]
  );

  if (io) {
    notifications.forEach((n, index) => {
      io.to(`user_${n.userId}`).emit('notification', {
        id: result.insertId + index,
        type: n.type,
        title: n.title,
        content: n.content,
        relatedType: n.relatedType,
        relatedId: n.relatedId,
        isRead: false,
        createdAt: new Date()
      });
    });
  }

  return result;
};

module.exports = {
  initNotification,
  createNotification,
  batchCreateNotifications
};
