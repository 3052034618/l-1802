import request from '../utils/request'

export const uploadFile = async (type, file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  return request.post(`/upload/${type}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: onProgress
  })
}

export const uploadMultipleFiles = async (type, files, onProgress) => {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  return request.post(`/upload/multiple/${type}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: onProgress
  })
}

export const getFileUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  return url.startsWith('/') ? `${baseURL}${url}` : `${baseURL}/${url}`
}
