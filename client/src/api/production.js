import request from '../utils/request'

export const scheduleProduction = (data) => {
  return request.post('/productions/schedule', data)
}

export const updateProductionProgress = (id, data) => {
  return request.put(`/productions/${id}/progress`, data)
}

export const getProductionList = (params) => {
  return request.get('/productions', { params })
}

export const getProductionDetail = (id) => {
  return request.get(`/productions/${id}`)
}

export const getWorkshopCapacity = () => {
  return request.get('/productions/workshop/capacity')
}

export const createQualityInspection = (data) => {
  return request.post('/productions/quality', data)
}

export const getQualityInspectionList = (params) => {
  return request.get('/productions/quality/list', { params })
}
