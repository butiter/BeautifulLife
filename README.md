# BeautifulLife

BeautifulLife 是一个 **AI 文字跑团/冒险游戏**。你将扮演一名在未知世界中求生与成长的角色，通过输入行动（例如“潜入哨站”“交涉”“战斗”）推进剧情，完成主线与支线任务。

这个项目面向玩家与体验者：
- 你可以快速创建角色与世界背景；
- AI 会生成任务、事件、状态变化与剧情反馈；
- 你可以持续“打一局”并保存进度。

---

## 这是什么游戏？

一句话：**可交互的 AI 跑团游戏 Demo**。

游戏流程：
1. 设定世界观与角色信息；
2. 进入「创世纪」生成初始剧情与任务；
3. 每回合输入行动，AI 返回结果并推进故事；
4. 观察角色属性、任务进度、地图与日志；
5. 随时保存/读取存档继续冒险。

适合喜欢：
- 文字冒险
- DND/跑团叙事
- AI 剧情生成

---

## 快速开始

> 需要 Node.js 18+

### Windows
```bat
run_game.bat
```

### macOS / Linux
```bash
bash run_game.sh
```

启动后：
- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

---

## 手动启动（开发模式）

### 1) 启动后端
```bash
cd server
npm install
npm run dev
```

### 2) 启动前端
```bash
cd client
npm install
npm run dev
```

如需修改后端地址，在 `client/.env` 中配置：
```bash
VITE_API_BASE=http://localhost:3001
```

---

## 玩家使用说明

1. 打开游戏页面后，先填写角色描述与世界设定；
2. 在模型设置中选择可用模型并填入 API Key（按你使用的平台填写）；
3. 点击开始创世纪；
4. 每回合输入你的行动，或直接选择推荐行动；
5. 持续推进剧情，完成任务链；
6. 点击保存，后续可读取继续游玩。

---

## API（给开发者）

- `POST /api/genesis`：生成初始角色/世界/任务
- `POST /api/turn`：推进一回合
- `POST /api/save`：保存进度
- `GET /api/save/:id`：读取存档
- `POST /api/task-gene`：生成任务扩展内容

---

## 安全说明（API Key）

- 不要把真实 API Key 写死在代码或提交到仓库；
- 建议使用环境变量或运行时输入；
- 本仓库已排查，未发现硬编码的真实密钥。

