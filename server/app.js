require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { initNotification } = require('./services/notificationService');
const cron = require('node-cron');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/order');
const designRoutes = require('./routes/design');
const productionRoutes = require('./routes/production');
const notificationRoutes = require('./routes/notification');
const complaintRoutes = require('./routes/complaint');

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
      "SELECT id, order_id, progress FROM production_orders WHERE status = 'in_progress'"
    );

    for (const order of inProgressOrders) {
      if (order.progress < 100) {
        const newProgress = Math.min(order.progress + Math.floor(Math.random() * 5) + 1, 100);
        
        await pool.query(
          'UPDATE production_orders SET progress = ? WHERE id = ?',
          [newProgress, order.id]
        );

        await pool.query(
          `INSERT INTO production_progress_logs (production_order_id, progress, status, description)
           VALUES (?, ?, 'auto_update', '系统自动更新进度')`,
          [order.id, newProgress]
        );

        if (newProgress >= 100) {
          await pool.query(
            "UPDATE production_orders SET status = 'completed', end_time = NOW() WHERE id = ?",
            [order.id]
          );
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
