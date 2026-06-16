import request from '../utils/request'

export const processPayment = (data) => {
  return request.post('/payments/pay', data)
}

export const getPaymentRecord = (orderId) => {
  return request.get(`/payments/${orderId}`)
}
