import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, Space, Modal, Form, Input, Select, Rate, message } from 'antd'
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getQualityInspectionList, createQualityInspection } from '../api/production'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const statusColors = {
  pending: 'orange',
  passed: 'green',
  failed: 'red',
  rework: 'red'
}

const statusText = {
  pending: '待质检',
  passed: '合格',
  failed: '不合格',
  rework: '返工'
}

const QualityList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    fetchData()
  }, [pagination.current, pagination.pageSize])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getQualityInspectionList({
        page: pagination.current,
        pageSize: pagination.pageSize
      })
      setData(res.list || [])
      setPagination(prev => ({ ...prev, total: res.total || 0 }))
    } catch (err) {
      console.error('获取质检列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '质检单号',
      dataIndex: 'inspection_no',
      width: 140,
    },
    {
      title: '订单标题',
      dataIndex: 'order_title',
      ellipsis: true,
    },
    {
      title: '质检员',
      dataIndex: 'inspector_name',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '评分',
      dataIndex: 'overall_score',
      width: 120,
      render: (score) => score ? (
        <span>
          <Rate disabled defaultValue={score / 20} count={5} style={{ fontSize: 14 }} />
          <span style={{ marginLeft: 8 }}>{score}分</span>
        </span>
      ) : '-'
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
      title: '质检时间',
      dataIndex: 'inspected_at',
      width: 160,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'
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
            查看
          </Button>
        </Space>
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
        title="质检管理"
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

export default QualityList
