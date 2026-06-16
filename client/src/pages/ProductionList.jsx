import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, Space, Progress, Modal, Form, Input, Select, InputNumber, message } from 'antd'
import { EyeOutlined, PlayCircleOutlined, ScheduleOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getProductionList, updateProductionProgress, scheduleProduction, getWorkshopCapacity } from '../api/production'
import dayjs from 'dayjs'

const { Option } = Select

const statusColors = {
  pending: 'orange',
  in_progress: 'blue',
  paused: 'default',
  completed: 'green',
  quality_failed: 'red'
}

const statusText = {
  pending: '待生产',
  in_progress: '生产中',
  paused: '已暂停',
  completed: '已完成',
  quality_failed: '质检不合格'
}

const ProductionList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [progressModalVisible, setProgressModalVisible] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [form] = Form.useForm()
  const [scheduleForm] = Form.useForm()
  const [capacity, setCapacity] = useState([])

  useEffect(() => {
    fetchData()
    if (user?.role === 'production_supervisor') {
      fetchCapacity()
    }
  }, [pagination.current, pagination.pageSize])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getProductionList({
        page: pagination.current,
        pageSize: pagination.pageSize
      })
      setData(res.list || [])
      setPagination(prev => ({ ...prev, total: res.total || 0 }))
    } catch (err) {
      console.error('获取生产列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCapacity = async () => {
    try {
      const res = await getWorkshopCapacity()
      setCapacity(res || [])
    } catch (err) {
      console.error('获取车间产能失败:', err)
    }
  }

  const columns = [
    {
      title: '生产单号',
      dataIndex: 'production_no',
      width: 160,
    },
    {
      title: '订单标题',
      dataIndex: 'order_title',
      ellipsis: true,
    },
    {
      title: '产线',
      dataIndex: 'production_line',
      width: 140,
      render: (text) => text || '-'
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 180,
      render: (progress) => (
        <Progress percent={progress || 0} size="small" />
      )
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
      title: '排产日期',
      dataIndex: 'schedule_date',
      width: 120,
      render: (date) => date || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.order_id}`)}
          >
            详情
          </Button>
          {user?.role === 'production_supervisor' && record.status !== 'completed' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedId(record.id)
                form.setFieldsValue({
                  progress: record.progress,
                  status: record.status,
                  description: ''
                })
                setProgressModalVisible(true)
              }}
            >
              更新进度
            </Button>
          )}
        </Space>
      )
    }
  ]

  const handleTableChange = (page) => {
    setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize }))
  }

  const handleUpdateProgress = async (values) => {
    try {
      await updateProductionProgress(selectedId, values)
      message.success('进度更新成功')
      setProgressModalVisible(false)
      fetchData()
    } catch (err) {
      console.error('更新进度失败:', err)
    }
  }

  const getCapacityColor = (status) => {
    switch (status) {
      case 'idle': return 'green'
      case 'normal': return 'blue'
      case 'busy': return 'orange'
      default: return 'default'
    }
  }

  return (
    <div className="page-container">
      {user?.role === 'production_supervisor' && capacity.length > 0 && (
        <Card
          className="card-shadow"
          title="车间产能概览"
          style={{ marginBottom: 16 }}
        >
          <Space size={16} wrap>
            {capacity.map((line) => (
              <div key={line.id} style={{
                padding: '12px 20px',
                background: '#f5f5f5',
                borderRadius: 8,
                minWidth: 180
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{line.name}</span>
                  <Tag color={getCapacityColor(line.status)} style={{ margin: 0 }}>
                    {line.status === 'idle' ? '空闲' : line.status === 'normal' ? '正常' : '繁忙'}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  当前任务：{line.current} / {line.capacity}
                </div>
                <Progress percent={Math.round(line.current / line.capacity * 100)} size="small" />
              </div>
            ))}
          </Space>
        </Card>
      )}

      <Card
        className="card-shadow"
        title="生产管理"
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
        title="更新生产进度"
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateProgress}>
          <Form.Item
            name="progress"
            label="进度(%)"
            rules={[{ required: true, message: '请输入进度值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="生产状态">
            <Select placeholder="请选择状态">
              <Option value="pending">待生产</Option>
              <Option value="in_progress">生产中</Option>
              <Option value="paused">已暂停</Option>
              <Option value="completed">已完成</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="进度说明">
            <Input.TextArea rows={3} placeholder="请描述当前进度情况" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认更新
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProductionList
