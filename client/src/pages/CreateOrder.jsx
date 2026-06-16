import React, { useState } from 'react'
import { Card, Form, Input, Select, InputNumber, Button, Steps, message } from 'antd'
import { ArrowLeftOutlined, HomeOutlined, BulbOutlined, BankOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { createOrder } from '../api/order'

const { Step } = Steps
const { TextArea } = Input
const { Option } = Select

const CreateOrder = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)

  const steps = [
    {
      title: '户型信息',
      icon: <HomeOutlined />
    },
    {
      title: '风格偏好',
      icon: <BulbOutlined />
    },
    {
      title: '预算要求',
      icon: <BankOutlined />
    }
  ]

  const next = () => {
    setCurrent(current + 1)
  }

  const prev = () => {
    setCurrent(current - 1)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const res = await createOrder(values)
      message.success('订单创建成功，正在为您匹配设计师...')
      setTimeout(() => {
        navigate(`/orders/${res.orderId}`)
      }, 1000)
    } catch (err) {
      if (err.errorFields) {
        return
      }
      console.error('创建订单失败:', err)
    } finally {
      setLoading(false)
    }
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

      <Card className="card-shadow" title="提交定制需求">
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 600, margin: '0 auto' }}
        >
          {current === 0 && (
            <>
              <Form.Item
                name="title"
                label="订单标题"
                rules={[{ required: true, message: '请输入订单标题' }]}
              >
                <Input placeholder="例如：阳光花园三室两厅全屋定制" size="large" />
              </Form.Item>
              <Form.Item
                name="houseType"
                label="户型"
                rules={[{ required: true, message: '请选择户型' }]}
              >
                <Select placeholder="请选择户型" size="large">
                  <Option value="一室一厅">一室一厅</Option>
                  <Option value="两室一厅">两室一厅</Option>
                  <Option value="两室两厅">两室两厅</Option>
                  <Option value="三室一厅">三室一厅</Option>
                  <Option value="三室两厅">三室两厅</Option>
                  <Option value="四室两厅">四室两厅</Option>
                  <Option value="别墅">别墅</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="houseArea"
                label="房屋面积(㎡)"
                rules={[{ required: true, message: '请输入房屋面积' }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} size="large" placeholder="请输入房屋面积" />
              </Form.Item>
              <Form.Item name="description" label="需求描述">
                <TextArea rows={4} placeholder="请详细描述您的定制需求" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" onClick={next} block size="large">
                  下一步
                </Button>
              </Form.Item>
            </>
          )}

          {current === 1 && (
            <>
              <Form.Item
                name="stylePreference"
                label="风格偏好"
                rules={[{ required: true, message: '请选择风格偏好' }]}
              >
                <Select placeholder="请选择您喜欢的风格" size="large">
                  <Option value="现代简约">现代简约</Option>
                  <Option value="北欧风格">北欧风格</Option>
                  <Option value="新中式">新中式</Option>
                  <Option value="美式风格">美式风格</Option>
                  <Option value="欧式">欧式</Option>
                  <Option value="轻奢">轻奢</Option>
                  <Option value="工业风">工业风</Option>
                  <Option value="日式">日式</Option>
                </Select>
              </Form.Item>
              <Form.Item name="floorPlanUrl" label="户型图链接">
                <Input placeholder="请上传或输入户型图URL" size="large" />
              </Form.Item>
              <div style={{ display: 'flex', gap: 16 }}>
                <Form.Item style={{ flex: 1 }}>
                  <Button onClick={prev} block size="large">
                    上一步
                  </Button>
                </Form.Item>
                <Form.Item style={{ flex: 1 }}>
                  <Button type="primary" onClick={next} block size="large">
                    下一步
                  </Button>
                </Form.Item>
              </div>
            </>
          )}

          {current === 2 && (
            <>
              <Form.Item
                name="budget"
                label="预算金额(元)"
                rules={[{ required: true, message: '请输入预算金额' }]}
              >
                <InputNumber
                  min={1000}
                  max={10000000}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="请输入您的预算"
                  formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <h4 style={{ marginBottom: 8 }}>温馨提示</h4>
                <ul style={{ color: '#666', fontSize: 13, paddingLeft: 20 }}>
                  <li>系统将根据您的需求自动匹配最适合的设计师</li>
                  <li>设计师将在24小时内联系您沟通详细需求</li>
                  <li>设计方案确认后将生成详细报价单</li>
                  <li>生产过程中您可以随时查看进度</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <Form.Item style={{ flex: 1 }}>
                  <Button onClick={prev} block size="large">
                    上一步
                  </Button>
                </Form.Item>
                <Form.Item style={{ flex: 1 }}>
                  <Button type="primary" loading={loading} onClick={handleSubmit} block size="large">
                    提交需求
                  </Button>
                </Form.Item>
              </div>
            </>
          )}
        </Form>
      </Card>
    </div>
  )
}

export default CreateOrder
