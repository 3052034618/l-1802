import React, { useState, useEffect } from 'react'
import {
  Card, Descriptions, Tag, Button, Space, Steps, Divider,
  List, Table, Modal, Form, Input, Select, Upload, Progress, message
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, UploadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CameraOutlined
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getOrderDetail, updateOrderStatus } from '../api/order'
import { submitDesignPlan, confirmDesignPlan } from '../api/design'
import { scheduleProduction, createQualityInspection } from '../api/production'
import { createComplaint } from '../api/complaint'
import dayjs from 'dayjs'

const { Step } = Steps
const { TextArea } = Input
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

const OrderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [designPlans, setDesignPlans] = useState([])
  const [materialList, setMaterialList] = useState(null)
  const [materialItems, setMaterialItems] = useState([])
  const [productionOrders, setProductionOrders] = useState([])
  const [qualityInspections, setQualityInspections] = useState([])
  const [designModalVisible, setDesignModalVisible] = useState(false)
  const [productionModalVisible, setProductionModalVisible] = useState(false)
  const [qualityModalVisible, setQualityModalVisible] = useState(false)
  const [complaintModalVisible, setComplaintModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [productionForm] = Form.useForm()
  const [qualityForm] = Form.useForm()
  const [complaintForm] = Form.useForm()

  useEffect(() => {
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await getOrderDetail(id)
      setOrder(res.order)
      setDesignPlans(res.designPlans || [])
      setMaterialList(res.materialList)
      setMaterialItems(res.materialItems || [])
      setProductionOrders(res.productionOrders || [])
      setQualityInspections(res.qualityInspections || [])
    } catch (err) {
      console.error('获取订单详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSteps = () => {
    const steps = [
      { title: '提交订单', description: '客户提交需求' },
      { title: '方案设计', description: '设计师设计方案' },
      { title: '生产制造', description: '工厂生产加工' },
      { title: '质量检验', description: '成品质检' },
      { title: '交付完成', description: '订单完成' }
    ]

    let currentStep = 0
    const status = order?.status
    if (status === 'pending_designer') currentStep = 0
    else if (['designing', 'design_confirmed'].includes(status)) currentStep = 1
    else if (['production', 'rework'].includes(status)) currentStep = 2
    else if (status === 'quality_check') currentStep = 3
    else if (status === 'completed') currentStep = 4

    return { steps, currentStep }
  }

  const handleSubmitDesign = async (values) => {
    try {
      await submitDesignPlan({
        orderId: id,
        ...values
      })
      message.success('设计方案提交成功')
      setDesignModalVisible(false)
      form.resetFields()
      fetchDetail()
    } catch (err) {
      console.error('提交设计方案失败:', err)
    }
  }

  const handleConfirmDesign = async (planId, confirmed) => {
    try {
      await confirmDesignPlan(planId, { confirmed })
      message.success(confirmed ? '方案已确认' : '方案已驳回')
      fetchDetail()
    } catch (err) {
      console.error('操作失败:', err)
    }
  }

  const handleScheduleProduction = async (values) => {
    try {
      await scheduleProduction({
        orderId: id,
        ...values
      })
      message.success('生产排产成功')
      setProductionModalVisible(false)
      productionForm.resetFields()
      fetchDetail()
    } catch (err) {
      console.error('生产排产失败:', err)
    }
  }

  const handleQualityInspection = async (values) => {
    try {
      await createQualityInspection({
        orderId: id,
        productionOrderId: productionOrders[0]?.id,
        ...values
      })
      message.success('质检记录提交成功')
      setQualityModalVisible(false)
      qualityForm.resetFields()
      fetchDetail()
    } catch (err) {
      console.error('提交质检记录失败:', err)
    }
  }

  const handleComplaint = async (values) => {
    try {
      await createComplaint({
        orderId: id,
        ...values
      })
      message.success('投诉提交成功')
      setComplaintModalVisible(false)
      complaintForm.resetFields()
    } catch (err) {
      console.error('投诉提交失败:', err)
    }
  }

  const { steps, currentStep } = getSteps()

  const materialColumns = [
    { title: '物料名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
    { title: '规格型号', dataIndex: 'spec', key: 'spec' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: '单价(元)', dataIndex: 'unit_price', key: 'unit_price', width: 100 },
    { title: '总价(元)', dataIndex: 'total_price', key: 'total_price', width: 120,
      render: (val) => `¥${val?.toLocaleString()}` }
  ]

  if (!order) {
    return <div style={{ padding: 24 }}>加载中...</div>
  }

  return (
    <div className="page-container">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Card className="card-shadow" loading={loading}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ marginBottom: 8 }}>{order.title}</h2>
            <Space>
              <Tag color={statusColors[order.status]} style={{ fontSize: 14 }}>
                {statusText[order.status]}
              </Tag>
              <span style={{ color: '#999' }}>订单号：{order.order_no}</span>
            </Space>
          </div>
          <Space>
            {user?.role === 'designer' && order.status === 'designing' && (
              <Button type="primary" onClick={() => setDesignModalVisible(true)}>
                提交设计方案
              </Button>
            )}
            {user?.role === 'production_supervisor' && order.status === 'design_confirmed' && (
              <Button type="primary" onClick={() => setProductionModalVisible(true)}>
                安排生产
              </Button>
            )}
            {user?.role === 'quality_inspector' && order.status === 'quality_check' && (
              <Button type="primary" onClick={() => setQualityModalVisible(true)}>
                质量检测
              </Button>
            )}
            {user?.role === 'customer' && order.status === 'completed' && (
              <Button type="primary" danger onClick={() => setComplaintModalVisible(true)}>
                发起投诉
              </Button>
            )}
          </Space>
        </div>

        <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

        <Divider orientation="left">订单信息</Divider>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="客户">{order.customer_name}</Descriptions.Item>
          <Descriptions.Item label="设计师">{order.designer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="风格偏好">{order.style_preference || '-'}</Descriptions.Item>
          <Descriptions.Item label="户型">{order.house_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="面积">{order.house_area ? `${order.house_area}㎡` : '-'}</Descriptions.Item>
          <Descriptions.Item label="预算">{order.budget ? `¥${order.budget.toLocaleString()}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="订单总价">
            <span style={{ color: '#f5222d', fontWeight: 500 }}>
              ¥{order.total_price?.toLocaleString() || '待核算'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="预计交付">
            {order.expected_delivery_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="需求描述" span={3}>
            {order.description || '-'}
          </Descriptions.Item>
        </Descriptions>

        {designPlans.length > 0 && (
          <>
            <Divider orientation="left">设计方案</Divider>
            <List
              dataSource={designPlans}
              renderItem={(plan) => (
                <Card
                  size="small"
                  style={{ marginBottom: 12 }}
                  title={
                    <Space>
                      <span>{plan.title || `设计方案 V${plan.version}`}</span>
                      <Tag color={plan.status === 'approved' ? 'green' : plan.status === 'rejected' ? 'red' : 'blue'}>
                        {plan.status === 'draft' ? '草稿' :
                         plan.status === 'submitted' ? '已提交' :
                         plan.status === 'approved' ? '已通过' : '已驳回'}
                      </Tag>
                    </Space>
                  }
                  extra={
                    user?.role === 'customer' && plan.status === 'submitted' ? (
                      <Space>
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleConfirmDesign(plan.id, true)}
                        >
                          确认
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={() => handleConfirmDesign(plan.id, false)}
                        >
                          驳回
                        </Button>
                      </Space>
                    ) : null
                  }
                >
                  <p style={{ color: '#666' }}>{plan.description || '暂无描述'}</p>
                  <p style={{ color: '#999', fontSize: 12 }}>
                    提交时间：{dayjs(plan.submitted_at).format('YYYY-MM-DD HH:mm')}
                  </p>
                </Card>
              )}
            />
          </>
        )}

        {materialList && materialItems.length > 0 && (
          <>
            <Divider orientation="left">物料清单 & 报价</Divider>
            <Table
              columns={materialColumns}
              dataSource={materialItems}
              rowKey="id"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6}>合计</Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <span style={{ color: '#f5222d', fontWeight: 500 }}>
                        ¥{materialList.total_price?.toLocaleString()}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
            <div style={{ marginTop: 12, textAlign: 'right', color: '#666', fontSize: 12 }}>
              物料成本：¥{materialList.total_cost?.toLocaleString()} | 
              人工成本：¥{materialList.labor_cost?.toLocaleString()} | 
              管理费：¥{materialList.management_fee?.toLocaleString()}
            </div>
          </>
        )}

        {productionOrders.length > 0 && (
          <>
            <Divider orientation="left">生产进度</Divider>
            {productionOrders.map((prod) => (
              <Card size="small" key={prod.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span>生产单号：{prod.production_no}</span>
                  <Tag color={prod.status === 'completed' ? 'green' : 'blue'}>
                    {prod.status === 'pending' ? '待生产' :
                     prod.status === 'in_progress' ? '生产中' :
                     prod.status === 'completed' ? '已完成' : prod.status}
                  </Tag>
                </div>
                <Progress percent={prod.progress || 0} status={prod.status === 'completed' ? 'success' : 'active'} />
                <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                  产线：{prod.production_line || '-'} | 
                  排产日期：{prod.schedule_date || '-'} | 
                  开始时间：{prod.start_time ? dayjs(prod.start_time).format('YYYY-MM-DD HH:mm') : '-'}
                </div>
              </Card>
            ))}
          </>
        )}

        {qualityInspections.length > 0 && (
          <>
            <Divider orientation="left">质检记录</Divider>
            <List
              dataSource={qualityInspections}
              renderItem={(item) => (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <Space>
                    <span>质检单号：{item.inspection_no}</span>
                    <Tag color={item.status === 'passed' ? 'green' : item.status === 'failed' ? 'red' : 'orange'}>
                      {item.status === 'pending' ? '待质检' :
                       item.status === 'passed' ? '合格' :
                       item.status === 'failed' ? '不合格' :
                       item.status === 'rework' ? '返工' : item.status}
                    </Tag>
                    <span style={{ color: '#999' }}>
                      {dayjs(item.inspected_at).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </Space>
                </Card>
              )}
            />
          </>
        )}
      </Card>

      <Modal
        title="提交设计方案"
        open={designModalVisible}
        onCancel={() => setDesignModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitDesign}>
          <Form.Item name="title" label="方案标题" rules={[{ required: true, message: '请输入方案标题' }]}>
            <Input placeholder="请输入方案标题" />
          </Form.Item>
          <Form.Item name="description" label="方案描述">
            <TextArea rows={4} placeholder="请描述设计方案" />
          </Form.Item>
          <Form.Item name="floorPlan3dUrl" label="3D户型图链接">
            <Input placeholder="请输入3D户型图URL" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交方案
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生产排产"
        open={productionModalVisible}
        onCancel={() => setProductionModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={productionForm} layout="vertical" onFinish={handleScheduleProduction}>
          <Form.Item name="productionLine" label="产线" rules={[{ required: true, message: '请选择产线' }]}>
            <Select placeholder="请选择产线">
              <Option value="A线-木工车间">A线-木工车间</Option>
              <Option value="B线-木工车间">B线-木工车间</Option>
              <Option value="C线-喷漆车间">C线-喷漆车间</Option>
              <Option value="D线-组装车间">D线-组装车间</Option>
            </Select>
          </Form.Item>
          <Form.Item name="scheduleDate" label="排产日期" rules={[{ required: true, message: '请选择排产日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认排产
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="质量检测"
        open={qualityModalVisible}
        onCancel={() => setQualityModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={qualityForm} layout="vertical" onFinish={handleQualityInspection}>
          <Form.Item name="status" label="质检结果" rules={[{ required: true, message: '请选择质检结果' }]}>
            <Select placeholder="请选择质检结果">
              <Option value="passed">合格</Option>
              <Option value="failed">不合格</Option>
              <Option value="rework">返工</Option>
            </Select>
          </Form.Item>
          <Form.Item name="overallScore" label="综合评分">
            <Input type="number" placeholder="0-100分" />
          </Form.Item>
          <Form.Item name="remark" label="备注说明">
            <TextArea rows={3} placeholder="请输入质检备注" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交质检结果
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发起投诉"
        open={complaintModalVisible}
        onCancel={() => setComplaintModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={complaintForm} layout="vertical" onFinish={handleComplaint}>
          <Form.Item name="type" label="投诉类型" rules={[{ required: true, message: '请选择投诉类型' }]}>
            <Select placeholder="请选择投诉类型">
              <Option value="quality">质量问题</Option>
              <Option value="delay">延期交付</Option>
              <Option value="service">服务态度</Option>
              <Option value="other">其他问题</Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="投诉标题" rules={[{ required: true, message: '请输入投诉标题' }]}>
            <Input placeholder="请简要描述问题" />
          </Form.Item>
          <Form.Item name="description" label="详细描述" rules={[{ required: true, message: '请输入详细描述' }]}>
            <TextArea rows={4} placeholder="请详细描述您遇到的问题" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" block>
              提交投诉
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrderDetail
