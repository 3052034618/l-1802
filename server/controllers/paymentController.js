const pool = require('../db');
const { success, error, generatePaymentNo } = require('../utils/response');
const { createNotification, batchCreateNotifications } = require('../services/notificationService');

const processPayment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, amount, paymentMethod } = req.body;
    const customerId = req.user.id;

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND customer_id = ?',
      [orderId, customerId]
    );

    if (orders.length === 0) {
      return res.json(error('订单不存在或无权操作'));
    }

    const order = orders[0];

    if (order.status !== 'pending_payment') {
      return res.json(error('订单状态不正确，无法支付'));
    }

    if (amount < order.total_price) {
      return res.json(error('支付金额不足'));
    }

    const paymentNo = generatePaymentNo();

    await connection.query(
      `INSERT INTO payments (order_id, payment_no, amount, payment_method, status, paid_at, transaction_id)
       VALUES (?, ?, ?, ?, 'success', NOW(), ?)`,
      [orderId, paymentNo, amount, paymentMethod || 'online', `TXN${Date.now()}`]
    );

    await connection.query(
      `UPDATE orders 
       SET status = 'ready_for_production', 
           paid_amount = ?, 
           paid_at = NOW() 
       WHERE id = ?`,
      [amount, orderId]
    );

    await createNotification({
      userId: customerId,
      type: 'order',
      title: '支付成功',
      content: `您的订单「${order.title}」支付成功，金额 ¥${amount.toLocaleString()} 元，即将安排生产。`,
      relatedType: 'order',
      relatedId: orderId
    });

    if (order.designer_id) {
      await createNotification({
        userId: order.designer_id,
        type: 'order',
        title: '订单已支付',
        content: `客户已完成「${order.title}」的支付，订单即将进入生产阶段。`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    const [supervisors] = await connection.query(
      "SELECT id FROM users WHERE role = 'production_supervisor' AND status = 'active'"
    );

    const notifications = supervisors.map(s => ({
      userId: s.id,
      type: 'order',
      title: '新订单待排产',
      content: `订单「${order.title}」已支付，待安排生产排产。`,
      relatedType: 'order',
      relatedId: orderId
    }));

    await batchCreateNotifications(notifications);

    await connection.query(
      'UPDATE designer_profiles SET current_task_count = current_task_count - 1 WHERE user_id = ?',
      [order.designer_id]
    );

    await connection.commit();

    res.json(success({ paymentNo }, '支付成功'));
  } catch (err) {
    await connection.rollback();
    console.error('支付处理错误:', err);
    res.json(error('支付失败'));
  } finally {
    connection.release();
  }
};

const getPaymentRecord = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = 'WHERE order_id = ?';
    const params = [orderId];

    if (userRole === 'customer') {
      whereClause += ' AND (SELECT customer_id FROM orders WHERE id = ?) = ?';
      params.push(orderId, userId);
    }

    const [payments] = await pool.query(
      `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC`,
      params
    );

    res.json(success(payments));
  } catch (err) {
    console.error('获取支付记录错误:', err);
    res.json(error('获取支付记录失败'));
  }
};

module.exports = {
  processPayment,
  getPaymentRecord
};
