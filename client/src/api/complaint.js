import request from '../utils/request'

export const createComplaint = (data) => {
  return request.post('/complaints', data)
}

export const getComplaintList = (params) => {
  return request.get('/complaints', { params })
}

export const handleComplaint = (id, data) => {
  return request.put(`/complaints/${id}/handle`, data)
}
