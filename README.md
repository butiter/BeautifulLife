# BeautifulLife

一个轻量短周期跑团 Web 游戏 demo（含前后端）。玩家可以选择世界属性、填写世界与角色描述，然后进入「创世纪」过场生成世界/角色/任务线，后续以任务链推进。

## 功能概览

- 前端：简约高端暗色 UI，创世纪过场、人物面板、任务日志、AI 选项与自定义行动输入、地图抽屉。
- 后端：提供 Genesis / Turn / Save 三个接口（模拟 LLM 输出）。
- 存档：以 JSON 文件形式保存在 `server/data/` 中。

## 本地开发

> 需要 Node.js 18+。

### Windows 一键启动

```bat
run_game.bat
```

脚本会提示输入 API Key，并自动安装依赖、同时启动前后端。

### 1) 启动后端

```bash
cd server
npm install
npm run dev
```

默认端口：`http://localhost:3001`

### 2) 启动前端

```bash
cd client
npm install
npm run dev
```

前端地址：`http://localhost:5173`

> 如需修改后端地址，可在 `client` 目录下新建 `.env`：

```bash
VITE_API_BASE=http://localhost:3001
```

## 生产部署（简易）

### 1) 构建前端

```bash
cd client
npm install
npm run build
```

### 2) 启动后端（静态托管前端）

```bash
cd ../server
npm install
npm start
```

后端会自动托管 `client/dist`，直接访问 `http://localhost:3001` 即可。

## API 说明（模拟 LLM）

- `POST /api/genesis`：生成角色、世界、任务线、初始任务。
- `POST /api/turn`：根据玩家行动推进任务。
- `POST /api/save`：保存游戏状态，返回存档编号。
- `GET /api/save/:id`：读取存档。

## 目录结构

```
.
├── client
│   └── src
│       ├── App.jsx
│       └── index.css
└── server
    ├── data
    └── index.js
```
