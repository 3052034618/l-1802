const pool = require('../db');
const { success, error, generateProductionNo, generateInspectionNo } = require('../utils/response');
const { createNotification } = require('../services/notificationService');
const dayjs = require('dayjs');

const scheduleProduction = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, productionLine, scheduleDate } = req.body;
    const supervisorId = req.user.id;

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.json(error('订单不存在', 404));
    }

    const order = orders[0];

    const [existingProduction] = await connection.query(
      'SELECT id FROM production_orders WHERE order_id = ? AND status != "completed"',
      [orderId]
    );
    if (existingProduction.length > 0) {
      return res.json(error('该订单已有进行中的生产任务'));
    }

    const productionNo = generateProductionNo();

    const [result] = await connection.query(
      `INSERT INTO production_orders (order_id, production_no, production_line, schedule_date, status, progress, supervisor_id)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      [orderId, productionNo, productionLine || null, scheduleDate || null, supervisorId]
    );

    const productionOrderId = result.insertId;

    await connection.query(
      "UPDATE orders SET status = 'production' WHERE id = ?",
      [orderId]
    );

    await createNotification({
      userId: order.customer_id,
      type: 'production',
      title: '订单已开始生产',
      content: `您的订单「${order.title}」已安排生产，预计${scheduleDate || '尽快'}开工。`,
      relatedType: 'order',
      relatedId: orderId
    });

    if (order.designer_id) {
      await createNotification({
        userId: order.designer_id,
        type: 'production',
        title: '订单进入生产',
        content: `订单「${order.title}」已进入生产阶段。`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    await connection.commit();

    res.json(success({ productionOrderId, productionNo }, '生产排产成功'));
  } catch (err) {
    await connection.rollback();
    console.error('生产排产错误:', err);
    res.json(error('生产排产失败'));
  } finally {
    connection.release();
  }
};

const updateProductionProgress = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { progress, status, description } = req.body;
    const userId = req.user.id;

    const [productionOrders] = await connection.query('SELECT * FROM production_orders WHERE id = ?', [id]);
    if (productionOrders.length === 0) {
      return res.json(error('生产订单不存在', 404));
    }

    const productionOrder = productionOrders[0];

    await connection.query(
      'UPDATE production_orders SET progress = ?, status = ? WHERE id = ?',
      [progress || productionOrder.progress, status || productionOrder.status, id]
    );

    if (progress && progress >= 100) {
      await connection.query(
        "UPDATE production_orders SET status = 'completed', end_time = NOW() WHERE id = ?",
        [id]
      );

      const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [productionOrder.order_id]);
      const order = orders[0];

      await connection.query(
        "UPDATE orders SET status = 'quality_check' WHERE id = ?",
        [productionOrder.order_id]
      );

      const [inspectors] = await connection.query(
        "SELECT id FROM users WHERE role = 'quality_inspector' AND status = 'active'"
      );

      for (const inspector of inspectors) {
        await createNotification({
          userId: inspector.id,
          type: 'quality',
          title: '新质检任务',
          content: `订单「${order.title}」生产完成，待质检。`,
          relatedType: 'order',
          relatedId: productionOrder.order_id
        });
      }
    }

    await connection.query(
      `INSERT INTO production_progress_logs (production_order_id, progress, status, description, recorded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, progress || productionOrder.progress, status || productionOrder.status, description || null, userId]
    );

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [productionOrder.order_id]);
    const order = orders[0];

    await createNotification({
      userId: order.customer_id,
      type: 'production',
      title: '生产进度更新',
      content: `您的订单「${order.title}」生产进度已更新：${progress}%${description ? ' - ' + description : ''}`,
      relatedType: 'order',
      relatedId: productionOrder.order_id
    });

    await connection.commit();

    res.json(success(null, '进度更新成功'));
  } catch (err) {
    await connection.rollback();
    console.error('更新生产进度错误:', err);
    res.json(error('更新生产进度失败'));
  } finally {
    connection.release();
  }
};

const getProductionOrderList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, orderId } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }

    if (orderId) {
      whereClause += ' AND po.order_id = ?';
      params.push(orderId);
    }

    const countQuery = `SELECT COUNT(*) as total FROM production_orders po ${whereClause}`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT po.*, o.title as order_title, o.customer_id, 
        c.real_name as customer_name,
        s.real_name as supervisor_name
      FROM production_orders po
      LEFT JOIN orders o ON po.order_id = o.id
      LEFT JOIN users c ON o.customer_id = c.id
      LEFT JOIN users s ON po.supervisor_id = s.id
      ${whereClause}
      ORDER BY po.created_at DESC
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
    console.error('获取生产订单列表错误:', err);
    res.json(error('获取生产订单列表失败'));
  }
};

const getProductionOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [productionOrders] = await pool.query(`
      SELECT po.*, o.title as order_title, o.customer_id, o.house_area, o.style_preference,
        c.real_name as customer_name, c.phone as customer_phone
      FROM production_orders po
      LEFT JOIN orders o ON po.order_id = o.id
      LEFT JOIN users c ON o.customer_id = c.id
      WHERE po.id = ?
    `, [id]);

    if (productionOrders.length === 0) {
      return res.json(error('生产订单不存在', 404));
    }

    const productionOrder = productionOrders[0];

    const [progressLogs] = await pool.query(
      `SELECT ppl.*, u.real_name as recorder_name 
       FROM production_progress_logs ppl
       LEFT JOIN users u ON ppl.recorded_by = u.id
       WHERE ppl.production_order_id = ?
       ORDER BY ppl.created_at DESC`,
      [id]
    );

    const [materialLists] = await pool.query(
      'SELECT * FROM material_lists WHERE order_id = ? ORDER BY generated_at DESC LIMIT 1',
      [productionOrder.order_id]
    );

    let materialItems = [];
    if (materialLists.length > 0) {
      const [items] = await pool.query(
        'SELECT * FROM material_items WHERE material_list_id = ? ORDER BY sort_order',
        [materialLists[0].id]
      );
      materialItems = items;
    }

    res.json(success({
      productionOrder,
      progressLogs,
      materialList: materialLists[0] || null,
      materialItems
    }));
  } catch (err) {
    console.error('获取生产订单详情错误:', err);
    res.json(error('获取生产订单详情失败'));
  }
};

const createQualityInspection = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, productionOrderId, status, overallScore, inspectionItems, photos, deviationData, remark } = req.body;
    const inspectorId = req.user.id;

    const inspectionNo = generateInspectionNo();

    const [result] = await connection.query(
      `INSERT INTO quality_inspections (order_id, production_order_id, inspector_id, inspection_no, status, overall_score, inspection_items, photos, deviation_data, remark, inspected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [orderId, productionOrderId, inspectorId, inspectionNo, status || 'pending',
       overallScore || null,
       inspectionItems ? JSON.stringify(inspectionItems) : null,
       photos ? JSON.stringify(photos) : null,
       deviationData ? JSON.stringify(deviationData) : null,
       remark || null]
    );

    const inspectionId = result.insertId;

    if (status === 'passed') {
      await connection.query(
        "UPDATE orders SET status = 'completed' WHERE id = ?",
        [orderId]
      );

      await connection.query(
        "UPDATE production_orders SET status = 'completed' WHERE id = ?",
        [productionOrderId]
      );
    } else if (status === 'failed' || status === 'rework') {
      await connection.query(
        "UPDATE orders SET status = 'rework' WHERE id = ?",
        [orderId]
      );

      await connection.query(
        "UPDATE production_orders SET status = 'quality_failed' WHERE id = ?",
        [productionOrderId]
      );
    }

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];

    await createNotification({
      userId: order.customer_id,
      type: 'quality',
      title: '质检结果通知',
      content: `您的订单「${order.title}」质检${status === 'passed' ? '通过' : '未通过，需要返工'}。`,
      relatedType: 'order',
      relatedId: orderId
    });

    if (order.designer_id) {
      await createNotification({
        userId: order.designer_id,
        type: 'quality',
        title: '质检结果通知',
        content: `订单「${order.title}」质检${status === 'passed' ? '通过' : '未通过'}。`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    await connection.commit();

    res.json(success({ inspectionId, inspectionNo }, '质检记录创建成功'));
  } catch (err) {
    await connection.rollback();
    console.error('创建质检记录错误:', err);
    res.json(error('创建质检记录失败'));
  } finally {
    connection.release();
  }
};

const getQualityInspectionList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, orderId } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND qi.status = ?';
      params.push(status);
    }

    if (orderId) {
      whereClause += ' AND qi.order_id = ?';
      params.push(orderId);
    }

    const countQuery = `SELECT COUNT(*) as total FROM quality_inspections qi ${whereClause}`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT qi.*, o.title as order_title,
        i.real_name as inspector_name
      FROM quality_inspections qi
      LEFT JOIN orders o ON qi.order_id = o.id
      LEFT JOIN users i ON qi.inspector_id = i.id
      ${whereClause}
      ORDER BY qi.created_at DESC
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
    console.error('获取质检列表错误:', err);
    res.json(error('获取质检列表失败'));
  }
};

const getWorkshopCapacity = async (req, res) => {
  try {
    const lines = [
      { id: 'A线-木工车间', name: 'A线-木工车间', capacity: 10, current: 3, status: 'normal' },
      { id: 'B线-木工车间', name: 'B线-木工车间', capacity: 8, current: 6, status: 'busy' },
      { id: 'C线-喷漆车间', name: 'C线-喷漆车间', capacity: 6, current: 2, status: 'normal' },
      { id: 'D线-组装车间', name: 'D线-组装车间', capacity: 12, current: 8, status: 'normal' },
      { id: 'E线-包装车间', name: 'E线-包装车间', capacity: 15, current: 5, status: 'idle' }
    ];

    const today = dayjs().format('YYYY-MM-DD');
    const [todayProductions] = await pool.query(
      `SELECT production_line, COUNT(*) as count 
       FROM production_orders 
       WHERE schedule_date = ? 
       GROUP BY production_line`,
      [today]
    );

    const lineCounts = {};
    todayProductions.forEach(p => {
      lineCounts[p.production_line] = p.count;
    });

    const result = lines.map(line => ({
      ...line,
      current: lineCounts[line.id] || 0
    }));

    res.json(success(result));
  } catch (err) {
    console.error('获取车间产能错误:', err);
    res.json(error('获取车间产能失败'));
  }
};

module.exports = {
  scheduleProduction,
  updateProductionProgress,
  getProductionOrderList,
  getProductionOrderDetail,
  createQualityInspection,
  getQualityInspectionList,
  getWorkshopCapacity
};
