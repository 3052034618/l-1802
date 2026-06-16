const pool = require('../db');
const { success, error } = require('../utils/response');
const { createNotification } = require('../services/notificationService');

const submitDesignPlan = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, title, description, designFiles, floorPlan3dUrl, renderings } = req.body;
    const designerId = req.user.id;

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND designer_id = ?', [orderId, designerId]);
    if (orders.length === 0) {
      return res.json(error('订单不存在或无权操作'));
    }

    const order = orders[0];

    const [maxVersionResult] = await connection.query(
      'SELECT MAX(version) as max_version FROM design_plans WHERE order_id = ?',
      [orderId]
    );
    const nextVersion = (maxVersionResult[0].max_version || 0) + 1;

    const [result] = await connection.query(
      `INSERT INTO design_plans (order_id, designer_id, version, title, description, design_files, floor_plan_3d_url, renderings, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`,
      [orderId, designerId, nextVersion, title || null, description || null, 
       designFiles ? JSON.stringify(designFiles) : null, 
       floorPlan3dUrl || null,
       renderings ? JSON.stringify(renderings) : null]
    );

    await generateMaterialList(orderId, result.insertId, connection);

    await connection.query(
      "UPDATE orders SET status = 'pending_confirmation' WHERE id = ?",
      [orderId]
    );

    await createNotification({
      userId: order.customer_id,
      type: 'design',
      title: '设计方案已提交',
      content: `设计师已提交「${order.title}」的设计方案和报价，请及时查看并确认。`,
      relatedType: 'order',
      relatedId: orderId
    });

    await connection.commit();

    res.json(success({ planId: result.insertId, version: nextVersion }, '设计方案提交成功'));
  } catch (err) {
    await connection.rollback();
    console.error('提交设计方案错误:', err);
    res.json(error('提交设计方案失败'));
  } finally {
    connection.release();
  }
};

const generateMaterialList = async (orderId, designPlanId, connection) => {
  const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orders[0];

  const area = order.house_area || 100;

  const materialTemplates = [
    { name: '颗粒板柜体', category: '板材', spec: '18mm E0级', unit: '㎡', pricePerUnit: 680, ratio: 0.35, supplier: '兔宝宝' },
    { name: '模压门板', category: '板材', spec: '吸塑模压', unit: '㎡', pricePerUnit: 850, ratio: 0.28, supplier: '索菲亚' },
    { name: '石英石台面', category: '石材', spec: '20mm厚', unit: 'm', pricePerUnit: 1200, ratio: 0.08, supplier: '中迅' },
    { name: '五金配件', category: '五金', spec: 'DTC铰链', unit: '套', pricePerUnit: 85, ratio: 0.25, supplier: 'DTC' },
    { name: '乳胶漆', category: '涂料', spec: '多乐士竹炭', unit: '桶', pricePerUnit: 380, ratio: 0.1, supplier: '多乐士' }
  ];

  let totalCost = 0;
  const materialItems = [];

  materialTemplates.forEach((item, index) => {
    const quantity = Math.round(area * item.ratio * 100) / 100;
    const totalPrice = Math.round(quantity * item.pricePerUnit * 100) / 100;
    totalCost += totalPrice;

    materialItems.push({
      ...item,
      quantity,
      totalPrice,
      sortOrder: index + 1
    });
  });

  const laborCost = Math.round(totalCost * 0.5 * 100) / 100;
  const managementFee = Math.round(totalCost * 0.3 * 100) / 100;
  const totalPrice = Math.round((totalCost + laborCost + managementFee) * 100) / 100;

  const [mlResult] = await connection.query(
    `INSERT INTO material_lists (order_id, design_plan_id, total_cost, labor_cost, management_fee, total_price)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, designPlanId, totalCost, laborCost, managementFee, totalPrice]
  );

  const materialListId = mlResult.insertId;

  for (const item of materialItems) {
    await connection.query(
      `INSERT INTO material_items (material_list_id, name, category, spec, unit, quantity, unit_price, total_price, supplier, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [materialListId, item.name, item.category, item.spec, item.unit, item.quantity, item.pricePerUnit, item.totalPrice, item.supplier, item.sortOrder]
    );
  }

  await connection.query(
    'UPDATE orders SET total_price = ? WHERE id = ?',
    [totalPrice, orderId]
  );

  return { materialListId, totalCost, laborCost, managementFee, totalPrice, materialItems };
};

const getDesignPlans = async (req, res) => {
  try {
    const { orderId } = req.query;

    const [plans] = await pool.query(
      'SELECT * FROM design_plans WHERE order_id = ? ORDER BY version DESC',
      [orderId]
    );

    res.json(success(plans));
  } catch (err) {
    console.error('获取设计方案错误:', err);
    res.json(error('获取设计方案失败'));
  }
};

const getDesignPlanDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [plans] = await pool.query('SELECT * FROM design_plans WHERE id = ?', [id]);
    if (plans.length === 0) {
      return res.json(error('设计方案不存在', 404));
    }

    const plan = plans[0];

    const [materialLists] = await pool.query(
      'SELECT * FROM material_lists WHERE design_plan_id = ? ORDER BY generated_at DESC LIMIT 1',
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

    res.json(success({
      plan,
      materialList: materialLists[0] || null,
      materialItems
    }));
  } catch (err) {
    console.error('获取设计方案详情错误:', err);
    res.json(error('获取设计方案详情失败'));
  }
};

const confirmDesignPlan = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { confirmed } = req.body;

    const [plans] = await connection.query('SELECT * FROM design_plans WHERE id = ?', [id]);
    if (plans.length === 0) {
      return res.json(error('设计方案不存在', 404));
    }

    const plan = plans[0];

    if (confirmed) {
      await connection.query(
        "UPDATE design_plans SET status = 'approved', approved_at = NOW() WHERE id = ?",
        [id]
      );

      await connection.query(
        "UPDATE orders SET status = 'pending_payment' WHERE id = ?",
        [plan.order_id]
      );

      const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [plan.order_id]);
      const order = orders[0];

      await createNotification({
        userId: plan.designer_id,
        type: 'design',
        title: '设计方案已通过',
        content: `客户已确认通过「${order.title}」的设计方案，待客户支付。`,
        relatedType: 'order',
        relatedId: plan.order_id
      });

      await createNotification({
        userId: order.customer_id,
        type: 'order',
        title: '请完成支付',
        content: `您已确认「${order.title}」的设计方案，请完成支付 ¥${order.total_price?.toLocaleString()} 元。`,
        relatedType: 'order',
        relatedId: plan.order_id
      });
    } else {
      await connection.query(
        "UPDATE design_plans SET status = 'rejected' WHERE id = ?",
        [id]
      );

      await connection.query(
        "UPDATE orders SET status = 'designing' WHERE id = ?",
        [plan.order_id]
      );

      const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [plan.order_id]);
      const order = orders[0];

      await createNotification({
        userId: plan.designer_id,
        type: 'design',
        title: '设计方案被驳回',
        content: `客户驳回了「${order.title}」的设计方案，请修改后重新提交。`,
        relatedType: 'order',
        relatedId: plan.order_id
      });
    }

    await connection.commit();

    res.json(success(null, confirmed ? '方案已确认，待支付' : '方案已驳回'));
  } catch (err) {
    await connection.rollback();
    console.error('确认设计方案错误:', err);
    res.json(error('操作失败'));
  } finally {
    connection.release();
  }
};

module.exports = {
  submitDesignPlan,
  getDesignPlans,
  getDesignPlanDetail,
  confirmDesignPlan,
  generateMaterialList
};
