import request from '../utils/request'

export const createOrder = (data) => {
  return request.post('/orders', data)
}

export const getOrderList = (params) => {
  return request.get('/orders', { params })
}

export const getOrderDetail = (id) => {
  return request.get(`/orders/${id}`)
}

export const updateOrderStatus = (id, data) => {
  return request.put(`/orders/${id}/status`, data)
}

export const getDesignerList = (params) => {
  return request.get('/orders/designers/list', { params })
}
