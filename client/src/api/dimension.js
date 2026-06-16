import request from '../utils/request'

export const getDesignDimensions = (orderId) => {
  return request.get(`/dimensions/${orderId}`)
}

export const addDesignDimensions = (data) => {
  return request.post('/dimensions', data)
}
