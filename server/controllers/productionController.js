const pool = require('../db');
const { success, error, generateProductionNo, generateInspectionNo } = require('../utils/response');
const { createNotification, batchCreateNotifications } = require('../services/notificationService');
const dayjs = require('dayjs');

const scheduleProduction = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, productionLine, scheduleDate, remark, recommendReason, recommendData } = req.body;
    const supervisorId = req.user.id;

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.json(error('订单不存在', 404));
    }

    const order = orders[0];

    if (order.status !== 'ready_for_production') {
      return res.json(error('订单状态不正确，只有已支付的订单才能安排生产'));
    }

    const [existingProduction] = await connection.query(
      'SELECT id FROM production_orders WHERE order_id = ? AND status != "completed"',
      [orderId]
    );
    if (existingProduction.length > 0) {
      return res.json(error('该订单已有进行中的生产任务'));
    }

    if (productionLine && scheduleDate) {
      const lines = [
        { id: 'A线-木工车间', capacity: 10 },
        { id: 'B线-木工车间', capacity: 8 },
        { id: 'C线-喷漆车间', capacity: 6 },
        { id: 'D线-组装车间', capacity: 12 }
      ];
      const lineConfig = lines.find(l => l.id === productionLine);
      if (lineConfig) {
        const [dayOrders] = await connection.query(
          `SELECT COUNT(*) as count FROM production_orders 
           WHERE production_line = ? AND schedule_date = ? AND status != 'completed'`,
          [productionLine, scheduleDate]
        );
        const currentCount = dayOrders[0]?.count || 0;
        if (currentCount >= lineConfig.capacity) {
          return res.json(error(`产线「${productionLine}」在 ${scheduleDate} 产能已满（${currentCount}/${lineConfig.capacity}），请更换日期或选择其他产线`));
        }
      }
    }

    const productionNo = generateProductionNo();

    const [result] = await connection.query(
      `INSERT INTO production_orders (order_id, production_no, production_line, schedule_date, status, progress, supervisor_id, remark, recommend_reason, recommend_data)
       VALUES (?, ?, ?, ?, 'in_progress', 0, ?, ?, ?, ?)`,
      [orderId, productionNo, productionLine || null, scheduleDate || null, supervisorId,
       remark || null, recommendReason || null, recommendData ? JSON.stringify(recommendData) : null]
    );

    const productionOrderId = result.insertId;

    await connection.query(
      "UPDATE orders SET status = 'production' WHERE id = ?",
      [orderId]
    );

    await connection.query(
      `INSERT INTO production_progress_logs (production_order_id, progress, status, description, recorded_by)
       VALUES (?, 0, 'pending', '生产任务已创建，待开工', ?)`,
      [productionOrderId, supervisorId]
    );

    const notifications = [
      {
        userId: order.customer_id,
        type: 'production',
        title: '订单已开始生产',
        content: `您的订单「${order.title}」已安排生产，预计${scheduleDate || '尽快'}开工，产线：${productionLine}。`,
        relatedType: 'order',
        relatedId: orderId
      }
    ];

    if (order.designer_id) {
      notifications.push({
        userId: order.designer_id,
        type: 'production',
        title: '订单进入生产',
        content: `订单「${order.title}」已进入生产阶段，产线：${productionLine}。`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    await batchCreateNotifications(notifications);

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

    const { orderId, productionOrderId, status, overallScore, inspectionItems, photos, measuredDimensions, remark } = req.body;
    const inspectorId = req.user.id;

    const [designDimensions] = await connection.query(
      'SELECT * FROM design_dimensions WHERE order_id = ?',
      [orderId]
    );

    let deviationData = [];
    let hasExceededDeviation = false;
    let exceededItems = [];

    if (measuredDimensions && measuredDimensions.length > 0 && designDimensions.length > 0) {
      measuredDimensions.forEach(measured => {
        const design = designDimensions.find(d => d.id === measured.dimensionId);
        if (design) {
          const deviation = Math.abs(measured.measuredValue - design.design_value);
          const isExceeded = deviation > design.tolerance;
          
          deviationData.push({
            dimensionId: design.id,
            itemName: design.item_name,
            partName: design.part_name,
            dimensionType: design.dimension_type,
            designValue: design.design_value,
            measuredValue: measured.measuredValue,
            tolerance: design.tolerance,
            deviation: deviation,
            unit: design.unit,
            isExceeded: isExceeded
          });

          if (isExceeded) {
            hasExceededDeviation = true;
            exceededItems.push(`${design.item_name} ${design.part_name || ''} ${design.dimension_type}: 设计值${design.design_value}${design.unit}, 实测${measured.measuredValue}${design.unit}, 偏差${deviation}${design.unit}, 超过公差${design.tolerance}${design.unit}`);
          }
        }
      });
    }

    let finalStatus = status;
    if (hasExceededDeviation && status !== 'rework') {
      finalStatus = 'rework';
    }

    const inspectionNo = generateInspectionNo();

    const [result] = await connection.query(
      `INSERT INTO quality_inspections (order_id, production_order_id, inspector_id, inspection_no, status, overall_score, inspection_items, photos, deviation_data, remark, inspected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [orderId, productionOrderId, inspectorId, inspectionNo, finalStatus,
       overallScore || null,
       inspectionItems ? JSON.stringify(inspectionItems) : null,
       photos ? JSON.stringify(photos) : null,
       deviationData ? JSON.stringify(deviationData) : null,
       remark || null]
    );

    const inspectionId = result.insertId;

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];

    if (finalStatus === 'passed') {
      await connection.query(
        "UPDATE orders SET status = 'completed' WHERE id = ?",
        [orderId]
      );

      await connection.query(
        "UPDATE production_orders SET status = 'completed' WHERE id = ?",
        [productionOrderId]
      );
    } else if (finalStatus === 'failed' || finalStatus === 'rework') {
      const [qualityInspections] = await connection.query(
        'SELECT COUNT(*) as count FROM quality_inspections WHERE order_id = ? AND status IN ("failed", "rework")',
        [orderId]
      );
      const reworkCount = qualityInspections[0].count;

      await connection.query(
        "UPDATE orders SET status = 'rework' WHERE id = ?",
        [orderId]
      );

      await connection.query(
        `UPDATE production_orders 
         SET status = 'quality_failed', progress = 0 
         WHERE id = ?`,
        [productionOrderId]
      );

      await connection.query(
        'UPDATE quality_inspections SET rework_count = ? WHERE id = ?',
        [reworkCount, inspectionId]
      );

      await connection.query(
        `INSERT INTO production_progress_logs (production_order_id, progress, status, description, recorded_by)
         VALUES (?, 0, 'rework', ? , ?)`,
        [productionOrderId, `质检不合格，需要返工。${exceededItems.length > 0 ? '问题：' + exceededItems.slice(0, 2).join('；') : ''}`, inspectorId]
      );
    }

    const notifications = [];
    const statusText = finalStatus === 'passed' ? '通过' : '未通过，需要返工';
    let content = `您的订单「${order.title}」质检${statusText}。`;
    
    if (hasExceededDeviation) {
      content += ` 发现${exceededItems.length}项尺寸偏差超过阈值。`;
    }

    notifications.push({
      userId: order.customer_id,
      type: 'quality',
      title: '质检结果通知',
      content: content,
      relatedType: 'order',
      relatedId: orderId
    });

    if (order.designer_id) {
      notifications.push({
        userId: order.designer_id,
        type: 'quality',
        title: '质检结果通知',
        content: `订单「${order.title}」质检${statusText}。${hasExceededDeviation ? '请配合调整设计。' : ''}`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    const [supervisors] = await connection.query(
      "SELECT id FROM users WHERE role = 'production_supervisor' AND status = 'active'"
    );

    for (const supervisor of supervisors) {
      notifications.push({
        userId: supervisor.id,
        type: 'quality',
        title: '质检结果通知',
        content: `订单「${order.title}」质检${statusText}。${hasExceededDeviation ? '请安排返工。' : ''}`,
        relatedType: 'order',
        relatedId: orderId
      });
    }

    await batchCreateNotifications(notifications);

    await connection.commit();

    res.json(success({ 
      inspectionId, 
      inspectionNo, 
      finalStatus,
      hasExceededDeviation,
      exceededItems 
    }, hasExceededDeviation && status !== 'rework' 
      ? '检测到尺寸偏差超标，系统自动判定为返工' 
      : '质检记录创建成功'));
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

const getProductionRecommend = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.json(error('订单不存在', 404));
    }

    const order = orders[0];

    const [materialItems] = await pool.query(`
      SELECT mi.* FROM material_items mi
      INNER JOIN material_lists ml ON mi.material_list_id = ml.id
      WHERE ml.order_id = ?
      ORDER BY mi.category, mi.sort_order
    `, [orderId]);

    const lines = [
      { id: 'A线-木工车间', name: 'A线-木工车间', capacity: 10, suitableCategories: ['板材'], priority: 1 },
      { id: 'B线-木工车间', name: 'B线-木工车间', capacity: 8, suitableCategories: ['板材'], priority: 2 },
      { id: 'C线-喷漆车间', name: 'C线-喷漆车间', capacity: 6, suitableCategories: ['涂料'], priority: 1 },
      { id: 'D线-组装车间', name: 'D线-组装车间', capacity: 12, suitableCategories: ['板材', '五金', '石材'], priority: 1 }
    ];

    const today = dayjs();
    const dateOrders = {};
    for (let i = 0; i < 7; i++) {
      const dateStr = today.add(i, 'day').format('YYYY-MM-DD');
      const [dayOrders] = await pool.query(
        `SELECT production_line, COUNT(*) as count 
         FROM production_orders 
         WHERE schedule_date = ? 
         GROUP BY production_line`,
        [dateStr]
      );
      dateOrders[dateStr] = {};
      dayOrders.forEach(d => {
        dateOrders[dateStr][d.production_line] = d.count;
      });
    }

    const categories = [...new Set(materialItems.map(m => m.category))];

    const lineScores = lines.map(line => {
      const matchCount = categories.filter(c => line.suitableCategories.includes(c)).length;
      let bestDate = null;
      let minLoad = Infinity;

      for (let i = 0; i < 7; i++) {
        const dateStr = today.add(i, 'day').format('YYYY-MM-DD');
        const currentLoad = dateOrders[dateStr]?.[line.id] || 0;
        const available = line.capacity - currentLoad;
        
        if (available > 0 && currentLoad < minLoad) {
          minLoad = currentLoad;
          bestDate = dateStr;
        }
      }

      const workload = bestDate ? (dateOrders[bestDate]?.[line.id] || 0) : line.capacity;
      const loadRate = workload / line.capacity;
      const score = (matchCount / Math.max(categories.length, 1)) * 50 + (1 - loadRate) * 30 + (line.priority === 1 ? 20 : 10);

      return {
        ...line,
        score: Math.round(score * 100) / 100,
        currentWorkload: workload,
        availableCapacity: line.capacity - workload,
        loadRate: Math.round(loadRate * 100),
        bestDate,
        isFull: workload >= line.capacity
      };
    });

    lineScores.sort((a, b) => b.score - a.score);

    const availableLines = lineScores.filter(l => !l.isFull);
    const allLinesFull = availableLines.length === 0;
    const recommendedLine = allLinesFull ? null : availableLines[0];
    const recommendedDate = recommendedLine?.bestDate || null;

    const reasons = [];
    reasons.push(`订单主要物料类型：${categories.join('、') || '未知'}`);
    
    if (allLinesFull) {
      reasons.push('⚠️ 最近7天所有产线产能已满，请生产主管手动调整排产日期或选择其他方案');
    } else {
      reasons.push(`推荐产线「${recommendedLine.name}」：匹配度${Math.round((categories.filter(c => recommendedLine.suitableCategories.includes(c)).length / Math.max(categories.length, 1)) * 100)}%，当前负载${recommendedLine.loadRate}%`);
      reasons.push(`推荐排产日期：${recommendedDate}（最近7天中该产线负载最低）`);
    }
    reasons.push(`预计物料总量：${materialItems.reduce((sum, m) => sum + m.quantity, 0).toFixed(2)} 单位`);

    const otherOptions = lineScores
      .filter(l => l.id !== recommendedLine?.id && !l.isFull)
      .slice(0, 2)
      .map(l => ({
        id: l.id,
        name: l.name,
        score: l.score,
        loadRate: l.loadRate,
        bestDate: l.bestDate,
        reason: `匹配度${Math.round((categories.filter(c => l.suitableCategories.includes(c)).length / Math.max(categories.length, 1)) * 100)}%，负载${l.loadRate}%`
      }));

    const result = {
      allLinesFull,
      recommended: allLinesFull ? null : {
        line: recommendedLine.id,
        lineName: recommendedLine.name,
        date: recommendedDate,
        score: recommendedLine.score
      },
      reasons,
      allLines: lineScores,
      otherOptions,
      materialSummary: {
        totalItems: materialItems.length,
        categories,
        totalQuantity: Math.round(materialItems.reduce((sum, m) => sum + m.quantity, 0) * 100) / 100
      }
    };

    res.json(success(result));
  } catch (err) {
    console.error('获取排产推荐错误:', err);
    res.json(error('获取排产推荐失败'));
  }
};

module.exports = {
  scheduleProduction,
  updateProductionProgress,
  getProductionOrderList,
  getProductionOrderDetail,
  createQualityInspection,
  getQualityInspectionList,
  getWorkshopCapacity,
  getProductionRecommend
};
