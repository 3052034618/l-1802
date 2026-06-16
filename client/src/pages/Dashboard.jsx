import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, List, Tag, Progress } from 'antd'
import {
  ShoppingCartOutlined,
  DesignOutlined,
  ToolOutlined,
  SafetyOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useUserStore } from '../store'
import { getOrderList } from '../api/order'
import { getProductionList } from '../api/production'
import { getNotificationList } from '../api/notification'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'

const statusColors = {
  pending_designer: 'orange',
  designing: 'blue',
  design_confirmed: 'cyan',
  production: 'purple',
  quality_check: 'magenta',
  completed: 'green',
  cancelled: 'red',
  rework: 'red'
}

const statusText = {
  pending_designer: '待分配设计师',
  designing: '设计中',
  design_confirmed: '设计已确认',
  production: '生产中',
  quality_check: '质检中',
  completed: '已完成',
  cancelled: '已取消',
  rework: '返工中'
}

const Dashboard = () => {
  const user = useUserStore(state => state.user)
  const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, processing: 0, completed: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [recentNotifications, setRecentNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [orderRes, notificationRes] = await Promise.all([
        getOrderList({ page: 1, pageSize: 50 }),
        getNotificationList({ page: 1, pageSize: 5 })
      ])

      const orders = orderRes.list || []
      const pending = orders.filter(o => o.status === 'pending_designer').length
      const processing = orders.filter(o => ['designing', 'design_confirmed', 'production', 'quality_check', 'rework'].includes(o.status)).length
      const completed = orders.filter(o => o.status === 'completed').length

      setOrderStats({
        total: orderRes.total || 0,
        pending,
        processing,
        completed
      })
      setRecentOrders(orders.slice(0, 5))
      setRecentNotifications(notificationRes.list || [])
    } catch (err) {
      console.error('获取数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const getChartOption = () => {
    const days = []
    const orderData = []
    for (let i = 6; i >= 0; i--) {
      days.push(dayjs().subtract(i, 'day').format('MM-DD'))
      orderData.push(Math.floor(Math.random() * 10) + 1)
    }

    return {
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: days
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '订单数',
          type: 'line',
          smooth: true,
          data: orderData,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
                { offset: 1, color: 'rgba(22, 119, 255, 0.05)' }
              ]
            }
          },
          lineStyle: {
            color: '#1677ff',
            width: 2
          },
          itemStyle: {
            color: '#1677ff'
          }
        }
      ]
    }
  }

  const statsCards = [
    { title: '总订单数', value: orderStats.total, icon: <ShoppingCartOutlined style={{ fontSize: 24 }} />, color: '#1677ff' },
    { title: '待处理', value: orderStats.pending, icon: <ClockCircleOutlined style={{ fontSize: 24 }} />, color: '#fa8c16' },
    { title: '进行中', value: orderStats.processing, icon: <ToolOutlined style={{ fontSize: 24 }} />, color: '#722ed1' },
    { title: '已完成', value: orderStats.completed, icon: <SafetyOutlined style={{ fontSize: 24 }} />, color: '#52c41a' }
  ]

  return (
    <div className="page-container">
      <h2 className="page-header">欢迎回来，{user?.realName} 👋</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statsCards.map((stat, index) => (
          <Col xs={24} sm={12} md={6} key={index}>
            <Card className="card-shadow">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  valueStyle={{ color: stat.color, fontSize: 28 }}
                />
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${stat.color}15`,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card title="近7天订单趋势" className="card-shadow">
            <ReactECharts option={getChartOption()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="最新消息" className="card-shadow">
            <List
              dataSource={recentNotifications}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0' }}>
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13, fontWeight: item.isRead ? 'normal' : 500 }}>{item.title}</span>}
                    description={
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {dayjs(item.created_at).format('MM-DD HH:mm')}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="最近订单" className="card-shadow">
            <List
              dataSource={recentOrders}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0' }}>
                  <List.Item.Meta
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 500 }}>{item.title}</span>
                        <Tag color={statusColors[item.status]} style={{ margin: 0 }}>
                          {statusText[item.status]}
                        </Tag>
                      </div>
                    }
                    description={
                      <div style={{ fontSize: 12, color: '#999' }}>
                        订单号：{item.order_no} | 金额：¥{item.total_price?.toLocaleString()} | {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
