const pool = require('../db');
const { success, error, generateOrderNo } = require('../utils/response');
const { createNotification, batchCreateNotifications } = require('../services/notificationService');

const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { title, stylePreference, budget, houseType, houseArea, floorPlanUrl, description } = req.body;
    const customerId = req.user.id;

    if (!title) {
      return res.json(error('订单标题不能为空'));
    }

    const orderNo = generateOrderNo();

    const [result] = await connection.query(
      `INSERT INTO orders (order_no, customer_id, title, style_preference, budget, house_type, house_area, floor_plan_url, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_designer')`,
      [orderNo, customerId, title, stylePreference || null, budget || null, houseType || null, houseArea || null, floorPlanUrl || null, description || null]
    );

    const orderId = result.insertId;

    const recommendedDesigners = await recommendDesigners(stylePreference, connection);
    
    if (recommendedDesigners.length > 0) {
      const designer = recommendedDesigners[0];
      await connection.query(
        'UPDATE orders SET designer_id = ?, designer_assigned_at = NOW(), status = ? WHERE id = ?',
        [designer.user_id, 'designing', orderId]
      );

      await connection.query(
        'UPDATE designer_profiles SET current_task_count = current_task_count + 1 WHERE user_id = ?',
        [designer.user_id]
      );

      await updateDesignerBusyLevel(designer.user_id, connection);

      await createNotification({
        userId: designer.user_id,
        type: 'order',
        title: '新订单分配',
        content: `您有新的订单需要处理：${title}`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    await createNotification({
      userId: customerId,
      type: 'order',
      title: '订单创建成功',
      content: `您的订单「${title}」已创建成功${recommendedDesigners.length > 0 ? '，已为您匹配设计师' : '，正在为您匹配设计师...'}`,
      relatedType: 'order',
      relatedId: orderId
    });

    await connection.commit();

    res.json(success({ orderId, orderNo }, '订单创建成功'));
  } catch (err) {
    await connection.rollback();
    console.error('创建订单错误:', err);
    res.json(error('创建订单失败'));
  } finally {
    connection.release();
  }
};

const recommendDesigners = async (stylePreference, connection) => {
  let query = `
    SELECT dp.*, u.real_name, u.avatar
    FROM designer_profiles dp
    INNER JOIN users u ON dp.user_id = u.id
    WHERE u.status = 'active'
  `;
  const params = [];

  if (stylePreference) {
    query += ' AND JSON_CONTAINS(dp.style_tags, ?)';
    params.push(JSON.stringify(stylePreference));
  }

  query += ' ORDER BY dp.busy_level = "low" DESC, dp.rating DESC, dp.order_count DESC LIMIT 5';

  const [designers] = await connection.query(query, params);
  return designers;
};

const updateDesignerBusyLevel = async (designerId, connection) => {
  const [profiles] = await connection.query(
    'SELECT current_task_count FROM designer_profiles WHERE user_id = ?',
    [designerId]
  );

  if (profiles.length > 0) {
    const count = profiles[0].current_task_count;
    let busyLevel = 'low';
    if (count >= 5) busyLevel = 'high';
    else if (count >= 3) busyLevel = 'medium';

    await connection.query(
      'UPDATE designer_profiles SET busy_level = ? WHERE user_id = ?',
      [busyLevel, designerId]
    );
  }
};

const getOrderList = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, keyword } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (userRole === 'customer') {
      whereClause += ' AND o.customer_id = ?';
      params.push(userId);
    } else if (userRole === 'designer') {
      whereClause += ' AND o.designer_id = ?';
      params.push(userId);
    }

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (keyword) {
      whereClause += ' AND (o.title LIKE ? OR o.order_no LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT o.*, 
        c.real_name as customer_name, 
        d.real_name as designer_name
      FROM orders o
      LEFT JOIN users c ON o.customer_id = c.id
      LEFT JOIN users d ON o.designer_id = d.id
      ${whereClause}
      ORDER BY o.created_at DESC
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
    console.error('获取订单列表错误:', err);
    res.json(error('获取订单列表失败'));
  }
};

const getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await pool.query(`
      SELECT o.*, 
        c.real_name as customer_name, c.phone as customer_phone,
        d.real_name as designer_name
      FROM orders o
      LEFT JOIN users c ON o.customer_id = c.id
      LEFT JOIN users d ON o.designer_id = d.id
      WHERE o.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.json(error('订单不存在', 404));
    }

    const order = orders[0];

    const userId = req.user.id;
    const userRole = req.user.role;
    if (userRole === 'customer' && order.customer_id !== userId) {
      return res.json(error('无权查看此订单', 403));
    }
    if (userRole === 'designer' && order.designer_id !== userId) {
      return res.json(error('无权查看此订单', 403));
    }

    const [designPlans] = await pool.query(
      'SELECT * FROM design_plans WHERE order_id = ? ORDER BY version DESC',
      [id]
    );

    const [materialLists] = await pool.query(
      'SELECT ml.* FROM material_lists ml WHERE ml.order_id = ? ORDER BY ml.generated_at DESC LIMIT 1',
      [id]
    );

    let materialItems = [];
    if (materialLists.length > 0) {
      const [items] = await pool.query(
        'SELECT * FROM material_items WHERE material_list_id = ? ORDER BY sort_order',
        [materialLists[0].id]
      );
      materialItems = items;
    }

    const [productionOrders] = await pool.query(
      'SELECT * FROM production_orders WHERE order_id = ? ORDER BY created_at DESC',
      [id]
    );

    const [qualityInspections] = await pool.query(
      'SELECT * FROM quality_inspections WHERE order_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json(success({
      order,
      designPlans,
      materialList: materialLists[0] || null,
      materialItems,
      productionOrders,
      qualityInspections
    }));
  } catch (err) {
    console.error('获取订单详情错误:', err);
    res.json(error('获取订单详情失败'));
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;

    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.json(error('订单不存在', 404));
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    const order = orders[0];
    const statusText = {
      'designing': '设计中',
      'design_confirmed': '设计已确认',
      'production': '生产中',
      'quality_check': '质检中',
      'completed': '已完成',
      'cancelled': '已取消',
      'rework': '返工中'
    };

    await createNotification({
      userId: order.customer_id,
      type: 'order',
      title: '订单状态更新',
      content: `您的订单「${order.title}」状态已更新为：${statusText[status] || status}`,
      relatedType: 'order',
      relatedId: id
    });

    if (order.designer_id) {
      await createNotification({
        userId: order.designer_id,
        type: 'order',
        title: '订单状态更新',
        content: `订单「${order.title}」状态已更新为：${statusText[status] || status}`,
        relatedType: 'order',
        relatedId: id
      });
    }

    res.json(success(null, '状态更新成功'));
  } catch (err) {
    console.error('更新订单状态错误:', err);
    res.json(error('更新订单状态失败'));
  }
};

const getDesignerList = async (req, res) => {
  try {
    const { style, page = 1, pageSize = 10 } = req.query;

    let whereClause = 'WHERE u.status = "active"';
    const params = [];

    if (style) {
      whereClause += ' AND JSON_CONTAINS(dp.style_tags, ?)';
      params.push(JSON.stringify(style));
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM designer_profiles dp
      INNER JOIN users u ON dp.user_id = u.id
      ${whereClause}
    `;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const listQuery = `
      SELECT dp.*, u.real_name, u.avatar
      FROM designer_profiles dp
      INNER JOIN users u ON dp.user_id = u.id
      ${whereClause}
      ORDER BY dp.rating DESC, dp.order_count DESC
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
    console.error('获取设计师列表错误:', err);
    res.json(error('获取设计师列表失败'));
  }
};

module.exports = {
  createOrder,
  getOrderList,
  getOrderDetail,
  updateOrderStatus,
  getDesignerList,
  recommendDesigners
};
