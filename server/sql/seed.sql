-- =============================================
-- 初始化数据脚本
-- =============================================

USE home_design_db;

-- =============================================
-- 初始化用户账号 (密码都是: 123456)
-- =============================================
-- 密码哈希: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy (123456)

-- 客户
INSERT INTO users (username, password, real_name, phone, email, role, status) VALUES
('customer001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '张三', '13800138001', 'zhangsan@example.com', 'customer', 'active'),
('customer002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '李四', '13800138002', 'lisi@example.com', 'customer', 'active');

-- 设计师
INSERT INTO users (username, password, real_name, phone, email, role, status) VALUES
('designer001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '王设计', '13900139001', 'wangdesign@example.com', 'designer', 'active'),
('designer002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '李设计', '13900139002', 'lidesign@example.com', 'designer', 'active'),
('designer003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '赵设计', '13900139003', 'zhaodesign@example.com', 'designer', 'active');

-- 设计师详情
INSERT INTO designer_profiles (user_id, style_tags, rating, order_count, busy_level, current_task_count, bio, work_years) VALUES
(3, '["现代简约", "北欧", "轻奢"]', 4.8, 128, 'low', 0, '资深室内设计师，10年从业经验，擅长现代简约和北欧风格。', 10),
(4, '["中式", "新中式", "美式"]', 4.6, 96, 'medium', 3, '专注中式与新中式风格设计，传统文化与现代生活的完美融合。', 8),
(5, '["欧式", "法式", "工业风"]', 4.9, 156, 'high', 5, '顶级设计师，擅长欧式奢华风格，多次获得设计大奖。', 12);

-- 生产主管
INSERT INTO users (username, password, real_name, phone, email, role, status) VALUES
('supervisor001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '刘主管', '13700137001', 'liusuper@example.com', 'production_supervisor', 'active');

-- 质检员
INSERT INTO users (username, password, real_name, phone, email, role, status) VALUES
('inspector001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '陈质检', '13600136001', 'chencheck@example.com', 'quality_inspector', 'active');

-- 财务
INSERT INTO users (username, password, real_name, phone, email, role, status) VALUES
('finance001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '孙财务', '13500135001', 'sunfinance@example.com', 'finance', 'active');

-- =============================================
-- 示例订单
-- =============================================
INSERT INTO orders (order_no, customer_id, designer_id, title, style_preference, budget, house_type, house_area, description, status, total_price) VALUES
('ORD20240101001', 1, 3, '阳光花园三居设计', '现代简约', 150000.00, '三室两厅', 120.5, '客户希望简约大气，储物空间要充足，适合三口之家居住。', 'designing', 180000.00),
('ORD20240101002', 1, NULL, '绿城公寓两居改造', '北欧风格', 80000.00, '两室一厅', 85.0, '旧房改造，北欧风格，温馨舒适。', 'pending_designer', 0),
('ORD20240101003', 2, 4, '中式别墅全屋定制', '新中式', 500000.00, '别墅', 300.0, '独栋别墅全屋定制，新中式风格，注重品质和文化底蕴。', 'production', 580000.00);

-- =============================================
-- 示例设计方案
-- =============================================
INSERT INTO design_plans (order_id, designer_id, version, title, description, status, submitted_at) VALUES
(1, 3, 1, '阳光花园-现代简约方案V1', '整体采用灰白主色调，搭配原木色家具，营造温馨舒适的居家氛围。', 'submitted', '2024-01-02 10:00:00'),
(3, 4, 2, '中式别墅方案V2', '以木色为主调，融入传统中式元素，打造典雅大气的居住空间。', 'approved', '2024-01-05 14:30:00');

-- =============================================
-- 示例物料清单
-- =============================================
INSERT INTO material_lists (order_id, design_plan_id, total_cost, labor_cost, management_fee, total_price) VALUES
(1, 1, 100000.00, 50000.00, 30000.00, 180000.00),
(3, 2, 320000.00, 160000.00, 100000.00, 580000.00);

-- 示例物料明细
INSERT INTO material_items (material_list_id, name, category, spec, unit, quantity, unit_price, total_price, supplier, sort_order) VALUES
(1, '颗粒板柜体', '板材', '18mm E0级', '㎡', 35.0, 680.00, 23800.00, '兔宝宝', 1),
(1, '模压门板', '板材', '吸塑模压', '㎡', 28.0, 850.00, 23800.00, '索菲亚', 2),
(1, '石英石台面', '石材', '20mm厚', 'm', 8.5, 1200.00, 10200.00, '中迅', 3),
(1, '五金配件', '五金', 'DTC铰链', '套', 30.0, 85.00, 2550.00, 'DTC', 4),
(1, '乳胶漆', '涂料', '多乐士竹炭', '桶', 12.0, 380.00, 4560.00, '多乐士', 5),
(2, '实木柜体', '板材', '橡木实木', '㎡', 80.0, 1800.00, 144000.00, '百强', 1),
(2, '实木门板', '板材', '樱桃木', '㎡', 65.0, 2200.00, 143000.00, '百强', 2),
(2, '大理石台面', '石材', '天然大理石', 'm', 15.0, 2500.00, 37500.00, '金尊玉', 3);

-- =============================================
-- 示例生产订单
-- =============================================
INSERT INTO production_orders (order_id, production_no, production_line, schedule_date, status, progress, start_time, supervisor_id) VALUES
(3, 'PROD20240101003', 'A线-木工车间', '2024-01-10', 'in_progress', 65, '2024-01-10 08:00:00', 6);

-- 生产进度记录
INSERT INTO production_progress_logs (production_order_id, progress, status, description, recorded_by) VALUES
(1, 10, '下料完成', '板材下料工序已完成', 6),
(1, 25, '封边完成', '封边工序已完成', 6),
(1, 40, '打孔完成', '打孔工序已完成', 6),
(1, 55, '组装进行中', '柜体组装进行中', 6),
(1, 65, '组装完成', '柜体组装已完成，待喷漆', 6);

-- =============================================
-- 示例消息通知
-- =============================================
INSERT INTO notifications (user_id, type, title, content, related_type, related_id) VALUES
(1, 'order', '订单创建成功', '您的订单「阳光花园三居设计」已创建成功，正在为您匹配设计师...', 'order', 1),
(1, 'design', '设计方案已提交', '设计师已提交设计方案，请及时查看并确认。', 'order', 1),
(3, 'order', '新订单分配', '您有新的订单需要处理：阳光花园三居设计', 'order', 1),
(2, 'order', '订单创建成功', '您的订单「绿城公寓两居改造」已创建成功。', 'order', 2),
(6, 'production', '新生产订单', '有新的生产订单待排产：中式别墅全屋定制', 'order', 3);
