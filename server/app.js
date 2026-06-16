require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { initNotification, batchCreateNotifications } = require('./services/notificationService');
const cron = require('node-cron');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/order');
const designRoutes = require('./routes/design');
const productionRoutes = require('./routes/production');
const notificationRoutes = require('./routes/notification');
const complaintRoutes = require('./routes/complaint');
const paymentRoutes = require('./routes/payment');
const dimensionRoutes = require('./routes/dimensions');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

initNotification(io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(config.upload.dir));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/designs', designRoutes);
app.use('/api/productions', productionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dimensions', dimensionRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', data: { timestamp: new Date().toISOString() } });
});

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`用户 ${userId} 加入房间`);
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

cron.schedule('0 */2 * * *', async () => {
  console.log('自动更新生产进度...');
  
  try {
    const [inProgressOrders] = await pool.query(
      `SELECT po.id, po.order_id, po.progress, o.title, o.customer_id, o.designer_id
       FROM production_orders po 
       INNER JOIN orders o ON po.order_id = o.id 
       WHERE po.status = 'in_progress'`
    );

    for (const prod of inProgressOrders) {
      if (prod.progress < 100) {
        const progressIncrement = Math.floor(Math.random() * 5) + 1;
        const newProgress = Math.min(prod.progress + progressIncrement, 100);
        
        await pool.query(
          'UPDATE production_orders SET progress = ? WHERE id = ?',
          [newProgress, prod.id]
        );

        const progressStages = [
          { threshold: 10, desc: '板材下料工序已完成' },
          { threshold: 25, desc: '封边工序已完成' },
          { threshold: 40, desc: '打孔工序已完成' },
          { threshold: 55, desc: '柜体组装进行中' },
          { threshold: 70, desc: '柜体组装已完成，待喷漆' },
          { threshold: 85, desc: '喷漆工序已完成，待组装' },
          { threshold: 95, desc: '成品组装中，即将完成' },
          { threshold: 100, desc: '生产全部完成，待质检' }
        ];

        let description = '生产进度正常推进中';
        for (const stage of progressStages) {
          if (newProgress >= stage.threshold && prod.progress < stage.threshold) {
            description = stage.desc;
            break;
          }
        }

        const [logResult] = await pool.query(
          `INSERT INTO production_progress_logs (production_order_id, progress, status, description)
           VALUES (?, ?, 'auto_update', ?)`,
          [prod.id, newProgress, description]
        );

        const notifications = [];
        
        notifications.push({
          userId: prod.customer_id,
          type: 'production',
          title: '生产进度更新',
          content: `您的订单「${prod.title}」生产进度已更新至 ${newProgress}%。${description}`,
          relatedType: 'order',
          relatedId: prod.order_id
        });

        if (prod.designer_id) {
          notifications.push({
            userId: prod.designer_id,
            type: 'production',
            title: '生产进度更新',
            content: `订单「${prod.title}」生产进度已更新至 ${newProgress}%。`,
            relatedType: 'order',
            relatedId: prod.order_id
          });
        }

        if (newProgress >= 100) {
          await pool.query(
            "UPDATE production_orders SET status = 'completed', end_time = NOW() WHERE id = ?",
            [prod.id]
          );

          await pool.query(
            "UPDATE orders SET status = 'quality_check' WHERE id = ?",
            [prod.order_id]
          );

          const [inspectors] = await pool.query(
            "SELECT id FROM users WHERE role = 'quality_inspector' AND status = 'active'"
          );

          for (const inspector of inspectors) {
            notifications.push({
              userId: inspector.id,
              type: 'quality',
              title: '新质检任务',
              content: `订单「${prod.title}」生产完成，待质检。`,
              relatedType: 'order',
              relatedId: prod.order_id
            });
          }
        }

        if (notifications.length > 0) {
          await batchCreateNotifications(notifications);
        }
      }
    }

    console.log('生产进度更新完成');
  } catch (err) {
    console.error('自动更新生产进度失败:', err);
  }
});

cron.schedule('0 0 1 * *', async () => {
  console.log('生成月度财务报表...');
  
  try {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const monthStr = lastMonth.toISOString().slice(0, 7);

    const [designerStats] = await pool.query(
      `SELECT 
        o.designer_id,
        COUNT(*) as order_count,
        SUM(o.total_price) as total_output,
        (SELECT COUNT(*) FROM customer_complaints cc 
         INNER JOIN orders o2 ON cc.order_id = o2.id
         WHERE o2.designer_id = o.designer_id 
         AND DATE_FORMAT(cc.created_at, '%Y-%m') = ?
        ) as complaint_count
      FROM orders o
      WHERE o.designer_id IS NOT NULL
        AND DATE_FORMAT(o.created_at, '%Y-%m') = ?
        AND o.status != 'cancelled'
      GROUP BY o.designer_id`,
      [monthStr, monthStr]
    );

    for (const stat of designerStats) {
      const complaintRate = stat.order_count > 0 
        ? ((stat.complaint_count / stat.order_count) * 100).toFixed(2) 
        : 0;

      await pool.query(
        `INSERT INTO financial_reports (report_month, designer_id, order_count, total_output, complaint_count, complaint_rate, report_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           order_count = VALUES(order_count),
           total_output = VALUES(total_output),
           complaint_count = VALUES(complaint_count),
           complaint_rate = VALUES(complaint_rate)`,
        [monthStr, stat.designer_id, stat.order_count, stat.total_output, 
         stat.complaint_count, complaintRate, JSON.stringify(stat)]
      );
    }

    console.log('月度财务报表生成完成');
  } catch (err) {
    console.error('生成月度财务报表失败:', err);
  }
});

server.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
});

module.exports = { app, server, io };
