const dayjs = require('dayjs');

const success = (data = null, message = '操作成功') => {
  return {
    code: 200,
    message,
    data
  };
};

const error = (message = '操作失败', code = 500) => {
  return {
    code,
    message,
    data: null
  };
};

const generateOrderNo = () => {
  return 'ORD' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generateProductionNo = () => {
  return 'PROD' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generateInspectionNo = () => {
  return 'INS' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generateComplaintNo = () => {
  return 'CMP' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const generatePaymentNo = () => {
  return 'PAY' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

module.exports = {
  success,
  error,
  generateOrderNo,
  generateProductionNo,
  generateInspectionNo,
  generateComplaintNo,
  generatePaymentNo
};
