import React, { useState, useEffect } from 'react'
import {
  Card, Descriptions, Tag, Button, Space, Steps, Divider,
  List, Table, Modal, Form, Input, Select, Upload, Progress, message,
  DatePicker, Alert, Row, Col
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, UploadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CameraOutlined
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useUserStore } from '../store'
import { getOrderDetail, updateOrderStatus } from '../api/order'
import { submitDesignPlan, confirmDesignPlan } from '../api/design'
import { scheduleProduction, createQualityInspection, getProductionRecommend } from '../api/production'
import { createComplaint } from '../api/complaint'
import { processPayment, getPaymentRecord } from '../api/payment'
import { getDesignDimensions } from '../api/dimension'
import { uploadFile, getFileUrl } from '../api/upload'
import dayjs from 'dayjs'

const { Step } = Steps
const { TextArea } = Input
const { Option } = Select

const statusColors = {
  pending_designer: 'orange',
  designing: 'blue',
  pending_confirmation: 'cyan',
  design_confirmed: 'geekblue',
  pending_payment: 'gold',
  ready_for_production: 'purple',
  production: 'purple',
  quality_check: 'magenta',
  completed: 'green',
  cancelled: 'red',
  rework: 'red'
}

const statusText = {
  pending_designer: '待分配设计师',
  designing: '设计中',
  pending_confirmation: '待客户确认',
  design_confirmed: '设计已确认',
  pending_payment: '待支付',
  ready_for_production: '待生产排产',
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
  const [complaintVouchers, setComplaintVouchers] = useState([])
  const [paymentModalVisible, setPaymentModalVisible] = useState(false)
  const [payments, setPayments] = useState([])
  const [recommendData, setRecommendData] = useState(null)
  const [designDimensions, setDesignDimensions] = useState([])
  const [photos, setPhotos] = useState([])
  const [designDimensionsList, setDesignDimensionsList] = useState([])
  const [form] = Form.useForm()
  const [productionForm] = Form.useForm()
  const [qualityForm] = Form.useForm()
  const [complaintForm] = Form.useForm()
  const [paymentForm] = Form.useForm()

  useEffect(() => {
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const [orderRes, paymentRes] = await Promise.all([
        getOrderDetail(id),
        getPaymentRecord(id).catch(() => ({ list: [] }))
      ])
      setOrder(orderRes.order)
      setDesignPlans(orderRes.designPlans || [])
      setMaterialList(orderRes.materialList)
      setMaterialItems(orderRes.materialItems || [])
      setProductionOrders(orderRes.productionOrders || [])
      setQualityInspections(orderRes.qualityInspections || [])
      setPayments(Array.isArray(paymentRes) ? paymentRes : [])
    } catch (err) {
      console.error('获取订单详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async (values) => {
    try {
      await processPayment({
        orderId: id,
        amount: order.total_price,
        paymentMethod: values.paymentMethod
      })
      message.success('支付成功')
      setPaymentModalVisible(false)
      paymentForm.resetFields()
      fetchDetail()
    } catch (err) {
      console.error('支付失败:', err)
    }
  }

  const openProductionModal = async () => {
    try {
      setLoading(true)
      const recommend = await getProductionRecommend(id)
      setRecommendData(recommend)
      
      if (recommend?.allLinesFull) {
        message.warning('最近7天所有产线产能已满，请手动调整排产日期或选择其他方案')
        productionForm.resetFields()
      } else if (recommend?.recommended) {
        const isLineFull = recommend.allLines?.find(l => l.id === recommend.recommended.line)?.isFull
        if (!isLineFull) {
          productionForm.setFieldsValue({
            productionLine: recommend.recommended.line,
            scheduleDate: dayjs(recommend.recommended.date)
          })
        } else {
          productionForm.resetFields()
        }
      }
      
      setProductionModalVisible(true)
    } catch (err) {
      console.error('获取排产推荐失败:', err)
      message.error('获取排产推荐失败')
    } finally {
      setLoading(false)
    }
  }

  const handleQualityPhotoChange = async ({ file, fileList }) => {
    if (file.status === 'uploading') {
      setPhotos(fileList)
      return
    }
    if (file.status === 'done' || file.originFileObj) {
      try {
        const originFile = file.originFileObj || file
        const uploaded = await uploadFile('quality', originFile)
        const updatedList = fileList.map(f => {
          if (f.uid === file.uid) {
            return {
              ...f,
              status: 'done',
              url: uploaded.url,
              response: uploaded
            }
          }
          return f
        })
        setPhotos(updatedList)
      } catch (err) {
        message.error('照片上传失败')
        setPhotos(fileList.filter(f => f.uid !== file.uid))
      }
    }
  }

  const openQualityModal = async () => {
    try {
      setLoading(true)
      const dims = await getDesignDimensions(id)
      setDesignDimensions(dims || [])
      setPhotos([])
      qualityForm.resetFields()
      setQualityModalVisible(true)
    } catch (err) {
      console.error('获取设计尺寸失败:', err)
      setDesignDimensions([])
      setQualityModalVisible(true)
    } finally {
      setLoading(false)
    }
  }

  const getSteps = () => {
    const steps = [
      { title: '提交订单', description: '客户提交需求' },
      { title: '方案设计', description: '设计师设计方案' },
      { title: '确认支付', description: '客户确认并支付' },
      { title: '生产制造', description: '工厂生产加工' },
      { title: '质量检验', description: '成品质检' },
      { title: '交付完成', description: '订单完成' }
    ]

    let currentStep = 0
    const status = order?.status
    if (status === 'pending_designer') currentStep = 0
    else if (['designing', 'pending_confirmation'].includes(status)) currentStep = 1
    else if (['design_confirmed', 'pending_payment', 'ready_for_production'].includes(status)) currentStep = 2
    else if (['production', 'rework'].includes(status)) currentStep = 3
    else if (status === 'quality_check') currentStep = 4
    else if (status === 'completed') currentStep = 5

    return { steps, currentStep }
  }

  const handleSubmitDesign = async (values) => {
    try {
      const dimensions = designDimensionsList.map((dim, idx) => ({
        ...dim,
        sortOrder: idx + 1
      }))
      
      await submitDesignPlan({
        orderId: id,
        ...values,
        dimensions
      })
      message.success('设计方案提交成功')
      setDesignModalVisible(false)
      form.resetFields()
      setDesignDimensionsList([])
      fetchDetail()
    } catch (err) {
      console.error('提交设计方案失败:', err)
    }
  }

  const addDesignDimension = () => {
    setDesignDimensionsList(prev => [
      ...prev,
      {
        itemName: '',
        partName: '',
        dimensionType: 'width',
        designValue: '',
        tolerance: 2.0,
        unit: 'mm'
      }
    ])
  }

  const removeDesignDimension = (index) => {
    setDesignDimensionsList(prev => prev.filter((_, i) => i !== index))
  }

  const updateDesignDimension = (index, field, value) => {
    setDesignDimensionsList(prev => prev.map((d, i) => {
      if (i === index) {
        return { ...d, [field]: value }
      }
      return d
    }))
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
      const submitData = {
        orderId: id,
        productionLine: values.productionLine,
        scheduleDate: values.scheduleDate ? dayjs(values.scheduleDate).format('YYYY-MM-DD') : null,
        remark: values.remark,
        recommendReason: recommendData?.reasons?.join('\n'),
        recommendData: recommendData
      }
      await scheduleProduction(submitData)
      message.success('生产排产成功')
      setProductionModalVisible(false)
      productionForm.resetFields()
      setRecommendData(null)
      fetchDetail()
    } catch (err) {
      console.error('生产排产失败:', err)
    }
  }

  const handleQualityInspection = async (values) => {
    try {
      const measuredDimensions = designDimensions.map(dim => ({
        dimensionId: dim.id,
        measuredValue: parseFloat(values[`dim_${dim.id}`])
      })).filter(d => !isNaN(d.measuredValue))

      const photoUrls = photos
        .filter(p => p.status === 'done' && p.url)
        .map(p => p.url)

      const res = await createQualityInspection({
        orderId: id,
        productionOrderId: productionOrders[0]?.id,
        ...values,
        photos: photoUrls,
        measuredDimensions
      })

      if (res.hasExceededDeviation) {
        message.warning(`检测到${res.exceededItems.length}项尺寸偏差超标，系统已自动判定为返工`)
      } else {
        message.success('质检记录提交成功')
      }

      setQualityModalVisible(false)
      qualityForm.resetFields()
      setPhotos([])
      setDesignDimensions([])
      fetchDetail()
    } catch (err) {
      console.error('提交质检记录失败:', err)
    }
  }

  const handleComplaint = async (values) => {
    try {
      const voucherUrls = complaintVouchers
        .filter(v => v.status === 'done' && v.url)
        .map(v => ({
          url: v.url,
          originalName: v.name || v.response?.originalName || '凭证文件'
        }))

      await createComplaint({
        orderId: id,
        ...values,
        vouchers: voucherUrls
      })
      message.success('投诉提交成功')
      setComplaintModalVisible(false)
      complaintForm.resetFields()
      setComplaintVouchers([])
    } catch (err) {
      console.error('投诉提交失败:', err)
    }
  }

  const handleComplaintVoucherChange = async ({ file, fileList }) => {
    if (file.status === 'uploading') {
      setComplaintVouchers(fileList)
      return
    }
    if (file.status === 'done' || file.originFileObj) {
      try {
        const originFile = file.originFileObj || file
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
        setComplaintVouchers(updatedList)
      } catch (err) {
        message.error('凭证上传失败')
        setComplaintVouchers(fileList.filter(f => f.uid !== file.uid))
      }
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
            {user?.role === 'customer' && order.status === 'pending_payment' && (
              <Button type="primary" onClick={() => setPaymentModalVisible(true)}>
                立即支付
              </Button>
            )}
            {user?.role === 'production_supervisor' && order.status === 'ready_for_production' && (
              <Button type="primary" onClick={() => openProductionModal()}>
                安排生产
              </Button>
            )}
            {user?.role === 'quality_inspector' && order.status === 'quality_check' && (
              <Button type="primary" onClick={openQualityModal}>
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
            {productionOrders.map((prod) => {
              let recData = null
              try {
                recData = typeof prod.recommend_data === 'string' ? JSON.parse(prod.recommend_data) : prod.recommend_data
              } catch (e) {
                recData = null
              }
              
              return (
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
                
                {recData && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <div style={{ fontWeight: 500, color: '#389e0d', marginBottom: 8 }}>
                      <span style={{ marginRight: 4 }}>📋</span>系统排产推荐依据
                    </div>
                    <Row gutter={16} style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <div style={{ color: '#666', fontSize: 12 }}>推荐产线</div>
                        <div style={{ fontWeight: 500 }}>{recData.recommended?.lineName || recData.recommended?.line || '-'}</div>
                      </Col>
                      <Col span={8}>
                        <div style={{ color: '#666', fontSize: 12 }}>推荐日期</div>
                        <div style={{ fontWeight: 500 }}>{recData.recommended?.date || '-'}</div>
                      </Col>
                      <Col span={8}>
                        <div style={{ color: '#666', fontSize: 12 }}>推荐分数</div>
                        <div style={{ fontWeight: 500, color: '#52c41a' }}>{recData.recommended?.score || 0}分</div>
                      </Col>
                    </Row>
                    {recData.reasons && recData.reasons.length > 0 && (
                      <div>
                        <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>推荐理由：</div>
                        <ul style={{ margin: 0, paddingLeft: 20, color: '#595959', fontSize: 12 }}>
                          {recData.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {recData.materialSummary && (
                      <Row gutter={16} style={{ marginTop: 8 }}>
                        <Col span={12}>
                          <span style={{ color: '#666', fontSize: 12 }}>物料类型：</span>
                          <span style={{ fontSize: 12 }}>{recData.materialSummary.categories?.join('、') || '-'}</span>
                        </Col>
                        <Col span={12}>
                          <span style={{ color: '#666', fontSize: 12 }}>物料总数量：</span>
                          <span style={{ fontSize: 12 }}>{recData.materialSummary.totalQuantity || 0} 单位</span>
                        </Col>
                      </Row>
                    )}
                    {recData.allLines && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>各产线负载情况：</div>
                        <Space size={8} wrap>
                          {recData.allLines.map((line, idx) => (
                            <Tag key={idx} color={line.isFull ? 'red' : line.loadRate > 70 ? 'orange' : 'green'}>
                              {line.name}: {line.loadRate}% {line.isFull ? '(已满)' : `(剩${line.availableCapacity})`}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )})}
          </>
        )}

        {qualityInspections.length > 0 && (
          <>
            <Divider orientation="left">质检记录</Divider>
            <List
              dataSource={qualityInspections}
              renderItem={(item) => {
                let photos = []
                let deviationData = []
                try {
                  photos = typeof item.photos === 'string' ? JSON.parse(item.photos) : (item.photos || [])
                  deviationData = typeof item.deviation_data === 'string' ? JSON.parse(item.deviation_data) : (item.deviation_data || [])
                } catch (e) {
                  photos = []
                  deviationData = []
                }

                return (
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Space style={{ marginBottom: 12 }}>
                    <span style={{ fontWeight: 500 }}>质检单号：{item.inspection_no}</span>
                    <Tag color={item.status === 'passed' ? 'green' : item.status === 'failed' ? 'red' : 'orange'}>
                      {item.status === 'pending' ? '待质检' :
                       item.status === 'passed' ? '合格' :
                       item.status === 'failed' ? '不合格' :
                       item.status === 'rework' ? '返工' : item.status}
                    </Tag>
                    {item.overall_score && <span>评分：{item.overall_score}</span>}
                    <span style={{ color: '#999' }}>
                      {dayjs(item.inspected_at).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </Space>
                  
                  {item.remark && (
                    <div style={{ marginBottom: 8, color: '#666' }}>
                      备注：{item.remark}
                    </div>
                  )}

                  {photos.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>📷 成品照片：</div>
                      <Space wrap>
                        {photos.map((url, idx) => (
                          <a
                            key={idx}
                            href={getFileUrl(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-block' }}
                          >
                            <img
                              src={getFileUrl(url)}
                              alt={`质检照片${idx + 1}`}
                              style={{
                                width: 80,
                                height: 80,
                                objectFit: 'cover',
                                borderRadius: 4,
                                border: '1px solid #f0f0f0'
                              }}
                            />
                          </a>
                        ))}
                      </Space>
                    </div>
                  )}

                  {deviationData.length > 0 && (
                    <div>
                      <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>📐 尺寸比对结果：</div>
                      <Table
                        size="small"
                        dataSource={deviationData}
                        rowKey={(record, idx) => idx}
                        pagination={false}
                        columns={[
                          {
                            title: '部位',
                            key: 'name',
                            render: (_, record) => (
                              <span>
                                {record.itemName}
                                {record.partName && ` (${record.partName})`}
                              </span>
                            )
                          },
                          {
                            title: '类型',
                            dataIndex: 'dimensionType',
                            width: 60,
                            render: (t) => ({
                              width: '宽度',
                              height: '高度',
                              depth: '深度',
                              thickness: '厚度'
                            }[t] || t)
                          },
                          {
                            title: '设计值',
                            key: 'design',
                            width: 80,
                            render: (_, record) => `${record.designValue}${record.unit || 'mm'}`
                          },
                          {
                            title: '实测值',
                            key: 'measured',
                            width: 80,
                            render: (_, record) => `${record.measuredValue}${record.unit || 'mm'}`
                          },
                          {
                            title: '公差±',
                            key: 'tolerance',
                            width: 70,
                            render: (_, record) => `${record.tolerance}${record.unit || 'mm'}`
                          },
                          {
                            title: '偏差',
                            key: 'deviation',
                            width: 70,
                            render: (_, record) => (
                              <span style={{ color: record.isExceeded ? '#f5222d' : '#52c41a', fontWeight: record.isExceeded ? 500 : 'normal' }}>
                                {record.deviation}{record.unit || 'mm'}
                                {record.isExceeded && ' ⚠️'}
                              </span>
                            )
                          },
                          {
                            title: '结果',
                            key: 'result',
                            width: 70,
                            render: (_, record) => (
                              <Tag color={record.isExceeded ? 'red' : 'green'}>
                                {record.isExceeded ? '超标' : '合格'}
                              </Tag>
                            )
                          }
                        ]}
                      />
                    </div>
                  )}
                </Card>
              )}}
            />
          </>
        )}
      </Card>

      <Modal
        title="提交设计方案"
        open={designModalVisible}
        onCancel={() => {
          setDesignModalVisible(false)
          form.resetFields()
          setDesignDimensionsList([])
        }}
        footer={null}
        width={750}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitDesign}>
          <Form.Item name="title" label="方案标题" rules={[{ required: true, message: '请输入方案标题' }]}>
            <Input placeholder="请输入方案标题" />
          </Form.Item>
          <Form.Item name="description" label="方案描述">
            <TextArea rows={3} placeholder="请描述设计方案" />
          </Form.Item>
          <Form.Item name="floorPlan3dUrl" label="3D户型图链接">
            <Input placeholder="请输入3D户型图URL" />
          </Form.Item>
          
          <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>关键尺寸录入</span>
          </Divider>
          <Alert
            message="请录入各构件的关键设计尺寸，后续质检将自动比对实测值"
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
          />
          
          {designDimensionsList.length > 0 && (
            <Table
              size="small"
              dataSource={designDimensionsList}
              rowKey={(record, index) => index}
              pagination={false}
              columns={[
                {
                  title: '构件名称',
                  dataIndex: 'itemName',
                  width: 140,
                  render: (_, record, index) => (
                    <Input
                      size="small"
                      value={record.itemName}
                      placeholder="如:主卧衣柜"
                      onChange={(e) => updateDesignDimension(index, 'itemName', e.target.value)}
                    />
                  )
                },
                {
                  title: '部件名称',
                  dataIndex: 'partName',
                  width: 120,
                  render: (_, record, index) => (
                    <Input
                      size="small"
                      value={record.partName}
                      placeholder="如:柜体/门板"
                      onChange={(e) => updateDesignDimension(index, 'partName', e.target.value)}
                    />
                  )
                },
                {
                  title: '尺寸类型',
                  dataIndex: 'dimensionType',
                  width: 100,
                  render: (_, record, index) => (
                    <Select
                      size="small"
                      value={record.dimensionType}
                      onChange={(val) => updateDesignDimension(index, 'dimensionType', val)}
                    >
                      <Option value="width">宽度</Option>
                      <Option value="height">高度</Option>
                      <Option value="depth">深度</Option>
                      <Option value="thickness">厚度</Option>
                    </Select>
                  )
                },
                {
                  title: '设计值(mm)',
                  dataIndex: 'designValue',
                  width: 110,
                  render: (_, record, index) => (
                    <Input
                      size="small"
                      type="number"
                      step="0.1"
                      value={record.designValue}
                      placeholder="如:1800"
                      onChange={(e) => updateDesignDimension(index, 'designValue', e.target.value)}
                    />
                  )
                },
                {
                  title: '公差±(mm)',
                  dataIndex: 'tolerance',
                  width: 100,
                  render: (_, record, index) => (
                    <Input
                      size="small"
                      type="number"
                      step="0.1"
                      value={record.tolerance}
                      placeholder="默认2.0"
                      onChange={(e) => updateDesignDimension(index, 'tolerance', e.target.value)}
                    />
                  )
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 60,
                  render: (_, __, index) => (
                    <Button
                      type="link"
                      danger
                      size="small"
                      onClick={() => removeDesignDimension(index)}
                    >
                      删除
                    </Button>
                  )
                }
              ]}
              style={{ marginBottom: 12 }}
            />
          )}
          
          <Button
            type="dashed"
            block
            icon={<span style={{ fontWeight: 'bold' }}>+</span>
            onClick={addDesignDimension}
            style={{ marginBottom: 16 }}
          >
            添加尺寸项
          </Button>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              提交方案
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生产排产"
        open={productionModalVisible}
        onCancel={() => {
          setProductionModalVisible(false)
          setRecommendData(null)
        }}
        footer={null}
        width={650}
      >
        {recommendData && (
          <>
            {recommendData.allLinesFull ? (
              <Alert
                message="所有产线产能已满"
                description="最近7天内所有产线产能均已排满，请手动调整排产日期或联系调度协调其他方案。您可以手动选择有剩余产能的产线或修改排产日期。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                message="系统智能推荐"
                description={
                  <div>
                    <p style={{ marginBottom: 4 }}>
                      推荐产线：<strong>{recommendData.recommended?.lineName}</strong>
                      <Tag color="green" style={{ marginLeft: 8 }}>
                        匹配度 {recommendData.recommended?.score} 分
                      </Tag>
                    </p>
                    <p style={{ marginBottom: 4 }}>
                      推荐日期：<strong>{recommendData.recommended?.date}</strong>
                    </p>
                    <Divider style={{ margin: '8px 0' }} />
                    <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>推荐依据：</p>
                    <ul style={{ paddingLeft: 16, fontSize: 12, color: '#666' }}>
                      {recommendData.reasons?.map((reason, idx) => (
                        <li key={idx} style={{ marginBottom: 2 }}>{reason}</li>
                      ))}
                    </ul>
                    {recommendData.otherOptions?.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, color: '#666', marginTop: 8, marginBottom: 4 }}>其他可选方案：</p>
                        <ul style={{ paddingLeft: 16, fontSize: 12, color: '#999' }}>
                          {recommendData.otherOptions.map((opt, idx) => (
                            <li key={idx}>{opt.name} - {opt.reason}，推荐日期：{opt.bestDate}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>各产线负载情况</Divider>
            <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
              {recommendData.allLines?.map((line) => (
                <Col span={12} key={line.id}>
                  <Card size="small" style={{ 
                    opacity: line.isFull ? 0.5 : 1,
                    border: !recommendData.allLinesFull && recommendData.recommended?.line === line.id ? '1px solid #1677ff' : '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{line.name}</span>
                      <Tag color={line.isFull ? 'red' : line.loadRate > 70 ? 'orange' : 'green'} style={{ margin: 0 }}>
                        {line.isFull ? '已满' : `${line.loadRate}%`}
                      </Tag>
                    </div>
                    <Progress percent={line.loadRate} size="small" status={line.isFull ? 'exception' : 'active'} />
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {line.currentWorkload}/{line.capacity} 单
                      {!line.isFull && line.bestDate && ` | 最佳: ${line.bestDate}`}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}
        <Form form={productionForm} layout="vertical" onFinish={handleScheduleProduction}>
          <Form.Item name="productionLine" label="产线" rules={[{ required: true, message: '请选择产线' }]}>
            <Select placeholder="请选择产线">
              {recommendData?.allLines?.map((line) => (
                <Option 
                  key={line.id} 
                  value={line.id} 
                  disabled={line.isFull}
                  label={
                    <span>
                      {line.name}
                      <Tag color={line.isFull ? 'red' : 'green'} style={{ marginLeft: 8 }}>
                        {line.isFull ? '产能已满' : `负载${line.loadRate}%`}
                      </Tag>
                    </span>
                  }
                >
                  {line.name} ({line.isFull ? '产能已满' : `负载${line.loadRate}%`})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scheduleDate" label="排产日期" rules={[{ required: true, message: '请选择排产日期' }]}>
            <DatePicker 
              style={{ width: '100%' }} 
              minDate={dayjs()}
              format="YYYY-MM-DD"
              placeholder={recommendData?.allLinesFull ? '所有产线已满，请选择更远的日期' : '请选择排产日期'}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder={recommendData?.allLinesFull ? '请说明特殊排产原因或协调方案' : '请输入备注（可选）'} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} disabled={recommendData?.allLines?.every(l => l.isFull)}>
              {recommendData?.allLines?.every(l => l.isFull) ? '所有产线已满，无法提交' : '确认排产'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="质量检测"
        open={qualityModalVisible}
        onCancel={() => {
          setQualityModalVisible(false)
          qualityForm.resetFields()
          setPhotos([])
        }}
        footer={null}
        width={800}
      >
        <Form form={qualityForm} layout="vertical" onFinish={handleQualityInspection}>
          <Divider orientation="left" style={{ margin: '12px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>成品照片</span>
          </Divider>
          <Form.Item label="上传成品照片">
            <Upload
              listType="picture-card"
              fileList={photos}
              onChange={handleQualityPhotoChange}
              customRequest={({ onSuccess }) => onSuccess('ok')}
              multiple
              accept="image/*"
            >
              <div>
                <CameraOutlined style={{ fontSize: 24 }} />
                <div style={{ marginTop: 8 }}>上传照片</div>
              </div>
            </Upload>
          </Form.Item>

          {designDimensions.length > 0 ? (
            <>
              <Divider orientation="left" style={{ margin: '12px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>关键尺寸检测</span>
              </Divider>
              <Alert
                message="系统将自动比对实测值与设计值，偏差超过公差的将被标记"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table
                size="small"
                dataSource={designDimensions}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '部位',
                    dataIndex: 'item_name',
                    key: 'item_name',
                    render: (text, record) => (
                      <div>
                        <div>{text}</div>
                        {record.part_name && (
                          <div style={{ color: '#999', fontSize: 12 }}>{record.part_name}</div>
                        )}
                      </div>
                    )
                  },
                  {
                    title: '类型',
                    dataIndex: 'dimension_type',
                    key: 'dimension_type',
                    width: 80
                  },
                  {
                    title: '设计值',
                    key: 'design',
                    width: 100,
                    render: (_, record) => (
                      <span>
                        {record.design_value} {record.unit}
                      </span>
                    )
                  },
                  {
                    title: '公差±',
                    key: 'tolerance',
                    width: 80,
                    render: (_, record) => (
                      <span style={{ color: '#f5222d' }}>
                        {record.tolerance} {record.unit}
                      </span>
                    )
                  },
                  {
                    title: '实测值',
                    key: 'measured',
                    width: 120,
                    render: (_, record) => (
                      <Form.Item
                        name={`dim_${record.id}`}
                        style={{ margin: 0 }}
                        rules={[{ required: true, message: '请输入实测值' }]}
                      >
                        <Input
                          type="number"
                          step="0.1"
                          placeholder={`${record.unit}`}
                          suffix={record.unit}
                        />
                      </Form.Item>
                    )
                  }
                ]}
              />
            </>
          ) : (
            <Alert
              message="未找到该订单的设计尺寸数据，请手动填写质检结果"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider orientation="left" style={{ margin: '12px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>质检结论</span>
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="质检结果" rules={[{ required: true, message: '请选择质检结果' }]}>
                <Select placeholder="请选择质检结果">
                  <Option value="passed">合格</Option>
                  <Option value="failed">不合格</Option>
                  <Option value="rework">返工</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="overallScore" label="综合评分">
                <Input type="number" placeholder="0-100分" suffix="分" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注说明">
            <TextArea rows={3} placeholder="请输入质检备注" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              提交质检结果
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="订单支付"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        width={500}
      >
        {order && (
          <>
            <Card style={{ marginBottom: 16, background: '#f5f5f5' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#666', marginBottom: 8 }}>订单金额</p>
                <p style={{ fontSize: 32, fontWeight: 'bold', color: '#f5222d', margin: 0 }}>
                  ¥{order.total_price?.toLocaleString()}
                </p>
                <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                  订单号：{order.order_no}
                </p>
              </div>
            </Card>
            <Form form={paymentForm} layout="vertical" onFinish={handlePayment}>
              <Form.Item name="paymentMethod" label="支付方式" rules={[{ required: true, message: '请选择支付方式' }]}>
                <Select placeholder="请选择支付方式">
                  <Option value="alipay">支付宝</Option>
                  <Option value="wechat">微信支付</Option>
                  <Option value="bank">银行转账</Option>
                  <Option value="credit">信用卡</Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large">
                  确认支付 ¥{order.total_price?.toLocaleString()}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="发起投诉"
        open={complaintModalVisible}
        onCancel={() => {
          setComplaintModalVisible(false)
          complaintForm.resetFields()
          setComplaintVouchers([])
        }}
        footer={null}
        width={520}
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
          <Form.Item label="上传凭证（支持图片、PDF、Word、Excel等）">
            <Upload
              fileList={complaintVouchers}
              onChange={handleComplaintVoucherChange}
              customRequest={({ onSuccess }) => onSuccess('ok')}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
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
