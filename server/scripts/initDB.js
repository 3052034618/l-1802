const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initDB = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('正在创建数据库...');
    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    const statements = schemaSQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt);
      }
    }

    console.log('数据库表结构创建成功');

    console.log('正在初始化数据...');
    const seedPath = path.join(__dirname, '../sql/seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    await connection.query(`USE ${process.env.DB_NAME || 'home_design_db'}`);
    
    const seedStatements = seedSQL.split(';').filter(s => s.trim());
    for (const stmt of seedStatements) {
      if (stmt.trim()) {
        await connection.query(stmt);
      }
    }

    console.log('初始数据导入成功');

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('上传目录创建成功');
    }

    await connection.end();
    console.log('数据库初始化完成！');
    
    console.log('\n测试账号：');
    console.log('  客户: customer001 / 123456');
    console.log('  设计师: designer001 / 123456');
    console.log('  生产主管: supervisor001 / 123456');
    console.log('  质检员: inspector001 / 123456');
    console.log('  财务: finance001 / 123456');

  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    process.exit(1);
  }
};

initDB();
