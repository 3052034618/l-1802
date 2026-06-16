const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool(config.db);

pool.getConnection()
  .then(conn => {
    console.log('数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
  });

module.exports = pool;
