import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Tabs, Select } from 'antd'
import { UserOutlined, LockOutlined, HomeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api/auth'
import { useUserStore } from '../store'

const { Option } = Select

const Login = () => {
  const navigate = useNavigate()
  const setToken = useUserStore(state => state.setToken)
  const setUser = useUserStore(state => state.setUser)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')

  const handleLogin = async (values) => {
    setLoading(true)
    try {
      const res = await login(values)
      setToken(res.token)
      setUser(res.user)
      message.success('登录成功')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('登录失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values) => {
    setLoading(true)
    try {
      await register(values)
      message.success('注册成功，请登录')
      setActiveTab('login')
    } catch (err) {
      console.error('注册失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loginItems = [
    {
      label: '登录',
      key: 'login',
    },
    {
      label: '注册',
      key: 'register',
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 420,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          borderRadius: 12
        }}
        title={
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#1677ff' }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            定制家居设计平台
          </div>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={loginItems}
          centered
        />
        
        {activeTab === 'login' && (
          <Form
            name="login"
            onFinish={handleLogin}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              <p>测试账号：customer001 / designer001 / supervisor001</p>
              <p>密码：123456</p>
            </div>
          </Form>
        )}

        {activeTab === 'register' && (
          <Form
            name="register"
            onFinish={handleRegister}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3位' }
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item
              name="realName"
              rules={[{ required: true, message: '请输入真实姓名' }]}
            >
              <Input placeholder="真实姓名" />
            </Form.Item>

            <Form.Item name="phone">
              <Input placeholder="手机号" />
            </Form.Item>

            <Form.Item name="email">
              <Input placeholder="邮箱" />
            </Form.Item>

            <Form.Item
              name="role"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select placeholder="请选择角色">
                <Option value="customer">客户</Option>
                <Option value="designer">设计师</Option>
                <Option value="production_supervisor">生产主管</Option>
                <Option value="quality_inspector">质检员</Option>
                <Option value="finance">财务</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  )
}

export default Login
