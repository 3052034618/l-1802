import React, { useState, useEffect } from 'react'
import { 
  Table, Card, Button, Tag, Space, Modal, Form, Input, Select, message,
  Descriptions, Divider, Upload, Row, Col, Alert
} from 'antd'
import { 
  EyeOutlined, CheckCircleOutlined, ExclamationCircleOutlined, 
  DownloadOutlined, FileTextOutlined, UploadOutlined 
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getComplaintList, handleComplaint, getComplaintDetail } from '../api/complaint'
import { uploadFile, getFileUrl, downloadFile } from '../api/upload'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const parseVouchers = (data) => {
  if (!data) return []
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (!Array.isArray(parsed)) return []
    return parsed.map(v => {
      if (typeof v === 'string') {
        return { url: v, originalName: '凭证文件' }
      }
      return v
    })
  } catch (e) {
    return []
  }
}

const getAllVouchers = (record) => {
  const customerVouchers = parseVouchers(record?.photos)
  const handlerVouchers = parseVouchers(record?.voucher_urls)
  const all = []
  customerVouchers.forEach((v, idx) => {
    all.push({ ...v, source: 'customer', sourceLabel: '客户凭证', idx: idx + 1 })
  })
  handlerVouchers.forEach((v, idx) => {
    all.push({ ...v, source: 'handler', sourceLabel: '处理凭证', idx: idx + 1 })
  })
  return all
}

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
  design: '设计问题',
  other: '其他问题'
}

const responsibilityText = {
  designer: '设计师',
  production_supervisor: '生产主管',
  quality_inspector: '质检员',
  company: '公司',
  customer: '客户',
  supplier: '供应商',
  unknown: '待确认'
}

const ComplaintList = () => {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [vouchers, setVouchers] = useState([])
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

  const openDetail = async (record) => {
    try {
      setLoading(true)
      const detail = await getComplaintDetail(record.id)
      setDetailData(detail)
      setDetailVisible(true)
    } catch (err) {
      console.error('获取投诉详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const openHandleModal = (record) => {
    setSelectedId(record.id)
    setVouchers([])
    form.setFieldsValue({
      status: 'resolved',
      finalResponsibility: record.final_responsibility || record.auto_responsibility,
      finalCompensationPlan: record.final_compensation_plan || record.auto_compensation_plan,
      finalCompensationAmount: record.final_compensation_amount != null 
        ? record.final_compensation_amount 
        : record.auto_compensation_amount
    })
    setModalVisible(true)
  }

  const columns = [
    {
      title: '投诉单号',
      dataIndex: 'complaint_no',
      width: 140,
      render: (text, record) => (
        <Button type="link" onClick={() => openDetail(record)}>
          {text}
        </Button>
      )
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
      title: '系统判定责任',
      dataIndex: 'auto_responsibility',
      width: 120,
      render: (text) => (
        <Tag color="cyan">
          {responsibilityText[text] || text || '-'}
        </Tag>
      )
    },
    {
      title: '最终责任',
      dataIndex: 'final_responsibility',
      width: 120,
      render: (text, record) => {
        if (record.status === 'pending') return <Tag color="default">待判定</Tag>
        return <Tag color="blue">{responsibilityText[text] || text || '-'}</Tag>
      }
    },
    {
      title: '赔偿金额',
      dataIndex: 'final_compensation_amount',
      width: 110,
      render: (amount, record) => {
        const finalAmount = amount != null ? amount : record.auto_compensation_amount
        const display = record.status === 'pending' ? '建议¥' : '¥'
        return finalAmount > 0 ? (
          <span style={{ color: '#f5222d', fontWeight: 500 }}>
            {display}{finalAmount.toLocaleString()}
          </span>
        ) : '-'
      }
    },
    {
      title: '凭证',
      dataIndex: 'photos',
      width: 90,
      render: (_, record) => {
        const allVouchers = getAllVouchers(record)
        if (allVouchers.length === 0) return '-'
        return (
          <Space size={4}>
            {allVouchers.slice(0, 2).map((v, idx) => (
              <Button
                key={idx}
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  downloadFile(v.url, v.originalName || `${v.sourceLabel}${idx + 1}`)
                }}
              >
                {v.sourceLabel.slice(0, 2)}
              </Button>
            ))}
            {allVouchers.length > 2 && (
              <span style={{ color: '#999', fontSize: 12 }}>+{allVouchers.length - 2}</span>
            )}
          </Space>
        )
      }
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.order_id}`)}
          >
            订单
          </Button>
          {user?.role !== 'customer' && record.status !== 'resolved' && record.status !== 'closed' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => openHandleModal(record)}
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
      const voucherUrls = vouchers
        .filter(v => v.status === 'done' && v.url)
        .map(v => ({
          url: v.url,
          originalName: v.name || v.response?.originalName || '处理凭证'
        }))
      await handleComplaint(selectedId, {
        ...values,
        voucherUrls
      })
      message.success('处理成功')
      setModalVisible(false)
      setVouchers([])
      fetchData()
    } catch (err) {
      console.error('处理失败:', err)
    }
  }

  const handleVoucherChange = async (info) => {
    const { file, fileList } = info
    
    if (file.status === 'uploading') {
      setVouchers(fileList)
      return
    }
    
    if (file.status === 'done') {
      try {
        const originFile = file.originFileObj || file
        if (!originFile) {
          setVouchers(fileList.filter(f => f.uid !== file.uid))
          return
        }
        
        const uploaded = await uploadFile('voucher', originFile)
        const updatedList = fileList.map(f => {
          if (f.uid === file.uid) {
            return {
              ...f,
              status: 'done',
              url: uploaded.url,
              name: uploaded.originalName || f.name,
              response: uploaded
            }
          }
          return f
        })
        setVouchers(updatedList)
        message.success(`「${uploaded.originalName || file.name}」上传成功`)
      } catch (err) {
        message.error(`「${file.name}」上传失败：${err?.message || '请重试'}`)
        setVouchers(fileList.filter(f => f.uid !== file.uid))
      }
      return
    }
    
    if (file.status === 'error' || file.status === 'removed') {
      setVouchers(fileList.filter(f => f.uid !== file.uid))
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
          scroll={{ x: 1400 }}
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
        title="投诉详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailData && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="投诉单号">{detailData.complaint_no}</Descriptions.Item>
              <Descriptions.Item label="投诉类型">{typeText[detailData.type] || detailData.type}</Descriptions.Item>
              <Descriptions.Item label="关联订单">{detailData.order_title}</Descriptions.Item>
              <Descriptions.Item label="订单号">{detailData.order_no}</Descriptions.Item>
              <Descriptions.Item label="投诉状态">
                <Tag color={statusColors[detailData.status]}>{statusText[detailData.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{detailData.order_amount?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="投诉标题" span={2}>{detailData.title}</Descriptions.Item>
              <Descriptions.Item label="投诉描述" span={2}>{detailData.description}</Descriptions.Item>
            </Descriptions>

            {(() => {
              const customerVouchers = parseVouchers(detailData.photos)
              if (customerVouchers.length > 0) {
                return (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ marginBottom: 8, fontWeight: 500 }}>客户上传的凭证：</p>
                    <Space wrap>
                      {customerVouchers.map((v, idx) => (
                        <Button
                          key={idx}
                          icon={<DownloadOutlined />}
                          onClick={() => downloadFile(v.url, v.originalName || `客户凭证${idx + 1}`)}
                        >
                          {v.originalName || `凭证${idx + 1}`}
                        </Button>
                      ))}
                    </Space>
                  </div>
                )
              }
              return null
            })()}

            {detailData.auto_reason && (
              <Alert
                message="系统自动判定"
                description={
                  <div>
                    <p>判定依据：{detailData.auto_reason}</p>
                    <p>责任方：<Tag color="cyan">{responsibilityText[detailData.auto_responsibility] || detailData.auto_responsibility}</Tag></p>
                    <p>赔偿方案：{detailData.auto_compensation_plan}</p>
                    <p>建议赔偿金额：<span style={{ color: '#f5222d', fontWeight: 500 }}>¥{detailData.auto_compensation_amount?.toLocaleString() || 0}</span></p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {detailData.status !== 'pending' && (
              <>
                <Divider orientation="left">最终处理结果</Divider>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="最终责任方">
                    <Tag color="blue">{responsibilityText[detailData.final_responsibility] || detailData.final_responsibility || '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="赔偿金额">
                    <span style={{ color: '#f5222d', fontWeight: 500 }}>
                      ¥{detailData.final_compensation_amount != null ? detailData.final_compensation_amount.toLocaleString() : 0}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="赔偿方案" span={2}>{detailData.final_compensation_plan || '-'}</Descriptions.Item>
                  <Descriptions.Item label="处理备注" span={2}>{detailData.handler_remark || '-'}</Descriptions.Item>
                  <Descriptions.Item label="处理人">{detailData.handler_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="处理时间">
                    {detailData.handled_at ? dayjs(detailData.handled_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                </Descriptions>

                {(() => {
                  const handlerVouchers = parseVouchers(detailData.voucher_urls)
                  if (handlerVouchers.length > 0) {
                    return (
                      <div style={{ marginTop: 16 }}>
                        <p style={{ marginBottom: 8, fontWeight: 500 }}>处理凭证：</p>
                        <Space wrap>
                          {handlerVouchers.map((v, idx) => (
                            <Button
                              key={idx}
                              type="primary"
                              icon={<DownloadOutlined />}
                              onClick={() => downloadFile(v.url, v.originalName || `处理凭证${idx + 1}`)}
                            >
                              {v.originalName || `下载凭证 ${idx + 1}`}
                            </Button>
                          ))}
                        </Space>
                      </div>
                    )
                  }
                  return null
                })()}
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        title="处理投诉"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Alert
            message="系统已自动判定，您可以复核调整"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Divider orientation="left">复核调整</Divider>
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="finalResponsibility" 
                label="最终责任方"
                rules={[{ required: true, message: '请选择责任方' }]}
              >
                <Select placeholder="请选择责任方">
                  <Option value="designer">设计师</Option>
                  <Option value="production_supervisor">生产主管</Option>
                  <Option value="quality_inspector">质检员</Option>
                  <Option value="company">公司责任</Option>
                  <Option value="customer">客户原因</Option>
                  <Option value="supplier">供应商责任</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="finalCompensationAmount" 
                label="赔偿金额(元)"
                rules={[{ required: true, message: '请输入赔偿金额' }]}
              >
                <Input type="number" placeholder="请输入赔偿金额" prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item 
            name="finalCompensationPlan" 
            label="赔偿方案说明"
            rules={[{ required: true, message: '请描述赔偿方案' }]}
          >
            <TextArea rows={2} placeholder="请描述赔偿方案" />
          </Form.Item>
          <Form.Item label="上传处理凭证">
            <Upload
              fileList={vouchers}
              onChange={handleVoucherChange}
              customRequest={({ onSuccess }) => onSuccess('ok')}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="handlerRemark" label="处理备注">
            <TextArea rows={2} placeholder="请输入处理备注（可选）" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              确认处理
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ComplaintList
