const pool = require('../db');
const { success, error, generateComplaintNo } = require('../utils/response');
const { createNotification } = require('../services/notificationService');

const createComplaint = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, type, title, description, photos } = req.body;
    const customerId = req.user.id;

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND customer_id = ?', [orderId, customerId]);
    if (orders.length === 0) {
      return res.json(error('订单不存在或无权投诉'));
    }

    const complaintNo = generateComplaintNo();

    const [result] = await connection.query(
      `INSERT INTO customer_complaints (order_id, customer_id, complaint_no, type, title, description, photos, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, customerId, complaintNo, type || null, title, description || null,
       photos ? JSON.stringify(photos) : null]
    );

    const complaintId = result.insertId;

    const [managers] = await connection.query(
      "SELECT id FROM users WHERE role IN ('production_supervisor', 'quality_inspector') AND status = 'active'"
    );

    for (const manager of managers) {
      await createNotification({
        userId: manager.id,
        type: 'complaint',
        title: '新投诉待处理',
        content: `订单「${orders[0].title}」有新的客户投诉需要处理。`,
        relatedType: 'complaint',
        relatedId: complaintId
      });
    }

    await connection.commit();

    res.json(success({ complaintId, complaintNo }, '投诉提交成功'));
  } catch (err) {
    await connection.rollback();
    console.error('创建投诉错误:', err);
    res.json(error('投诉提交失败'));
  } finally {
    connection.release();
  }
};

const getComplaintList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (userRole === 'customer') {
      whereClause += ' AND cc.customer_id = ?';
      params.push(userId);
    }

    if (status) {
      whereClause += ' AND cc.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM customer_complaints cc ${whereClause}`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT cc.*, o.title as order_title,
        c.real_name as customer_name
      FROM customer_complaints cc
      LEFT JOIN orders o ON cc.order_id = o.id
      LEFT JOIN users c ON cc.customer_id = c.id
      ${whereClause}
      ORDER BY cc.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [list] = await pool.query(listQuery, [...params, parseInt(pageSize), offset]);

    res.json(success({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (err) {
    console.error('获取投诉列表错误:', err);
    res.json(error('获取投诉列表失败'));
  }
};

const handleComplaint = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status, responsibility, compensationPlan, compensationAmount } = req.body;
    const handledBy = req.user.id;

    const [complaints] = await connection.query('SELECT * FROM customer_complaints WHERE id = ?', [id]);
    if (complaints.length === 0) {
      return res.json(error('投诉不存在', 404));
    }

    const complaint = complaints[0];

    await connection.query(
      `UPDATE customer_complaints 
       SET status = ?, responsibility = ?, compensation_plan = ?, compensation_amount = ?, handled_by = ?, handled_at = NOW()
       WHERE id = ?`,
      [status || complaint.status, responsibility || null, compensationPlan || null,
       compensationAmount || 0, handledBy, id]
    );

    if (status === 'resolved' || status === 'closed') {
      await createNotification({
        userId: complaint.customer_id,
        type: 'complaint',
        title: '投诉处理结果',
        content: `您的投诉「${complaint.title}」已处理完成，赔偿金额：${compensationAmount || 0}元。`,
        relatedType: 'complaint',
        relatedId: id
      });
    }

    await connection.commit();

    res.json(success(null, '处理成功'));
  } catch (err) {
    await connection.rollback();
    console.error('处理投诉错误:', err);
    res.json(error('处理失败'));
  } finally {
    connection.release();
  }
};

module.exports = {
  createComplaint,
  getComplaintList,
  handleComplaint
};
