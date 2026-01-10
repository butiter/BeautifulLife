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

const SIMULATION_DELAY = 700;
const MAX_LLM_LOGS = 50;
const llmLogs = [];

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

const TASK_DIRECTIVE_PATTERNS = [/任务/, /目标/, /最终目的/, /必须完成/, /强制/];

const sanitizePrompt = (text, options = {}) => {
  if (!text) return '';
  let cleaned = text;
  if (options.removeTaskDirectives) {
    cleaned = cleaned
      .split(/(?<=[。！？.!?])/)
      .filter((sentence) => !TASK_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(sentence)))
      .join('');
  }

  cleaned = cleaned.replace(/[0-9]+/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const CHECK_MODEL = 'gpt-5-mini';

const getApiKey = (req) => req.headers['x-api-key'] || process.env.OPENAI_API_KEY;

const extractResponseText = (data) => {
  if (typeof data?.output_text === 'string') return data.output_text;
  const message = data?.output?.find((item) => item.type === 'message') || data?.output?.[0];
  if (!message?.content) return '';
  const textItem = message.content.find((item) => item.type === 'output_text');
  return textItem?.text || '';
};

const addLlmLog = (entry) => {
  llmLogs.push(entry);
  if (llmLogs.length > MAX_LLM_LOGS) {
    llmLogs.shift();
  }
};

const normalizeStatus = (value, allowed, fallback = 'fail') =>
  allowed.includes(value) ? value : fallback;

const runPromptChecks = async (worldDescRaw, charDescRaw, apiKey) => {
  const startedAt = new Date().toISOString();
  const inputPayload = { worldDesc: worldDescRaw, charDesc: charDescRaw };
  const payload = {
    model: CHECK_MODEL,
    temperature: 0.2,
    text: { format: { type: 'json_object' } },
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `你是内容审核与创世纪输入审查员。请仅输出 JSON 对象，不要输出任何多余文字。

需要完成四项检查并给出简短中文说明：
1) safety：若包含攻击/入侵/绕过/漏洞/脚本注入等黑客内容，或政治/色情/赌博/恐怖/毒品/枪支/邪教/极端等敏感主题，则 fail；否则 pass。
2) utility：若世界观描述与角色描述足够明确、可用于生成故事，则 pass；否则 fail。
3) expansion：若包含数值化属性、强指向性任务/目标/必须完成的指令等，应标记 warn；否则 pass。
4) builder：若输入足以直接进入世界构建（无需继续追问），则 pass；否则 fail。

同时返回 sanitizedInput：在保留用户意图的前提下，移除攻击/敏感内容与过强指令化表述，必要时简化数值化词汇。

输出 JSON 结构：
{
  "checks": {
    "safety": { "status": "pass|fail", "message": "..." },
    "utility": { "status": "pass|fail", "message": "..." },
    "expansion": { "status": "pass|warn", "message": "..." },
    "builder": { "status": "pass|fail", "message": "..." }
  },
  "sanitizedInput": { "worldDesc": "...", "charDesc": "..." }
}`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              worldDesc: worldDescRaw,
              charDesc: charDescRaw
            })
          }
        ]
      }
    ]
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  try {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const outputText = extractResponseText(data);
    if (!outputText) {
      throw new Error('OpenAI response missing output text.');
    }

    addLlmLog({
      id: nanoid(8),
      createdAt: startedAt,
      model: CHECK_MODEL,
      input: inputPayload,
      output: outputText
    });

    const parsed = JSON.parse(outputText);
    const rawChecks = parsed?.checks || {};
    const checks = {
      safety: {
        status: normalizeStatus(rawChecks?.safety?.status, ['pass', 'fail']),
        message: rawChecks?.safety?.message || '安全检查完成。'
      },
      utility: {
        status: normalizeStatus(rawChecks?.utility?.status, ['pass', 'fail']),
        message: rawChecks?.utility?.message || '效用检查完成。'
      },
      expansion: {
        status: normalizeStatus(rawChecks?.expansion?.status, ['pass', 'warn']),
        message: rawChecks?.expansion?.message || '扩展检查完成。'
      },
      builder: {
        status: normalizeStatus(rawChecks?.builder?.status, ['pass', 'fail']),
        message: rawChecks?.builder?.message || '构建检查完成。'
      }
    };

    return {
      checks,
      sanitizedInput: {
        worldDesc:
          parsed?.sanitizedInput?.worldDesc ||
          sanitizePrompt(worldDescRaw, { removeTaskDirectives: true }),
        charDesc: parsed?.sanitizedInput?.charDesc || sanitizePrompt(charDescRaw)
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLlmLog({
      id: nanoid(8),
      createdAt: startedAt,
      model: CHECK_MODEL,
      input: inputPayload,
      output: `ERROR: ${message}`,
      error: true
    });
    throw error;
  }
};

const allocateStats = (settings) => {
  const base = { str: 3, dex: 3, int: 3, cha: 3 };
  let remaining = 3;
  if (settings.physics === 'high') {
    base.str += 1;
    remaining -= 1;
  }
  if (settings.magic === 'high') {
    base.int += 1;
    remaining -= 1;
  }
  if (settings.tech === 'high') {
    base.dex += 1;
    remaining -= 1;
  }
  const order = ['cha', 'str', 'dex', 'int'];
  let idx = 0;
  while (remaining > 0) {
    base[order[idx % order.length]] += 1;
    remaining -= 1;
    idx += 1;
  }
  return base;
};

const buildMapNodes = (count) => {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `区域 ${index + 1}`,
    x: rng(10, 90),
    y: rng(10, 90),
    type: index === 0 ? 'start' : index % 4 === 0 ? 'danger' : 'neutral'
  }));
  nodes[0].name = '起始点: 旧港区';
  nodes[1].name = '中立区: 交易拱廊';
  nodes[2].name = '禁区: 破碎塔群';
  return nodes;
};

const buildWorldBuilder = (settings, input) => {
  const factionNames = ['星环议会', '赤曜军团', '雾海协会', '银钥秘盟'];
  const mapNodes = buildMapNodes(rng(8, 12));
  const stats = allocateStats(settings);

  return {
    world_setting: `${input.worldDesc || pick(MOCK_WORLD_CONTEXTS)} 世界的科技与魔法并行，势力之间处于微妙平衡。`,
    factions: factionNames.map((name, index) => ({
      name,
      summary: `势力 ${index + 1} 掌控着不同的资源与情报网络，彼此保持着脆弱的同盟关系。`
    })),
    map: mapNodes,
    faction_1: {
      name: factionNames[0],
      background: '由学者与议员组成的高层议会，掌控高阶魔法与政治秩序。',
      territory: '主城天穹港及其周边浮空环。',
      conflicts: '与赤曜军团在能源源泉上长期对峙。',
      abilities: '擅长信息控制与法术封印。',
      organization: '议会-内廷-执行官三级结构。'
    },
    faction_2: {
      name: factionNames[1],
      background: '由前线士兵与重装骑士组成的军事集团。',
      territory: '边境钢城与战线前哨。',
      conflicts: '与银钥秘盟争夺武器原型。',
      abilities: '重装作战、武力压制。',
      organization: '军团长-战团-战士三级结构。'
    },
    faction_3: {
      name: factionNames[2],
      background: '民间航运与情报商的联合体。',
      territory: '雾海群岛与贸易航线。',
      conflicts: '与星环议会在情报垄断上摩擦。',
      abilities: '隐秘交易、情报渗透。',
      organization: '船团-交易所-密探网络。'
    },
    faction_4: {
      name: factionNames[3],
      background: '神秘学派系，传承远古科技遗迹的钥匙。',
      territory: '沉眠遗迹与地下迷城。',
      conflicts: '与赤曜军团争夺遗迹控制权。',
      abilities: '古代机关、秘仪研究。',
      organization: '掌钥者-祭司-侦行者。'
    },
    stats_allocation: stats,
    inventory: ['折叠光刃', '信标晶片', '旧式通讯终端'],
    Power_level:
      settings.magic === 'high'
        ? '魔法与科技高度融合，常见的战斗手段包括符文装甲与能量护盾。'
        : '科技与魔法仍在磨合阶段，民间更多依赖冷兵器与简易工具。',
    pic_style: ['低饱和', '雾感', '赛博幻想', '柔和霓虹']
  };
};

const buildNarrator = (input, worldBuilder) => ({
  origin_story: `你出生在${worldBuilder.map[0].name}的边缘街区，曾在${worldBuilder.faction_3.name}的船团做过短暂学徒。${input.charDesc || '你始终记得那场改变命运的风暴。'}`
});

const buildQuestMaster = (input, worldBuilder) => {
  const taskCount = rng(5, 8);
  const tasks = Array.from({ length: taskCount }, (_, index) => ({
    id: index + 1,
    summary: `任务 ${index + 1}：前往${worldBuilder.map[index % worldBuilder.map.length].name}，调查与${worldBuilder.factions[index % 4].name}有关的异动。`
  }));
  return {
    task_num: taskCount,
    final_goal: `协助${worldBuilder.faction_1.name}赢得关键战役，获得影响世界格局的席位。`,
    tasks
  };
};

const buildSkillMaster = (worldBuilder) => ({
  skill: ['雾影潜行', '短距跃迁', '星环解读'],
  item: worldBuilder.inventory
});

const buildAssets = (worldBuilder) => {
  const avatarSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#22d3ee" />
          <stop offset="100%" stop-color="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" fill="#0f172a" />
      <circle cx="128" cy="128" r="100" fill="url(#g)" opacity="0.9" />
      <text x="128" y="140" font-size="56" text-anchor="middle" fill="#0f172a" font-family="sans-serif">L</text>
    </svg>
  `)}`;

  const mapSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="320">
      <rect width="512" height="320" fill="#0f172a" />
      <rect x="24" y="24" width="464" height="272" fill="#111827" stroke="#22d3ee" stroke-width="2" />
      <text x="256" y="60" font-size="18" text-anchor="middle" fill="#94a3b8" font-family="sans-serif">世界概要地图</text>
      <text x="256" y="92" font-size="12" text-anchor="middle" fill="#64748b" font-family="sans-serif">${worldBuilder.pic_style.join(' · ')}</text>
    </svg>
  `)}`;

  return {
    avatar: {
      prompt: `角色头像，风格：${worldBuilder.pic_style.join('，')}`,
      image: avatarSvg
    },
    map: {
      prompt: `地图概览，风格：${worldBuilder.pic_style.join('，')}`,
      image: mapSvg
    }
  };
};

const buildCharacter = (input, worldBuilder, assets) => ({
  name: `流浪者 ${rng(100, 999)}`,
  title: '星港游民',
  avatarSeed: rng(1, 9999),
  portrait: assets.avatar.image,
  stats: {
    str: worldBuilder.stats_allocation.str,
    dex: worldBuilder.stats_allocation.dex,
    int: worldBuilder.stats_allocation.int,
    cha: worldBuilder.stats_allocation.cha,
    money: rng(10, 50)
  },
  inventory: worldBuilder.inventory,
  originStory: input.charDesc
});

const buildWorld = (worldBuilder) => ({
  name: '艾瑞斯 · 零号扇区',
  description: worldBuilder.world_setting,
  factions: worldBuilder.factions.map((faction) => faction.name),
  mapNodes: worldBuilder.map
});

const buildFirstQuest = (questMaster) => {
  if (!questMaster?.tasks?.length) return { text: pick(MOCK_INTRO_QUESTS), options: [] };
  return {
    text: `【起始任务】${questMaster.tasks[0].summary}`,
    options: ['谨慎观察周围环境', '寻找可接触的势力线人', '检查装备并规划路线']
  };
};

const baseTaskLine = (questMaster) =>
  questMaster.tasks.map((task) => `【节点 ${task.id}】${task.summary}`);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: llmLogs });
});

app.post('/api/genesis', async (req, res) => {
  const settings = req.body || {};
  const worldDescRaw = settings.worldDesc?.trim() || '';
  const charDescRaw = settings.charDesc?.trim() || '';
  const apiKey = getApiKey(req);

  await wait(SIMULATION_DELAY);

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      checks: {
        safety: { status: 'fail', message: '缺少 API Key，无法执行安全检查。' },
        utility: { status: 'fail', message: '缺少 API Key，无法执行效用检查。' },
        expansion: { status: 'fail', message: '缺少 API Key，无法执行扩展检查。' },
        builder: { status: 'fail', message: '缺少 API Key，无法执行构建检查。' }
      },
      sanitizedInput: {
        worldDesc: sanitizePrompt(worldDescRaw, { removeTaskDirectives: true }),
        charDesc: sanitizePrompt(charDescRaw)
      }
    });
  }

  let checkPayload;
  try {
    checkPayload = await runPromptChecks(worldDescRaw, charDescRaw, apiKey);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: '安全检查服务不可用，请稍后重试。',
      checks: {
        safety: { status: 'fail', message: '安全检查失败。' },
        utility: { status: 'fail', message: '效用检查失败。' },
        expansion: { status: 'fail', message: '扩展检查失败。' },
        builder: { status: 'fail', message: '构建检查失败。' }
      },
      sanitizedInput: {
        worldDesc: sanitizePrompt(worldDescRaw, { removeTaskDirectives: true }),
        charDesc: sanitizePrompt(charDescRaw)
      }
    });
  }

  const { checks, sanitizedInput } = checkPayload;
  const shouldBlock =
    checks.safety.status !== 'pass' ||
    checks.utility.status !== 'pass' ||
    checks.builder.status !== 'pass';

  if (shouldBlock) {
    return res.status(400).json({
      ok: false,
      checks,
      sanitizedInput
    });
  }

  await wait(SIMULATION_DELAY);

  const input = {
    worldDesc: sanitizedInput.worldDesc || worldDescRaw,
    charDesc: sanitizedInput.charDesc || charDescRaw,
    settings: {
      magic: settings.magic || 'mid',
      physics: settings.physics || 'mid',
      tech: settings.tech || 'mid'
    }
  };

  const worldBuilder = buildWorldBuilder(input.settings, input);
  const narrator = buildNarrator(input, worldBuilder);
  const questMaster = buildQuestMaster(input, worldBuilder);
  const skillMaster = buildSkillMaster(worldBuilder);
  const assets = buildAssets(worldBuilder);

  const character = buildCharacter(input, worldBuilder, assets);
  const world = buildWorld(worldBuilder);
  const firstQuest = buildFirstQuest(questMaster);

  res.json({
    ok: true,
    checks,
    playerInput: input,
    worldBuilder,
    multiAgent: {
      narrator,
      questMaster,
      skillMaster
    },
    assets,
    character,
    world,
    taskLine: baseTaskLine(questMaster),
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
