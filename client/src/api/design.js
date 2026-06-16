import request from '../utils/request'

export const submitDesignPlan = (data) => {
  return request.post('/designs', data)
}

export const getDesignPlans = (params) => {
  return request.get('/designs', { params })
}

export const getDesignPlanDetail = (id) => {
  return request.get(`/designs/${id}`)
}

export const confirmDesignPlan = (id, data) => {
  return request.put(`/designs/${id}/confirm`, data)
}
