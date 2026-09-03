# 变压器外贸 AI Agent · 询盘回复工作台

完整交接说明见 **[交接文档.md](./交接文档.md)**（流程、端口区别、演示路径、水位与下一步）。

## 启动

```bash
# 后端 API
cd server
npm install
npm run setup
npm run dev

# 前端工作台
cd demo
npm install
npm run dev
```

- 工作台：http://127.0.0.1:5173
- API：http://127.0.0.1:3001/api/health

## 已实现

- 询盘接入适配器：独立站表单 Webhook / 手动粘贴 / 阿里国际站（权限确认后替换实现）
- 演示独立站：`website-demo`（买家站表单 → `POST /api/webhooks/website-form`）
  - 启动：`cd website-demo && npm install && npm run dev`
  - 地址：http://127.0.0.1:5175
- 企业知识库：产品库、认证库、FAQ、报价规则、交期规则、历史回复、官网资料
- CRM 客户、审批记录、审计日志
- AI 语义分析询盘：理解买家意图、变压器类型、应用场景、客户等级、缺失参数和销售跟进动作
- RAG 检索企业知识库后生成英文回复草稿
- 人工审核、退回、通过和发送记录
- AI 助手：基于真实询盘/客户/知识库数据回答业务问题

## 后续接真系统

替换 `server/src/adapters/` 下对应实现即可，路由不用改：

- `websiteForm.ts` → 已可用，表单指向 `POST /api/webhooks/website-form`
- `alibaba.ts` → Alibaba Open API

## AI 配置

后端支持通过环境变量或前端 `/ai-config` 页面配置模型。正式运行必须提供可用 API Key；未配置或调用失败时，系统会直接报错，不使用规则兜底。

示例环境文件见 `server/.env.example`。不要提交真实 `.env`。
