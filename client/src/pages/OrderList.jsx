import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Space, Tag, Input, Select, DatePicker } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getOrderList } from '../api/order'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select

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

const OrderList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '', keyword: '' })

  useEffect(() => {
    fetchData()
  }, [pagination.current, pagination.pageSize, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getOrderList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: filters.status || undefined,
        keyword: filters.keyword || undefined
      })
      setData(res.list || [])
      setPagination(prev => ({ ...prev, total: res.total || 0 }))
    } catch (err) {
      console.error('获取订单列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 160,
    },
    {
      title: '订单标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 100,
      hidden: user?.role === 'customer'
    },
    {
      title: '设计师',
      dataIndex: 'designer_name',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '风格',
      dataIndex: 'style_preference',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '预算(元)',
      dataIndex: 'budget',
      width: 120,
      render: (val) => val ? `¥${val.toLocaleString()}` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
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
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record.id}`)}
        >
          查看
        </Button>
      )
    }
  ].filter(col => !col.hidden)

  const handleTableChange = (page) => {
    setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize }))
  }

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, keyword: value }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleStatusChange = (value) => {
    setFilters(prev => ({ ...prev, status: value }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  return (
    <div className="page-container">
      <Card
        className="card-shadow"
        title="订单管理"
        extra={
          <Space>
            {user?.role === 'customer' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/create-order')}
              >
                提交需求
              </Button>
            )}
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索订单号/标题"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: 250 }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            onChange={handleStatusChange}
          >
            <Option value="pending_designer">待分配设计师</Option>
            <Option value="designing">设计中</Option>
            <Option value="design_confirmed">设计已确认</Option>
            <Option value="production">生产中</Option>
            <Option value="quality_check">质检中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
            <Option value="rework">返工中</Option>
          </Select>
          <Button onClick={() => {
            setFilters({ status: '', keyword: '' })
            setPagination(prev => ({ ...prev, current: 1 }))
          }}>
            重置
          </Button>
        </Space>

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

export default OrderList
