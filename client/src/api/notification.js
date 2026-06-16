import request from '../utils/request'

export const getNotificationList = (params) => {
  return request.get('/notifications', { params })
}

export const markNotificationRead = (id) => {
  return request.put(`/notifications/${id}/read`)
}

export const markAllNotificationsRead = () => {
  return request.put('/notifications/read/all')
}
