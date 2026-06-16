import React, { useState, useEffect } from 'react'
import { List, Card, Button, Tag, Space, Empty, message } from 'antd'
import {
  BellOutlined,
  ShoppingCartOutlined,
  DesignOutlined,
  ToolOutlined,
  SafetyOutlined,
  CustomerServiceOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getNotificationList, markNotificationRead, markAllNotificationsRead } from '../api/notification'
import { useNotificationStore } from '../store'
import dayjs from 'dayjs'

const typeIcons = {
  order: <ShoppingCartOutlined style={{ color: '#1677ff' }} />,
  design: <DesignOutlined style={{ color: '#722ed1' }} />,
  production: <ToolOutlined style={{ color: '#fa8c16' }} />,
  quality: <SafetyOutlined style={{ color: '#52c41a' }} />,
  complaint: <CustomerServiceOutlined style={{ color: '#f5222d' }} />,
  system: <BellOutlined style={{ color: '#13c2c2' }} />
}

const typeColors = {
  order: 'blue',
  design: 'purple',
  production: 'orange',
  quality: 'green',
  complaint: 'red',
  system: 'cyan'
}

const typeText = {
  order: '订单',
  design: '设计',
  production: '生产',
  quality: '质检',
  complaint: '投诉',
  system: '系统'
}

const NotificationList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const setUnreadCountStore = useNotificationStore(state => state.setUnreadCount)

  useEffect(() => {
    fetchData()
  }, [page])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getNotificationList({ page, pageSize: 20 })
      setData(res.list || [])
      setTotal(res.total || 0)
      setUnreadCount(res.unreadCount || 0)
      setUnreadCountStore(res.unreadCount || 0)
    } catch (err) {
      console.error('获取通知列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClick = async (item) => {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
        setUnreadCount(prev => prev - 1)
        setUnreadCountStore(unreadCount - 1)
        setData(prev => prev.map(n => n.id === item.id ? { ...n, is_read: 1 } : n))
      } catch (err) {
        console.error('标记已读失败:', err)
      }
    }

    if (item.related_type === 'order' && item.related_id) {
      navigate(`/orders/${item.related_id}`)
    } else if (item.related_type === 'complaint' && item.related_id) {
      navigate('/complaints')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      message.success('全部标记已读')
      setUnreadCount(0)
      setUnreadCountStore(0)
      setData(prev => prev.map(n => ({ ...n, is_read: 1 })))
    } catch (err) {
      console.error('全部标记已读失败:', err)
    }
  }

  const loadMore = page * 20 < total && (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <Button onClick={() => setPage(page + 1)} loading={loading}>
        加载更多
      </Button>
    </div>
  )

  return (
    <div className="page-container">
      <Card
        className="card-shadow"
        title={
          <Space>
            <span>消息通知</span>
            {unreadCount > 0 && <Tag color="red">{unreadCount} 条未读</Tag>}
          </Space>
        }
        extra={
          unreadCount > 0 ? (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={handleMarkAllRead}
            >
              全部标记已读
            </Button>
          ) : null
        }
      >
        {data.length === 0 && !loading ? (
          <Empty description="暂无消息" />
        ) : (
          <List
            dataSource={data}
            loading={loading}
            loadMore={loadMore}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: item.is_read ? '#fff' : '#f0f7ff',
                  padding: '16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  border: '1px solid #f0f0f0'
                }}
                onClick={() => handleClick(item)}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18
                    }}>
                      {typeIcons[item.type] || <BellOutlined />}
                    </div>
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <span style={{ fontWeight: item.is_read ? 'normal' : 500 }}>
                          {item.title}
                        </span>
                        {!item.is_read && <span style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#f5222d'
                        }} />}
                      </Space>
                      <Tag color={typeColors[item.type]} style={{ margin: 0 }}>
                        {typeText[item.type]}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <p style={{ margin: '8px 0', color: '#666' }}>{item.content}</p>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}

export default NotificationList
