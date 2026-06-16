import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, Space, Modal, Form, Input, message } from 'antd'
import { EyeOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getDesignPlans, submitDesignPlan } from '../api/design'
import { useUserStore } from '../store'
import dayjs from 'dayjs'

const statusColors = {
  draft: 'default',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red'
}

const statusText = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已通过',
  rejected: '已驳回'
}

const DesignList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [pagination.current, pagination.pageSize])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getDesignPlans({
        page: pagination.current,
        pageSize: pagination.pageSize
      })
      setData(res || [])
      setPagination(prev => ({ ...prev, total: res?.length || 0 }))
    } catch (err) {
      console.error('获取设计方案列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '方案ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '方案标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      render: (v) => `V${v}`
    },
    {
      title: '关联订单',
      dataIndex: 'order_id',
      width: 100,
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
      title: '提交时间',
      dataIndex: 'submitted_at',
      width: 160,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record.order_id}`)}
        >
          查看详情
        </Button>
      )
    }
  ]

  const handleTableChange = (page) => {
    setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize }))
  }

  return (
    <div className="page-container">
      <Card
        className="card-shadow"
        title="设计方案管理"
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
    </div>
  )
}

export default DesignList
