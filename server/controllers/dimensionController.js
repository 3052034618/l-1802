const pool = require('../db');
const { success, error } = require('../utils/response');

const getDesignDimensions = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [dimensions] = await pool.query(
      `SELECT * FROM design_dimensions 
       WHERE order_id = ? 
       ORDER BY item_name, part_name, sort_order`,
      [orderId]
    );

    res.json(success(dimensions));
  } catch (err) {
    console.error('获取设计尺寸错误:', err);
    res.json(error('获取设计尺寸失败'));
  }
};

const addDesignDimensions = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, designPlanId, dimensions } = req.body;

    for (const dim of dimensions) {
      await connection.query(
        `INSERT INTO design_dimensions 
         (design_plan_id, order_id, item_name, part_name, dimension_type, design_value, tolerance, unit, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [designPlanId, orderId, dim.itemName, dim.partName || null, dim.dimensionType, 
         dim.designValue, dim.tolerance || 2.0, dim.unit || 'mm', dim.sortOrder || 0]
      );
    }

    await connection.commit();
    res.json(success(null, '尺寸数据添加成功'));
  } catch (err) {
    await connection.rollback();
    console.error('添加设计尺寸错误:', err);
    res.json(error('添加设计尺寸失败'));
  } finally {
    connection.release();
  }
};

module.exports = {
  getDesignDimensions,
  addDesignDimensions
};
