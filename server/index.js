import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const CLIENT_DIST = path.join(__dirname, '../client/dist');

const SIMULATION_DELAY = 900;

const MOCK_WORLD_CONTEXTS = [
  '在旧日的灰烬中，霓虹灯与古老的符文交织。巨型企业掌握着魔法源，而底层的黑客们试图解开神灵的防火墙。',
  '这是一个由浮空岛屿构成的世界，重力由于千年前的“大崩坏”而紊乱。飞空艇是唯一的交通工具。',
  '永夜笼罩的冰封废土，蒸汽核心提供的热量是生存的唯一货币。机械教会统治着地下避难所。'
];

const MOCK_INTRO_QUESTS = [
  '你在这个混乱的世界中醒来，头痛欲裂。你手里紧握着一枚不知名的徽章。你的直觉告诉你，必须先去“铁锈酒馆”找到老杰克。',
  '作为新晋的调查员，你的第一个任务是潜入下层区，调查关于“以太泄漏”的传闻。如果你失败了，没人会记得你。',
  '逃亡已经持续了三天。你的补给耗尽了，前方是戒备森严的边境哨所。你必须想办法通过，或者绕过去。'
];

const rng = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pick = (items) => items[rng(0, items.length - 1)];

const buildCharacter = (settings) => ({
  name: `流浪者 No.${rng(100, 999)}`,
  title: '迷失的灵魂',
  avatarSeed: rng(1, 9999),
  stats: {
    str: rng(5, 15) + (settings.physics === 'high' ? 5 : 0),
    int: rng(5, 15) + (settings.magic === 'high' ? 5 : 0),
    dex: rng(5, 15) + (settings.tech === 'high' ? 5 : 0),
    cha: rng(5, 15),
    money: rng(10, 100)
  },
  inventory: ['生锈的匕首', '半块压缩饼干', '神秘的芯片']
});

const buildWorld = (settings) => ({
  name: '艾瑞斯 · 零号扇区',
  description: settings.worldDesc || pick(MOCK_WORLD_CONTEXTS),
  factions: ['赛博神教', '废土游骑兵', '奥术辛迪加'],
  mapNodes: [
    { id: 1, name: '起始点: 贫民窟', x: 18, y: 80, type: 'start' },
    { id: 2, name: '中立区: 贸易站', x: 50, y: 50, type: 'neutral' },
    { id: 3, name: '禁区: 核心塔', x: 82, y: 18, type: 'danger' }
  ]
});

const buildFirstQuest = () => ({
  text: pick(MOCK_INTRO_QUESTS),
  options: ['低调行事，观察周围环境', '大声询问，试图寻找线索', '检查装备，准备战斗']
});

const baseTaskLine = (character, world) => [
  `【起始线】你被指派成为“${world.factions[0]}”的临时联络人，需要在一周内获取情报。`,
  `【身份】你伪装成${character.title}，携带一份未解密的数据卷轴。`,
  '【目标】侦测“核心塔”的动向，为派系争取先机。'
];

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/genesis', async (req, res) => {
  const settings = req.body || {};
  await wait(SIMULATION_DELAY);

  const character = buildCharacter(settings);
  const world = buildWorld(settings);
  const firstQuest = buildFirstQuest();

  res.json({
    character,
    world,
    taskLine: baseTaskLine(character, world),
    firstQuest
  });
});

app.post('/api/turn', async (req, res) => {
  const { action, stats } = req.body || {};
  await wait(SIMULATION_DELAY);

  const success = Math.random() > 0.4;
  const deltaMoney = success ? rng(10, 50) : -rng(0, 10);
  const newMoney = Math.max(0, (stats?.money || 0) + deltaMoney);

  const narrative = success
    ? `你的行动【${action}】取得了意想不到的成功。周围的人对你刮目相看，你发现了一些有价值的线索。`
    : `你的尝试【${action}】遇到阻碍。局势变得更加复杂，你需要更谨慎地行动。`;

  const mapUnlock = Math.random() > 0.7
    ? { id: rng(4, 99), name: '新区域: 秘密通道', x: rng(30, 70), y: rng(30, 70), type: 'secret' }
    : null;

  res.json({
    narrative,
    newOptions: ['继续深入调查', '寻找补给点休息', '尝试与当地势力接触'],
    statUpdates: {
      money: newMoney
    },
    mapUnlock
  });
});

app.post('/api/save', async (req, res) => {
  try {
    const id = nanoid(8);
    const payload = { ...req.body, savedAt: new Date().toISOString() };
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(payload, null, 2));
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: '保存失败' });
  }
});

app.get('/api/save/:id', async (req, res) => {
  try {
    const file = await fs.readFile(path.join(DATA_DIR, `${req.params.id}.json`), 'utf-8');
    res.json(JSON.parse(file));
  } catch (error) {
    res.status(404).json({ error: '未找到存档' });
  }
});

app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
