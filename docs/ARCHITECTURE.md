# BeautifulLife 架构简述

## 1. 总体结构
- `client`：React 前端（界面、交互、状态展示）
- `server`：Express 后端（剧情推进、模型调用、存档）
- `server/data`：本地 JSON 存档

## 2. 核心流程
1. 前端调用 `POST /api/genesis` 生成开局信息；
2. 玩家行动后调用 `POST /api/turn` 推进回合；
3. 调用 `POST /api/save` / `GET /api/save/:id` 保存与读取。

## 3. 模型调用
- 后端统一适配多模型供应商（OpenAI / 豆包 / DeepSeek / 通义）；
- API Key 支持请求传入或环境变量读取；
- 前端只关心统一 API，不直接对接各家 SDK。

## 4. 实现重点
- 前端：保证回合交互顺畅、状态更新清晰；
- 后端：保证输出结构稳定（便于前端渲染）；
- 数据：先用 JSON 快速落地，后续可升级数据库。
