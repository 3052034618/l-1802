-- =============================================
-- 定制家居设计平台数据库设计
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS home_design_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE home_design_db;

-- =============================================
-- 1. 用户表
-- =============================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '密码(加密)',
  real_name VARCHAR(50) NOT NULL COMMENT '真实姓名',
  phone VARCHAR(20) COMMENT '手机号',
  email VARCHAR(100) COMMENT '邮箱',
  avatar VARCHAR(255) COMMENT '头像',
  role ENUM('customer', 'designer', 'production_supervisor', 'quality_inspector', 'finance') NOT NULL COMMENT '角色',
  status ENUM('active', 'disabled') DEFAULT 'active' COMMENT '状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- =============================================
-- 2. 设计师详情表
-- =============================================
DROP TABLE IF EXISTS designer_profiles;
CREATE TABLE designer_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  style_tags JSON COMMENT '风格标签',
  rating DECIMAL(3,2) DEFAULT 0 COMMENT '评分(0-5)',
  order_count INT DEFAULT 0 COMMENT '完成订单数',
  busy_level ENUM('low', 'medium', 'high') DEFAULT 'low' COMMENT '忙闲程度',
  current_task_count INT DEFAULT 0 COMMENT '当前任务数',
  bio TEXT COMMENT '个人简介',
  work_years INT DEFAULT 0 COMMENT '从业年限',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  INDEX idx_rating (rating),
  INDEX idx_busy_level (busy_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设计师详情表';

-- =============================================
-- 3. 订单表
-- =============================================
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '订单号',
  customer_id INT NOT NULL COMMENT '客户ID',
  designer_id INT COMMENT '设计师ID',
  title VARCHAR(200) NOT NULL COMMENT '订单标题',
  style_preference VARCHAR(100) COMMENT '风格偏好',
  budget DECIMAL(12,2) COMMENT '预算',
  house_type VARCHAR(50) COMMENT '户型',
  house_area DECIMAL(10,2) COMMENT '房屋面积(㎡)',
  floor_plan_url VARCHAR(255) COMMENT '户型图URL',
  description TEXT COMMENT '需求描述',
  status ENUM('pending_designer', 'designing', 'design_confirmed', 'production', 'quality_check', 'completed', 'cancelled', 'rework') DEFAULT 'pending_designer' COMMENT '订单状态',
  total_price DECIMAL(12,2) DEFAULT 0 COMMENT '总价',
  paid_amount DECIMAL(12,2) DEFAULT 0 COMMENT '已付金额',
  paid_at DATETIME COMMENT '支付时间',
  designer_assigned_at DATETIME COMMENT '设计师分配时间',
  expected_delivery_date DATE COMMENT '预计交付日期',
  actual_delivery_date DATE COMMENT '实际交付日期',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  INDEX idx_designer_id (designer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- =============================================
-- 4. 设计方案表
-- =============================================
DROP TABLE IF EXISTS design_plans;
CREATE TABLE design_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  designer_id INT NOT NULL COMMENT '设计师ID',
  version INT DEFAULT 1 COMMENT '版本号',
  title VARCHAR(200) COMMENT '方案标题',
  description TEXT COMMENT '方案描述',
  design_files JSON COMMENT '设计文件列表(3D模型、渲染图等)',
  floor_plan_3d_url VARCHAR(255) COMMENT '3D户型图',
  renderings JSON COMMENT '渲染效果图列表',
  status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft' COMMENT '状态',
  submitted_at DATETIME COMMENT '提交时间',
  approved_at DATETIME COMMENT '审批通过时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_designer_id (designer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设计方案表';

-- =============================================
-- 5. 物料清单表
-- =============================================
DROP TABLE IF EXISTS material_lists;
CREATE TABLE material_lists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  design_plan_id INT NOT NULL COMMENT '设计方案ID',
  total_cost DECIMAL(12,2) DEFAULT 0 COMMENT '物料总成本',
  labor_cost DECIMAL(12,2) DEFAULT 0 COMMENT '人工成本',
  management_fee DECIMAL(12,2) DEFAULT 0 COMMENT '管理费',
  total_price DECIMAL(12,2) DEFAULT 0 COMMENT '总报价',
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_design_plan_id (design_plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料清单表';

-- =============================================
-- 6. 物料明细表
-- =============================================
DROP TABLE IF EXISTS material_items;
CREATE TABLE material_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_list_id INT NOT NULL COMMENT '物料清单ID',
  name VARCHAR(200) NOT NULL COMMENT '物料名称',
  category VARCHAR(50) COMMENT '分类(板材、五金、涂料等)',
  spec VARCHAR(200) COMMENT '规格型号',
  unit VARCHAR(20) COMMENT '单位',
  quantity DECIMAL(10,2) NOT NULL COMMENT '数量',
  unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
  total_price DECIMAL(12,2) NOT NULL COMMENT '总价',
  supplier VARCHAR(100) COMMENT '供应商',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_material_list_id (material_list_id),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料明细表';

-- =============================================
-- 7. 生产订单表
-- =============================================
DROP TABLE IF EXISTS production_orders;
CREATE TABLE production_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  production_no VARCHAR(32) UNIQUE NOT NULL COMMENT '生产单号',
  production_line VARCHAR(50) COMMENT '产线',
  schedule_date DATE COMMENT '排产日期',
  status ENUM('pending', 'in_progress', 'paused', 'completed', 'quality_failed') DEFAULT 'pending' COMMENT '生产状态',
  progress INT DEFAULT 0 COMMENT '生产进度(0-100)',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  supervisor_id INT COMMENT '生产主管ID',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  INDEX idx_schedule_date (schedule_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产订单表';

-- =============================================
-- 8. 生产进度记录表
-- =============================================
DROP TABLE IF EXISTS production_progress_logs;
CREATE TABLE production_progress_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  production_order_id INT NOT NULL COMMENT '生产订单ID',
  progress INT NOT NULL COMMENT '进度值(0-100)',
  status VARCHAR(50) COMMENT '当前工序状态',
  description TEXT COMMENT '进度描述',
  recorded_by INT COMMENT '记录人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_production_order_id (production_order_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产进度记录表';

-- =============================================
-- 9. 质检表
-- =============================================
DROP TABLE IF EXISTS quality_inspections;
CREATE TABLE quality_inspections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  production_order_id INT NOT NULL COMMENT '生产订单ID',
  inspector_id INT COMMENT '质检员ID',
  inspection_no VARCHAR(32) UNIQUE NOT NULL COMMENT '质检单号',
  status ENUM('pending', 'passed', 'failed', 'rework') DEFAULT 'pending' COMMENT '质检状态',
  overall_score DECIMAL(3,2) COMMENT '综合评分',
  inspection_items JSON COMMENT '检测项结果',
  photos JSON COMMENT '质检照片',
  deviation_data JSON COMMENT '偏差数据',
  rework_count INT DEFAULT 0 COMMENT '返工次数',
  remark TEXT COMMENT '备注',
  inspected_at DATETIME COMMENT '质检时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_production_order_id (production_order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质检表';

-- =============================================
-- 10. 客户投诉表
-- =============================================
DROP TABLE IF EXISTS customer_complaints;
CREATE TABLE customer_complaints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  customer_id INT NOT NULL COMMENT '客户ID',
  complaint_no VARCHAR(32) UNIQUE NOT NULL COMMENT '投诉单号',
  type VARCHAR(50) COMMENT '投诉类型(质量、延期、服务等)',
  title VARCHAR(200) NOT NULL COMMENT '投诉标题',
  description TEXT COMMENT '投诉描述',
  photos JSON COMMENT '投诉照片',
  status ENUM('pending', 'processing', 'resolved', 'closed') DEFAULT 'pending' COMMENT '状态',
  responsibility ENUM('company', 'customer', 'designer', 'production', 'supplier') COMMENT '责任归属',
  compensation_plan TEXT COMMENT '赔偿方案',
  compensation_amount DECIMAL(12,2) DEFAULT 0 COMMENT '赔偿金额',
  handled_by INT COMMENT '处理人',
  handled_at DATETIME COMMENT '处理时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户投诉表';

-- =============================================
-- 11. 消息通知表
-- =============================================
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '接收用户ID',
  type VARCHAR(50) NOT NULL COMMENT '消息类型(order/design/production/complaint/system)',
  title VARCHAR(200) NOT NULL COMMENT '消息标题',
  content TEXT COMMENT '消息内容',
  related_type VARCHAR(50) COMMENT '关联类型(order/design_plan/production_order/complaint)',
  related_id INT COMMENT '关联ID',
  is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  read_at DATETIME COMMENT '阅读时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知表';

-- =============================================
-- 12. 财务报表表
-- =============================================
DROP TABLE IF EXISTS financial_reports;
CREATE TABLE financial_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_month VARCHAR(7) NOT NULL COMMENT '报表月份(YYYY-MM)',
  designer_id INT COMMENT '设计师ID(为空则是汇总)',
  order_count INT DEFAULT 0 COMMENT '订单量',
  total_output DECIMAL(12,2) DEFAULT 0 COMMENT '产值',
  complaint_count INT DEFAULT 0 COMMENT '投诉数',
  complaint_rate DECIMAL(5,2) DEFAULT 0 COMMENT '客诉率(%)',
  report_data JSON COMMENT '详细报表数据',
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_month_designer (report_month, designer_id),
  INDEX idx_report_month (report_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='财务报表表';

-- =============================================
-- 13. 支付记录表
-- =============================================
DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  payment_no VARCHAR(32) UNIQUE NOT NULL COMMENT '支付单号',
  amount DECIMAL(12,2) NOT NULL COMMENT '支付金额',
  payment_method VARCHAR(50) COMMENT '支付方式',
  status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending' COMMENT '支付状态',
  paid_at DATETIME COMMENT '支付时间',
  transaction_id VARCHAR(100) COMMENT '第三方交易号',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';
