const pool = require('../db');
const { success, error, generateComplaintNo } = require('../utils/response');
const { createNotification, batchCreateNotifications } = require('../services/notificationService');

const autoDetermineComplaint = (type, description, order) => {
  const lowerDesc = (description || '').toLowerCase();
  
  let responsibility = 'unknown';
  let compensationPlan = '退换货';
  let compensationAmount = 0;
  let autoReason = '';
  
  if (type === 'quality') {
    if (lowerDesc.includes('尺寸') || lowerDesc.includes('偏差') || lowerDesc.includes('不对')) {
      responsibility = 'quality_inspector';
      compensationPlan = '返工维修';
      autoReason = '投诉涉及尺寸偏差，初步判定为质检环节责任';
    } else if (lowerDesc.includes('材质') || lowerDesc.includes('材料') || lowerDesc.includes('造假')) {
      responsibility = 'production_supervisor';
      compensationPlan = '退款50%';
      autoReason = '投诉涉及材料质量问题，初步判定为生产环节责任';
    } else if (lowerDesc.includes('设计') || lowerDesc.includes('图纸') || lowerDesc.includes('方案')) {
      responsibility = 'designer';
      compensationPlan = '免费修改';
      autoReason = '投诉涉及设计问题，初步判定为设计环节责任';
    } else {
      responsibility = 'production_supervisor';
      compensationPlan = '维修补偿';
      autoReason = '一般性质量投诉，初步判定为生产环节责任';
    }
    
    compensationAmount = Math.round((order.total_price || 0) * 0.1);
    if (lowerDesc.includes('严重') || lowerDesc.includes('无法使用') || lowerDesc.includes('不能用')) {
      compensationAmount = Math.round((order.total_price || 0) * 0.3);
      compensationPlan = '全额退款';
    }
  } else if (type === 'delay') {
    responsibility = 'production_supervisor';
    compensationPlan = '延期赔偿';
    compensationAmount = Math.round((order.total_price || 0) * 0.05);
    autoReason = '延期交付投诉，初步判定为生产调度责任';
  } else if (type === 'service') {
    responsibility = 'unknown';
    compensationPlan = '优惠券补偿';
    compensationAmount = 200;
    autoReason = '服务态度投诉，需进一步核实';
  } else if (type === 'design') {
    responsibility = 'designer';
    compensationPlan = '免费重新设计';
    compensationAmount = Math.round((order.total_price || 0) * 0.05);
    autoReason = '设计方案投诉，初步判定为设计师责任';
  }
  
  return {
    responsibility,
    compensationPlan,
    compensationAmount,
    autoReason
  };
};

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
    const order = orders[0];

    const autoResult = autoDetermineComplaint(type, description, order);

    const complaintNo = generateComplaintNo();

    const [result] = await connection.query(
      `INSERT INTO customer_complaints 
       (order_id, customer_id, complaint_no, type, title, description, photos, 
        status, auto_responsibility, auto_compensation_plan, auto_compensation_amount, 
        auto_reason, final_responsibility, final_compensation_plan, final_compensation_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, customerId, complaintNo, type || null, title, description || null,
       photos ? JSON.stringify(photos) : null,
       autoResult.responsibility, autoResult.compensationPlan, autoResult.compensationAmount,
       autoResult.autoReason, autoResult.responsibility, autoResult.compensationPlan, autoResult.compensationAmount]
    );

    const complaintId = result.insertId;

    const [managers] = await connection.query(
      "SELECT id FROM users WHERE role IN ('production_supervisor', 'quality_inspector') AND status = 'active'"
    );

    const notifications = [];
    
    for (const manager of managers) {
      notifications.push({
        userId: manager.id,
        type: 'complaint',
        title: '新投诉待处理',
        content: `订单「${order.title}」有新的客户投诉需要处理。系统已自动判定责任方，请复核。`,
        relatedType: 'complaint',
        relatedId: complaintId
      });
    }
    
    if (notifications.length > 0) {
      await batchCreateNotifications(notifications);
    }

    await connection.commit();

    res.json(success({ 
      complaintId, 
      complaintNo,
      autoDetermination: autoResult
    }, '投诉提交成功，系统已自动判定'));
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
      SELECT cc.*, o.title as order_title, o.total_price as order_amount,
        c.real_name as customer_name,
        handler.real_name as handler_name
      FROM customer_complaints cc
      LEFT JOIN orders o ON cc.order_id = o.id
      LEFT JOIN users c ON cc.customer_id = c.id
      LEFT JOIN users handler ON cc.handled_by = handler.id
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

const getComplaintDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [complaints] = await pool.query(
      `SELECT cc.*, o.title as order_title, o.total_price as order_amount,
        o.order_no, c.real_name as customer_name, c.phone as customer_phone,
        handler.real_name as handler_name
       FROM customer_complaints cc
       LEFT JOIN orders o ON cc.order_id = o.id
       LEFT JOIN users c ON cc.customer_id = c.id
       LEFT JOIN users handler ON cc.handled_by = handler.id
       WHERE cc.id = ?`,
      [id]
    );

    if (complaints.length === 0) {
      return res.json(error('投诉不存在', 404));
    }

    const complaint = complaints[0];

    if (userRole === 'customer' && complaint.customer_id !== userId) {
      return res.json(error('无权查看此投诉', 403));
    }

    res.json(success(complaint));
  } catch (err) {
    console.error('获取投诉详情错误:', err);
    res.json(error('获取投诉详情失败'));
  }
};

const handleComplaint = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { 
      status, 
      finalResponsibility, 
      finalCompensationPlan, 
      finalCompensationAmount,
      handlerRemark,
      voucherUrls
    } = req.body;
    const handledBy = req.user.id;

    const [complaints] = await pool.query('SELECT * FROM customer_complaints WHERE id = ?', [id]);
    if (complaints.length === 0) {
      return res.json(error('投诉不存在', 404));
    }

    const complaint = complaints[0];

    await connection.query(
      `UPDATE customer_complaints 
       SET status = ?, 
           final_responsibility = ?, 
           final_compensation_plan = ?, 
           final_compensation_amount = ?,
           handler_remark = ?,
           voucher_urls = ?,
           handled_by = ?, 
           handled_at = NOW()
       WHERE id = ?`,
      [status || complaint.status, 
       finalResponsibility || complaint.final_responsibility, 
       finalCompensationPlan || complaint.final_compensation_plan,
       finalCompensationAmount != null ? finalCompensationAmount : complaint.final_compensation_amount,
       handlerRemark || null,
       voucherUrls ? JSON.stringify(voucherUrls) : null,
       handledBy, id]
    );

    if (status === 'resolved' || status === 'closed') {
      const finalAmount = finalCompensationAmount != null ? finalCompensationAmount : complaint.final_compensation_amount;
      await createNotification({
        userId: complaint.customer_id,
        type: 'complaint',
        title: '投诉处理结果',
        content: `您的投诉「${complaint.title}」已处理完成。责任方：${finalResponsibility || '待确认'}，赔偿方案：${finalCompensationPlan || complaint.final_compensation_plan}，赔偿金额：¥${finalAmount || 0}。`,
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
  getComplaintDetail,
  handleComplaint
};
