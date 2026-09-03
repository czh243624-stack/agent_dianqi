# Transformer Inquiry Agent Server

一期询盘回复 Agent 后端，负责接收询盘、分析变压器需求、检索企业知识库、生成英文回复草稿、客户评级、客户档案沉淀和审核发送记录。

## 启动

```bash
npm install
npm run setup
npm run dev
```

导入易发式电气客户填写表整理后的公司资料与一期知识库口径：

```bash
npm run import:leeec
```

该命令只做 upsert，不会重置开发数据库。

同步易发式电气独立站公开页面到 RAG 知识库：

```bash
npm run crawl:leeec-site
```

该命令读取 `https://www.leeec.com/sitemap.xml`，抓取公开页面正文并写入资料库，重复执行会更新同一批页面。

清理早期 demo 假数据：

```bash
npm run cleanup:demo
```

该命令删除早期假客户、假询盘、假产品型号、假认证、假历史报价和 mock 邮件，保留客户表与官网采集资料。

健康检查：

```bash
curl http://127.0.0.1:3001/api/health
```

## 一期 Agent 流程

1. `POST /api/inquiries` 或渠道 webhook 创建询盘。
2. `POST /api/inquiries/:id/analyze` 触发询盘 Agent。
3. `transformerAnalyzer.ts` 判断：
   - 买家意图
   - 变压器类型
   - 应用场景
   - Rated voltage / HV / LV / Capacity / Frequency / Vector group / OLTC / Impedance / IEC standard / Installation altitude
   - 缺失参数与追问
   - A/B/C 客户等级和跟进建议
4. `knowledgeRetrieval.ts` 检索产品、认证、FAQ、交期规则、历史报价参考。
5. `customerProfile.ts` 更新客户档案并写入沟通记录。
6. `inquiryAgent.ts` 生成英文回复草稿，等待人工审核。

## 关键代码

| 文件 | 作用 |
| --- | --- |
| `src/services/inquiryAgent.ts` | Agent 编排入口 |
| `src/services/transformerAnalyzer.ts` | 变压器行业参数识别、意图判断、追问、客户评级 |
| `src/services/knowledgeRetrieval.ts` | 企业知识库检索 MVP |
| `src/services/customerProfile.ts` | 客户档案和沟通记录沉淀 |
| `src/routes/index.ts` | API 路由 |
| `prisma/schema.prisma` | 数据模型 |
| `prisma/seed.ts` | 演示产品、认证、FAQ、询盘数据 |
| `scripts/import-leeec-client-info.ts` | 导入易发式电气公司信息、产品范围、认证规则、FAQ、客户评级和渠道权限确认项 |
| `scripts/crawl-leeec-website.ts` | 从独立站 sitemap 采集公开页面，导入 RAG 资料库 |
| `scripts/cleanup-demo-data.ts` | 清理早期演示假数据，保留真实客户资料和官网公开资料 |

## 当前渠道状态

| 渠道 | 入口 | 状态 |
| --- | --- | --- |
| 手动录入 | `POST /api/inquiries` | 可用 |
| 独立站表单 | `POST /api/webhooks/website-form` | 可用 |
| 阿里国际站 | `POST /api/integrations/alibaba/sync` | Stub，等待账号权限和接口确认 |
| 发送 | `POST /api/inquiries/:id/send` | 当前为模拟发送，保留人工审核 |

## AI 模型配置

前端入口：`/ai-config`

后端接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai-config` | 查看当前 AI 配置状态，API Key 只返回脱敏状态 |
| `PUT` | `/api/ai-config` | 保存 provider、model、baseUrl、apiKey |
| `GET` | `/api/ai-config/status` | 检查模型是否已配置 |
| `GET` | `/api/ai-assistant/snapshot` | 读取 AI 助手可用的真实业务数据快照 |
| `POST` | `/api/ai-assistant/chat` | 业务数据问答助手，必须配置真实 AI API Key |

项目原则：

- 正式 AI 分析不使用规则兜底。
- API Key 未配置、API 调用失败、AI 输出格式不合格时，应直接报错。
- 一期不训练模型，通过 Prompt + 企业知识库/RAG + 严格输出格式让通用模型理解业务。
- 当前配置层已完成，下一步接真实模型适配器。

AI 助手说明：

- 左侧菜单“AI 助手”是业务数据问答入口，可询问最近 30 天询盘、客户评级、待处理事项、知识库准备情况等。
- 当前系统尚未接入订单、回款和成交金额表，所以“业绩”只能按询盘处理、客户等级和跟进状态分析。
- 问答接口不会使用规则兜底；API Key 未配置或模型失败时直接报错。

## 易发式电气客户资料导入内容

`npm run import:leeec` 会导入：

- 公司中英文名称、官网、英文站、目标市场。
- 变压器产品范围和代表型号口径。
- RAG/知识库使用规则：只能使用官方资料和人工确认内容，缺失参数必须追问。
- 认证和技术承诺规则：证书范围、有效期、适用产品必须人工核验。
- FAQ：报价前必须确认的容量、电压、频率、联结组别、调压、阻抗、标准、海拔、数量、目的地和交期。
- 报价与交期限制：价格、交期、利润、历史报价只做内部参考。
- A/B/C 客户评级规则和客户档案沉淀口径。
- 独立站 webhook 接入需求和阿里国际站权限确认清单。

## 验证命令

```bash
npm run db:seed
npx tsc --noEmit
```

分析第一条询盘：

```bash
$items = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/inquiries?pageSize=1"
$id = $items.items[0].id
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/api/inquiries/$id/analyze" -ContentType "application/json" -Body "{}"
```

## 后续接真实 AI 的位置

当前版本是本地规则 Agent，优点是不需要外部 Key 也能跑通业务闭环。后续接 LLM 时，建议只替换 `inquiryAgent.ts` 中的草稿生成部分，保留 `transformerAnalyzer.ts` 的结构化参数结果、`knowledgeRetrieval.ts` 的检索结果和人工审核流程。
