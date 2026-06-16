import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Space } from 'antd'
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  DesignOutlined,
  ToolOutlined,
  SafetyOutlined,
  MessageOutlined,
  CustomerServiceOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore, useNotificationStore } from '../store'
import { getNotificationList } from '../api/notification'
import socket from '../utils/socket'

const { Header, Sider, Content } = Layout

const roleMenus = {
  customer: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '我的订单' },
    { key: '/create-order', icon: <ShoppingCartOutlined />, label: '提交需求' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  designer: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: '/designs', icon: <DesignOutlined />, label: '设计方案' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  production_supervisor: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: '/productions', icon: <ToolOutlined />, label: '生产管理' },
    { key: '/quality', icon: <SafetyOutlined />, label: '质检管理' },
    { key: '/complaints', icon: <CustomerServiceOutlined />, label: '投诉处理' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  quality_inspector: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/quality', icon: <SafetyOutlined />, label: '质检管理' },
    { key: '/complaints', icon: <CustomerServiceOutlined />, label: '投诉处理' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  finance: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: '/complaints', icon: <CustomerServiceOutlined />, label: '投诉处理' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ]
}

const roleNames = {
  customer: '客户',
  designer: '设计师',
  production_supervisor: '生产主管',
  quality_inspector: '质检员',
  finance: '财务'
}

const MainLayout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useUserStore(state => state.user)
  const logout = useUserStore(state => state.logout)
  const unreadCount = useNotificationStore(state => state.unreadCount)
  const setUnreadCount = useNotificationStore(state => state.setUnreadCount)
  const [collapsed, setCollapsed] = useState(false)

  const menus = roleMenus[user?.role] || []

  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount()
      initSocket()
    }
  }, [user?.id])

  const initSocket = () => {
    if (socket && user?.id) {
      socket.emit('join', user.id)
      socket.on('notification', (data) => {
        setUnreadCount(unreadCount + 1)
      })
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await getNotificationList({ page: 1, pageSize: 1, isRead: false })
      setUnreadCount(res.unreadCount || 0)
    } catch (err) {
      console.error('获取未读消息数失败:', err)
    }
  }

  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout }
  ]

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {collapsed ? '家居' : '定制家居平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menus}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {roleNames[user?.role] || ''}工作台
          </div>
          <Space size={24}>
            <Badge count={unreadCount} size="small" onClick={() => navigate('/notifications')} style={{ cursor: 'pointer' }}>
              <BellOutlined style={{ fontSize: 20, color: '#666' }} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} src={user?.avatar} />
                <span>{user?.realName || user?.username}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{
          margin: 0,
          padding: 24,
          minHeight: 280,
          overflow: 'auto',
          backgroundColor: '#f0f2f5'
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
