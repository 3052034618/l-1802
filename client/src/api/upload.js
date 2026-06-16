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

const getBaseURL = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
}

export const getFileUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const base = getBaseURL()
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`
}

export const downloadFile = (url, originalName) => {
  if (!url) return
  try {
    const base = getBaseURL()
    const token = localStorage.getItem('token') || ''
    const fullUrl = `${base}/api/upload/download?url=${encodeURIComponent(url)}${originalName ? `&name=${encodeURIComponent(originalName)}` : ''}`
    const link = document.createElement('a')
    link.href = fullUrl
    if (token) {
      link.href += (fullUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`
    }
    link.download = originalName || ''
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('下载文件失败:', err)
    window.open(getFileUrl(url), '_blank')
  }
}

export const previewFile = (url) => {
  if (!url) return
  try {
    const base = getBaseURL()
    const fullUrl = `${base}/api/upload/preview?url=${encodeURIComponent(url)}`
    window.open(fullUrl, '_blank')
  } catch (err) {
    console.error('预览文件失败:', err)
    window.open(getFileUrl(url), '_blank')
  }
}

