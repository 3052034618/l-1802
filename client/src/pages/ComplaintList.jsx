import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, Space, Modal, Form, Input, Select, message } from 'antd'
import { EyeOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getComplaintList, handleComplaint } from '../api/complaint'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const statusColors = {
  pending: 'orange',
  processing: 'blue',
  resolved: 'green',
  closed: 'default'
}

const statusText = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭'
}

const typeText = {
  quality: '质量问题',
  delay: '延期交付',
  service: '服务态度',
  other: '其他问题'
}

const ComplaintList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [pagination.current, pagination.pageSize])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getComplaintList({
        page: pagination.current,
        pageSize: pagination.pageSize
      })
      setData(res.list || [])
      setPagination(prev => ({ ...prev, total: res.total || 0 }))
    } catch (err) {
      console.error('获取投诉列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '投诉单号',
      dataIndex: 'complaint_no',
      width: 140,
    },
    {
      title: '投诉标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type) => typeText[type] || type
    },
    {
      title: '关联订单',
      dataIndex: 'order_title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 100,
    },
    {
      title: '责任归属',
      dataIndex: 'responsibility',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '赔偿金额',
      dataIndex: 'compensation_amount',
      width: 100,
      render: (amount) => amount > 0 ? `¥${amount.toLocaleString()}` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>
          {statusText[status]}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.order_id}`)}
          >
            查看订单
          </Button>
          {user?.role !== 'customer' && record.status !== 'resolved' && record.status !== 'closed' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelectedId(record.id)
                form.resetFields()
                setModalVisible(true)
              }}
            >
              处理
            </Button>
          )}
        </Space>
      )
    }
  ]

  const handleTableChange = (page) => {
    setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize }))
  }

  const handleSubmit = async (values) => {
    try {
      await handleComplaint(selectedId, values)
      message.success('处理成功')
      setModalVisible(false)
      fetchData()
    } catch (err) {
      console.error('处理失败:', err)
    }
  }

  return (
    <div className="page-container">
      <Card
        className="card-shadow"
        title="投诉管理"
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="处理投诉"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="status"
            label="处理状态"
            rules={[{ required: true, message: '请选择处理状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="processing">处理中</Option>
              <Option value="resolved">已解决</Option>
              <Option value="closed">已关闭</Option>
            </Select>
          </Form.Item>
          <Form.Item name="responsibility" label="责任归属">
            <Select placeholder="请选择责任方">
              <Option value="company">公司责任</Option>
              <Option value="customer">客户原因</Option>
              <Option value="designer">设计师责任</Option>
              <Option value="production">生产责任</Option>
              <Option value="supplier">供应商责任</Option>
            </Select>
          </Form.Item>
          <Form.Item name="compensationAmount" label="赔偿金额(元)">
            <Input type="number" placeholder="请输入赔偿金额" />
          </Form.Item>
          <Form.Item name="compensationPlan" label="赔偿方案说明">
            <TextArea rows={3} placeholder="请描述赔偿方案" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认处理
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ComplaintList
