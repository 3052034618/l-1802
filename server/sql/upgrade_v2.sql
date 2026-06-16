-- =============================================
-- 数据库升级脚本 V2
-- 1. 扩展订单状态枚举
-- 2. 新增设计方案尺寸表用于质检比对
-- =============================================

USE home_design_db;

-- 修改订单状态枚举，新增待确认、待支付、待排产状态
ALTER TABLE orders 
MODIFY COLUMN status ENUM(
  'pending_designer', 
  'designing', 
  'pending_confirmation',
  'design_confirmed', 
  'pending_payment',
  'ready_for_production',
  'production', 
  'quality_check', 
  'completed', 
  'cancelled', 
  'rework'
) DEFAULT 'pending_designer' COMMENT '订单状态';

-- =============================================
-- 新增设计方案尺寸表，用于质检比对
-- =============================================
DROP TABLE IF EXISTS design_dimensions;
CREATE TABLE design_dimensions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  design_plan_id INT NOT NULL COMMENT '设计方案ID',
  order_id INT NOT NULL COMMENT '订单ID',
  item_name VARCHAR(200) NOT NULL COMMENT '构件名称(如:主卧衣柜、厨房橱柜)',
  part_name VARCHAR(200) COMMENT '部件名称(如:柜体、门板)',
  dimension_type ENUM('width', 'height', 'depth', 'thickness') NOT NULL COMMENT '尺寸类型',
  design_value DECIMAL(10,2) NOT NULL COMMENT '设计值(mm)',
  tolerance DECIMAL(10,2) DEFAULT 2.0 COMMENT '允许偏差(mm)',
  unit VARCHAR(10) DEFAULT 'mm' COMMENT '单位',
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_design_plan_id (design_plan_id),
  INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设计尺寸表';

-- =============================================
-- 新增生产排产推荐依据字段
-- =============================================
ALTER TABLE production_orders 
ADD COLUMN recommend_reason TEXT COMMENT '系统推荐依据说明' AFTER remark,
ADD COLUMN recommend_data JSON COMMENT '系统推荐计算数据' AFTER recommend_reason;

-- =============================================
-- 新增投诉自动判定字段
-- =============================================
ALTER TABLE customer_complaints
ADD COLUMN auto_responsibility ENUM('company', 'customer', 'designer', 'production', 'supplier') COMMENT '系统自动判定责任方' AFTER responsibility,
ADD COLUMN auto_compensation_amount DECIMAL(12,2) DEFAULT 0 COMMENT '系统自动判定赔偿金额' AFTER auto_responsibility,
ADD COLUMN auto_compensation_plan TEXT COMMENT '系统自动判定赔偿方案' AFTER auto_compensation_amount,
ADD COLUMN evidence_urls JSON COMMENT '处理凭证URL列表' AFTER auto_compensation_plan;

-- =============================================
-- 初始化示例设计尺寸数据
-- =============================================
INSERT INTO design_dimensions (design_plan_id, order_id, item_name, part_name, dimension_type, design_value, tolerance) VALUES
(1, 1, '主卧衣柜', '柜体', 'width', 1800.0, 2.0),
(1, 1, '主卧衣柜', '柜体', 'height', 2400.0, 2.0),
(1, 1, '主卧衣柜', '柜体', 'depth', 600.0, 1.0),
(1, 1, '主卧衣柜', '门板', 'width', 450.0, 1.0),
(1, 1, '主卧衣柜', '门板', 'height', 2390.0, 1.0),
(1, 1, '厨房橱柜', '地柜', 'width', 3200.0, 2.0),
(1, 1, '厨房橱柜', '地柜', 'height', 850.0, 1.0),
(1, 1, '厨房橱柜', '地柜', 'depth', 600.0, 1.0),
(1, 1, '厨房橱柜', '吊柜', 'width', 3000.0, 2.0),
(1, 1, '厨房橱柜', '吊柜', 'height', 700.0, 1.0),
(2, 3, '客厅电视柜', '柜体', 'width', 2400.0, 2.0),
(2, 3, '客厅电视柜', '柜体', 'height', 450.0, 1.0),
(2, 3, '客厅电视柜', '柜体', 'depth', 400.0, 1.0);

-- 更新现有订单状态以匹配新流程
UPDATE orders SET status = 'pending_confirmation' WHERE status = 'designing' AND id = 1;
UPDATE orders SET status = 'ready_for_production' WHERE status = 'design_confirmed' AND id = 3;
