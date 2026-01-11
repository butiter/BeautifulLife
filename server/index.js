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
const MAX_PROCESS_LOGS = 80;
const llmLogs = [];
const processLogs = [];

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

const PROVIDER_ENV_KEYS = {
  openai: 'OPENAI_API_KEY',
  doubao: 'ARK_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'DASHSCOPE_API_KEY'
};

const PROVIDER_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  deepseek: 'https://api.deepseek.com/v1',
  qwenText: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  qwenImage: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
};

const MODEL_CATALOG = {
  textLow: {
    doubao: [
      'doubao-seed-1-8-251228',
      'doubao-seed-1-6-flash-250828'
    ],
    qwen: ['qwen-mt-lite', 'qwen-flash', 'qwen-mt-plus'],
    deepseek: ['deepseek-chat'],
    openai: ['gpt-4.1-nano', 'gpt-5-nano', 'gpt-5-mini']
  },
  textHigh: {
    doubao: ['doubao-seed-1-8-251228', 'doubao-seed-1-6-lite-251015'],
    qwen: ['qwen3-max', 'qwen-plus'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openai: ['gpt-4.1-mini', 'gpt-5-mini', 'gpt-5.2']
  },
  image: {
    doubao: [
      'doubao-seedream-4-5-251128',
      'doubao-seedream-4-0-250828'
    ],
    qwen: ['qwen-image-plus', 'qwen-image'],
    openai: ['gpt-image-1-mini', 'gpt-image-1', 'gpt-image-1.5', 'gpt-5', 'gpt-5-mini']
  }
};

const DEFAULT_MODEL_SELECTIONS = {
  textLow: { provider: 'doubao', model: 'doubao-seed-1-8-251228' },
  textHigh: { provider: 'doubao', model: 'doubao-seed-1-8-251228' },
  image: { provider: 'doubao', model: 'doubao-seedream-4-5-251128' }
};

const getModelSettings = (payload) => {
  const raw = payload?.modelSettings || payload?.settings?.modelSettings || {};
  const selections = raw.selections || {};
  const normalizedSelections = {};

  Object.keys(DEFAULT_MODEL_SELECTIONS).forEach((key) => {
    const defaultSelection = DEFAULT_MODEL_SELECTIONS[key];
    const providerOptions = MODEL_CATALOG[key];
    const requestedProvider = selections[key]?.provider || defaultSelection.provider;
    const provider = providerOptions[requestedProvider] ? requestedProvider : defaultSelection.provider;
    const models = providerOptions[provider] || [];
    const requestedModel = selections[key]?.model || defaultSelection.model;
    const model = models.includes(requestedModel) ? requestedModel : models[0];
    normalizedSelections[key] = { provider, model };
  });

  return {
    providers: raw.providers || {},
    selections: normalizedSelections
  };
};

const getProviderApiKey = (provider, modelSettings) => {
  const fromSettings = modelSettings?.providers?.[provider]?.apiKey;
  if (fromSettings) return fromSettings;
  const envKey = PROVIDER_ENV_KEYS[provider];
  return envKey ? process.env[envKey] : undefined;
};

const extractResponseText = (data) => {
  if (typeof data?.output_text === 'string') return data.output_text;
  const message = data?.output?.find((item) => item.type === 'message') || data?.output?.[0];
  if (!message?.content) return '';
  const textItem = message.content.find((item) => item.type === 'output_text');
  return textItem?.text || '';
};

const extractChatCompletionText = (data) => data?.choices?.[0]?.message?.content || '';

const addLlmLog = (entry) => {
  llmLogs.push(entry);
  if (llmLogs.length > MAX_LLM_LOGS) {
    llmLogs.shift();
  }
};

const addProcessLog = (message, meta = {}) => {
  processLogs.push({
    id: nanoid(8),
    createdAt: new Date().toISOString(),
    message,
    meta
  });
  if (processLogs.length > MAX_PROCESS_LOGS) {
    processLogs.shift();
  }
};

const addImageSuccessLog = ({ prompt, size, output, model, provider }) => {
  addLlmLog({
    id: nanoid(8),
    createdAt: new Date().toISOString(),
    model,
    input: { tag: 'image_generation', prompt, size, provider },
    output
  });
};

const addImageErrorLog = ({ prompt, size, error, model, provider }) => {
  const message = error instanceof Error ? error.message : String(error);
  addLlmLog({
    id: nanoid(8),
    createdAt: new Date().toISOString(),
    model,
    input: { tag: 'image_generation', prompt, size, provider },
    output: `ERROR: ${message}`,
    error: true
  });
};

const normalizeStatus = (value, allowed, fallback = 'fail') =>
  allowed.includes(value) ? value : fallback;

const parseJsonOutput = (outputText) => {
  const trimmed = outputText?.trim();
  if (!trimmed) throw new Error('OpenAI response missing output text.');
  return JSON.parse(trimmed);
};

const callJsonModel = async ({ apiKey, model, systemPrompt, userPayload, logTag, provider }) => {
  const startedAt = new Date().toISOString();
  if (!apiKey) throw new Error('Missing API key');

  if (provider === 'openai' || provider === 'doubao') {
    const payload = {
      model,
      text: { format: { type: 'json_object' } },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(userPayload) }]
        }
      ]
    };

    const baseUrl = provider === 'openai' ? PROVIDER_BASE_URLS.openai : PROVIDER_BASE_URLS.doubao;
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const outputText = extractResponseText(data);

    addLlmLog({
      id: nanoid(8),
      createdAt: startedAt,
      model,
      input: { tag: logTag, payload: userPayload, provider },
      output: outputText
    });

    return parseJsonOutput(outputText);
  }

  if (provider === 'deepseek' || provider === 'qwen') {
    const baseUrl = provider === 'deepseek' ? PROVIDER_BASE_URLS.deepseek : PROVIDER_BASE_URLS.qwenText;
    const messages =
      provider === 'qwen'
        ? [
            { role: 'assistant', content: systemPrompt },
            { role: 'user', content: JSON.stringify(userPayload) }
          ]
        : [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(userPayload) }
          ];
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const outputText = extractChatCompletionText(data);

    addLlmLog({
      id: nanoid(8),
      createdAt: startedAt,
      model,
      input: { tag: logTag, payload: userPayload, provider },
      output: outputText
    });

    return parseJsonOutput(outputText);
  }

  throw new Error(`Unsupported provider: ${provider}`);
};

const callOpenAiImage = async ({ apiKey, prompt, size, model }) => {
  if (model.startsWith('gpt-5')) {
    const response = await fetch(`${PROVIDER_BASE_URLS.openai}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        tools: [{ type: 'image_generation' }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI image request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const imageCall = data?.output?.find((item) => item.type === 'image_generation_call');
    if (imageCall?.result) {
      return `data:image/png;base64,${imageCall.result}`;
    }
    throw new Error('OpenAI response image data missing.');
  }

  const response = await fetch(`${PROVIDER_BASE_URLS.openai}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt,
      size
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI image request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const imageData = data?.data?.[0];
  const b64 = imageData?.b64_json;
  if (b64) {
    return `data:image/png;base64,${b64}`;
  }
  if (imageData?.url) {
    return imageData.url;
  }
  throw new Error('OpenAI image response missing image data.');
};

const callDoubaoImage = async ({ apiKey, prompt, size, model }) => {
  const response = await fetch(`${PROVIDER_BASE_URLS.doubao}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      response_format: 'url',
      watermark: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Doubao image request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const imageData = data?.data?.[0];
  if (imageData?.url) {
    return imageData.url;
  }
  if (imageData?.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }
  throw new Error('Doubao image response missing image data.');
};

const callQwenImage = async ({ apiKey, prompt, size, model }) => {
  const response = await fetch(PROVIDER_BASE_URLS.qwenImage, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }]
          }
        ]
      },
      parameters: {
        size,
        watermark: false,
        prompt_extend: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QWEN image request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const imageItem = content.find((item) => item.image || item.image_url);
    if (imageItem?.image) return imageItem.image;
    if (imageItem?.image_url) return imageItem.image_url;
  }
  const imageUrl = data?.output?.image || data?.output?.image_url;
  if (imageUrl) return imageUrl;
  throw new Error('QWEN image response missing image data.');
};

const callImageModel = async ({ apiKey, prompt, size, model, provider }) => {
  if (!apiKey) throw new Error('Missing API key');
  if (provider === 'openai') {
    return callOpenAiImage({ apiKey, prompt, size, model });
  }
  if (provider === 'doubao') {
    return callDoubaoImage({ apiKey, prompt, size, model });
  }
  if (provider === 'qwen') {
    return callQwenImage({ apiKey, prompt, size, model });
  }
  throw new Error(`Unsupported image provider: ${provider}`);
};

const buildPlaceholderImage = ({ label, width, height }) => {
  const safeLabel = label?.replace(/</g, '&lt;').replace(/>/g, '&gt;') || 'IMAGE';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="6%" y="6%" width="88%" height="88%" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="10 8" />
      <text x="50%" y="50%" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle">
        ${safeLabel}
      </text>
      <text x="50%" y="62%" fill="#94a3b8" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">
        image unavailable
      </text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
};

const runPromptChecks = async ({ worldDescRaw, charDescRaw, apiKey, provider, model }) => {
  const startedAt = new Date().toISOString();
  const inputPayload = { worldDesc: worldDescRaw, charDesc: charDescRaw };
  try {
    const parsed = await callJsonModel({
      apiKey,
      model,
      provider,
      systemPrompt: `你是内容审核与创世纪输入审查员。请仅输出 JSON 对象，不要输出任何多余文字。

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
}`,
      userPayload: {
        worldDesc: worldDescRaw,
        charDesc: charDescRaw
      },
      logTag: 'prompt_check'
    });

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
      model,
      input: { ...inputPayload, provider },
      output: `ERROR: ${message}`,
      error: true,
      provider
    });
    throw error;
  }
};

const runGenesisChecks = async ({ worldDescRaw, charDescRaw, modelSettings }) => {
  const resolvedSettings = getModelSettings({ modelSettings });
  const lowQuality = resolvedSettings.selections.textLow;
  const apiKey = getProviderApiKey(lowQuality.provider, resolvedSettings);

  if (!apiKey) {
    return {
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
    };
  }

  let checkPayload;
  try {
    checkPayload = await runPromptChecks({
      worldDescRaw,
      charDescRaw,
      apiKey,
      provider: lowQuality.provider,
      model: lowQuality.model
    });
  } catch (error) {
    return {
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
    };
  }

  const { checks, sanitizedInput } = checkPayload;
  const shouldBlock =
    checks.safety.status !== 'pass' ||
    checks.utility.status !== 'pass' ||
    checks.builder.status !== 'pass';

  return {
    ok: !shouldBlock,
    checks,
    sanitizedInput
  };
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

const generateWorldBuilder = async ({ apiKey, input, settings, provider, model }) => {
  const systemPrompt = `你是世界构建器（World Builder Agent）。只输出 JSON，不要输出任何多余文字或代码块。

根据输入内容生成世界构建结果，JSON 必须包含：
- world_setting: 详细世界观补全（中文，2-4 段）
- factions: 4 个主要势力的简述数组，每个元素包含 name 与 summary
- map: 8~12 个地点数组，每个元素包含 {id, name, x, y, type}，x/y 为 0-100 的整数，type 只能是 start|neutral|danger|secret
- faction_1~faction_4: 四个势力的详细设定对象（background, territory, conflicts, abilities, organization）
- stats_allocation: {str, dex, int, cha} 总和必须为 15
- inventory: 初始道具数组（3-6 项）
- Power_level: 一段描述当前世界的魔法/科技/武力水平，并举 1-2 个例子
- pic_style: 3-6 个词，表示绘画资产风格
- character_appearance: 一段外貌描述（用于头像生成）

注意：输出必须紧扣用户世界观与角色描述，避免模板化与默认措辞。`;

  const userPayload = {
    worldDesc: input.worldDesc,
    charDesc: input.charDesc,
    settings
  };

  const raw = await callJsonModel({
    apiKey,
    model,
    provider,
    systemPrompt,
    userPayload,
    logTag: 'world_builder'
  });

  const fallbackStats = allocateStats(settings);
  return {
    ...raw,
    stats_allocation: normalizeStats(raw?.stats_allocation, fallbackStats),
    map: normalizeMapNodes(raw?.map),
    factions: Array.isArray(raw?.factions) ? raw.factions.slice(0, 4) : [],
    pic_style: Array.isArray(raw?.pic_style) ? raw.pic_style.slice(0, 6) : ['氛围感']
  };
};

const generateNarrator = async ({ apiKey, input, worldBuilder, provider, model }) => {
  const systemPrompt = `你是身份与剧情编排器中的 Narrator。只输出 JSON，不要输出任何多余文字。
输出格式：
{"origin_story":"..."}
请基于世界观、势力信息与人物描述，写出合理出身故事，中文 120-220 字。`;
  return callJsonModel({
    apiKey,
    model,
    provider,
    systemPrompt,
    userPayload: { input, worldBuilder },
    logTag: 'narrator'
  });
};

const generateQuestMaster = async ({ apiKey, input, worldBuilder, provider, model }) => {
  const systemPrompt = `你是身份与剧情编排器中的 Quest Master。只输出 JSON。
生成一条线性主线任务（5-8 个节点），并给出最终势力目标。
输出结构：
{
  "task_num": 5-8,
  "task_1": "...",
  "task_2": "...",
  "...": "...",
  "final_goal": "..."
}
任务描述为一小段中文。`;
  return callJsonModel({
    apiKey,
    model,
    provider,
    systemPrompt,
    userPayload: { input, worldBuilder },
    logTag: 'quest_master'
  });
};

const generateSkillMaster = async ({ apiKey, input, worldBuilder, provider, model }) => {
  const systemPrompt = `你是身份与剧情编排器中的 Skill Master。只输出 JSON。
输出结构：
{
  "skill": ["技能1","技能2","技能3"],
  "item": ["道具1","道具2","道具3"]
}
技能与道具必须与世界观一致。`;
  return callJsonModel({
    apiKey,
    model,
    provider,
    systemPrompt,
    userPayload: { input, worldBuilder },
    logTag: 'skill_master'
  });
};

const normalizeStats = (stats, fallback) => {
  const base = { ...fallback };
  if (!stats || typeof stats !== 'object') return base;
  ['str', 'dex', 'int', 'cha'].forEach((key) => {
    const value = Number(stats[key]);
    if (Number.isFinite(value)) base[key] = Math.max(0, Math.round(value));
  });
  const total = base.str + base.dex + base.int + base.cha;
  if (total === 15) return base;
  const diff = 15 - total;
  const order = ['str', 'dex', 'int', 'cha'];
  let idx = 0;
  let remaining = Math.abs(diff);
  while (remaining > 0) {
    const key = order[idx % order.length];
    base[key] = Math.max(0, base[key] + Math.sign(diff));
    remaining -= 1;
    idx += 1;
  }
  return base;
};

const normalizeMapNodes = (nodes) => {
  if (!Array.isArray(nodes)) return buildMapNodes(rng(8, 12));
  return nodes.slice(0, 12).map((node, index) => ({
    id: Number(node?.id) || index + 1,
    name: node?.name || `区域 ${index + 1}`,
    x: Math.min(100, Math.max(0, Number(node?.x) || rng(10, 90))),
    y: Math.min(100, Math.max(0, Number(node?.y) || rng(10, 90))),
    type: node?.type || (index === 0 ? 'start' : index % 4 === 0 ? 'danger' : 'neutral')
  }));
};

const normalizeQuestMaster = (questMaster, fallbackTasks) => {
  const tasks = [];
  if (Array.isArray(questMaster?.tasks)) {
    questMaster.tasks.forEach((task, index) => {
      tasks.push({
        id: Number(task?.id) || index + 1,
        summary: task?.summary || task?.text || `任务 ${index + 1}`
      });
    });
  } else if (Number.isFinite(questMaster?.task_num)) {
    const count = Math.min(8, Math.max(5, questMaster.task_num));
    for (let i = 1; i <= count; i += 1) {
      tasks.push({ id: i, summary: questMaster[`task_${i}`] || `任务 ${i}` });
    }
  }

  const safeTasks = tasks.length ? tasks : fallbackTasks;
  return {
    task_num: safeTasks.length,
    final_goal: questMaster?.final_goal || '最终目标尚待明确。',
    tasks: safeTasks
  };
};

const buildAssets = async ({ worldBuilder, apiKey, provider, model }) => {
  addProcessLog('进入资产生成流程', { provider, model });
  const avatarPrompt = `角色头像：${worldBuilder.character_appearance || '神秘旅者，目光坚定'}。风格关键词：${worldBuilder.pic_style.join('，')}。半身近景，单一角色，清晰面部细节。`;
  const mapPlaces = worldBuilder.map
    .slice(0, 10)
    .map((node) => node.name)
    .join('、');
  const mapPrompt = `世界地图：包含${mapPlaces}等地点，适度标注文字说明。风格关键词：${worldBuilder.pic_style.join('，')}。简洁清晰、易读。`;
  const imageSize = provider === 'qwen' ? '768*768' : '1024x1024';

  const [avatarResult, mapResult] = await Promise.allSettled([
    callImageModel({ apiKey, prompt: avatarPrompt, size: imageSize, model, provider }),
    callImageModel({ apiKey, prompt: mapPrompt, size: imageSize, model, provider })
  ]);

  if (avatarResult.status === 'rejected') {
    addImageErrorLog({
      prompt: avatarPrompt,
      size: imageSize,
      error: avatarResult.reason,
      model,
      provider
    });
    addProcessLog('头像图片生成失败', { provider, model });
  } else {
    addImageSuccessLog({
      prompt: avatarPrompt,
      size: imageSize,
      output: avatarResult.value,
      model,
      provider
    });
    addProcessLog('头像图片生成完成', { provider, model });
  }
  if (mapResult.status === 'rejected') {
    addImageErrorLog({
      prompt: mapPrompt,
      size: imageSize,
      error: mapResult.reason,
      model,
      provider
    });
    addProcessLog('地图图片生成失败', { provider, model });
  } else {
    addImageSuccessLog({
      prompt: mapPrompt,
      size: imageSize,
      output: mapResult.value,
      model,
      provider
    });
    addProcessLog('地图图片生成完成', { provider, model });
  }

  const avatarImage =
    avatarResult.status === 'fulfilled'
      ? avatarResult.value
      : buildPlaceholderImage({ label: 'Avatar', width: 1024, height: 1024 });
  const mapImage =
    mapResult.status === 'fulfilled'
      ? mapResult.value
      : buildPlaceholderImage({ label: 'Map', width: 1024, height: 1024 });

  return {
    avatar: {
      prompt: avatarPrompt,
      image: avatarImage
    },
    map: {
      prompt: mapPrompt,
      image: mapImage
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

const buildGenesisPayload = async ({ input, modelSettings }) => {
  addProcessLog('进入创世纪构建流程');
  const resolvedSettings = getModelSettings({ modelSettings });
  const highQuality = resolvedSettings.selections.textHigh;
  const imageSelection = resolvedSettings.selections.image;
  const generationApiKey = getProviderApiKey(highQuality.provider, resolvedSettings);
  const imageApiKey = getProviderApiKey(imageSelection.provider, resolvedSettings);

  if (!generationApiKey) {
    throw new Error('缺少高质量文本生成 API Key。');
  }
  if (!imageApiKey) {
    throw new Error('缺少图像生成 API Key。');
  }

  const worldBuilder = await generateWorldBuilder({
    apiKey: generationApiKey,
    input,
    settings: input.settings,
    provider: highQuality.provider,
    model: highQuality.model
  });
  addProcessLog('世界构建完成', { provider: highQuality.provider, model: highQuality.model });

  const fallbackTasks = worldBuilder.map.slice(0, 5).map((node, index) => ({
    id: index + 1,
    summary: `任务 ${index + 1}：前往${node.name}，调查与${worldBuilder.factions[index % 4]?.name || '未知势力'}有关的异动。`
  }));

  let questMasterRaw;
  const [narrator, questMaster, skillMaster] = await Promise.all([
    generateNarrator({
      apiKey: generationApiKey,
      input,
      worldBuilder,
      provider: highQuality.provider,
      model: highQuality.model
    }),
    generateQuestMaster({
      apiKey: generationApiKey,
      input,
      worldBuilder,
      provider: highQuality.provider,
      model: highQuality.model
    }),
    generateSkillMaster({
      apiKey: generationApiKey,
      input,
      worldBuilder,
      provider: highQuality.provider,
      model: highQuality.model
    })
  ]);
  addProcessLog('多智能体剧情生成完成', { provider: highQuality.provider, model: highQuality.model });

  questMasterRaw = normalizeQuestMaster(questMaster, fallbackTasks);
  const assets = await buildAssets({
    worldBuilder,
    apiKey: imageApiKey,
    provider: imageSelection.provider,
    model: imageSelection.model
  });
  addProcessLog('创世纪资产生成完成', {
    provider: imageSelection.provider,
    model: imageSelection.model
  });

  const character = buildCharacter(input, worldBuilder, assets);
  const world = buildWorld(worldBuilder);
  const firstQuest = buildFirstQuest(questMasterRaw);
  addProcessLog('创世纪构建完成');

  return {
    playerInput: input,
    worldBuilder,
    multiAgent: {
      narrator,
      questMaster: questMasterRaw,
      skillMaster
    },
    assets,
    character,
    world,
    taskLine: baseTaskLine(questMasterRaw),
    firstQuest
  };
};

const testTextModel = async ({ provider, apiKey, model }) => {
  if (!apiKey) throw new Error('Missing API key');
  if (provider === 'openai' || provider === 'doubao') {
    const baseUrl = provider === 'openai' ? PROVIDER_BASE_URLS.openai : PROVIDER_BASE_URLS.doubao;
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, input: 'ping' })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} text test failed: ${response.status} ${errorText}`);
    }
    return;
  }

  if (provider === 'deepseek' || provider === 'qwen') {
    const baseUrl = provider === 'deepseek' ? PROVIDER_BASE_URLS.deepseek : PROVIDER_BASE_URLS.qwenText;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${provider} text test failed: ${response.status} ${errorText}`);
    }
    return;
  }

  throw new Error(`Unsupported provider: ${provider}`);
};

const getImageTestSize = (provider) =>
  provider === 'qwen' ? '1024*1024' : provider === 'doubao' ? '2K' : '1024x1024';

const runSingleModelTest = async ({ provider, apiKey, model, type }) => {
  if (!apiKey) throw new Error('Missing API key');
  if (type === 'image') {
    const size = getImageTestSize(provider);
    await callImageModel({ provider, apiKey, model, prompt: '测试图片', size });
    return;
  }
  await testTextModel({ provider, apiKey, model });
};

const runModelTests = async ({ providers }) => {
  const results = [];
  const providerIds = Object.keys(providers || {});

  for (const provider of providerIds) {
    const apiKey = providers?.[provider]?.apiKey || process.env[PROVIDER_ENV_KEYS[provider]];
    if (!apiKey) continue;
    const textSets = [
      { type: 'textLow', models: MODEL_CATALOG.textLow[provider] || [] },
      { type: 'textHigh', models: MODEL_CATALOG.textHigh[provider] || [] }
    ];
    for (const set of textSets) {
      for (const model of set.models) {
        try {
          await testTextModel({ provider, apiKey, model });
          results.push({ provider, model, type: set.type, ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({ provider, model, type: set.type, ok: false, message });
        }
      }
    }

    const imageModels = MODEL_CATALOG.image[provider] || [];
    for (const model of imageModels) {
      try {
        const size = getImageTestSize(provider);
        await callImageModel({ provider, apiKey, model, prompt: '测试图片', size });
        results.push({ provider, model, type: 'image', ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ provider, model, type: 'image', ok: false, message });
      }
    }
  }

  return results;
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/logs', (req, res) => {
  res.json({ processLogs, llmLogs });
});

app.post('/api/settings/test', async (req, res) => {
  const providers = req.body?.providers || {};
  try {
    const results = await runModelTests({ providers });
    res.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/settings/test-item', async (req, res) => {
  const { provider, model, type, providers = {} } = req.body || {};
  if (!provider || !model || !type) {
    return res.status(400).json({ ok: false, error: 'Missing test parameters.' });
  }
  const apiKey = getProviderApiKey(provider, { providers });
  if (!apiKey) {
    return res.json({
      ok: true,
      result: { provider, model, type, ok: false, message: 'Missing API key' }
    });
  }
  try {
    await runSingleModelTest({ provider, apiKey, model, type });
    return res.json({ ok: true, result: { provider, model, type, ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.json({ ok: true, result: { provider, model, type, ok: false, message } });
  }
});

app.post('/api/genesis/checks', async (req, res) => {
  addProcessLog('进入创世纪校验流程');
  const settingsPayload = req.body || {};
  const settings = settingsPayload.settings || settingsPayload;
  const modelSettings = settingsPayload.modelSettings || settings.modelSettings || {};
  const worldDescRaw = settings.worldDesc?.trim() || '';
  const charDescRaw = settings.charDesc?.trim() || '';

  await wait(SIMULATION_DELAY);

  const checkPayload = await runGenesisChecks({ worldDescRaw, charDescRaw, modelSettings });
  if (!checkPayload.ok) {
    const statusCode = checkPayload.error ? 502 : 400;
    addProcessLog('创世纪校验失败');
    return res.status(statusCode).json(checkPayload);
  }

  addProcessLog('创世纪校验通过');
  res.json(checkPayload);
});

app.post('/api/genesis/build', async (req, res) => {
  addProcessLog('进入创世纪生成流程');
  const payload = req.body || {};
  const modelSettings = payload.modelSettings || {};

  await wait(SIMULATION_DELAY);

  const worldDescRaw = payload.worldDesc?.trim() || '';
  const charDescRaw = payload.charDesc?.trim() || '';
  const sanitized = payload.sanitizedInput || {};
  const input = {
    worldDesc: sanitized.worldDesc || worldDescRaw,
    charDesc: sanitized.charDesc || charDescRaw,
    settings: {
      magic: payload.settings?.magic || 'mid',
      physics: payload.settings?.physics || 'mid',
      tech: payload.settings?.tech || 'mid'
    }
  };

  try {
    const buildPayload = await buildGenesisPayload({ input, modelSettings });
    addProcessLog('创世纪生成成功');
    return res.json({
      ok: true,
      ...buildPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addProcessLog('创世纪生成失败', { error: message });
    return res.status(502).json({
      ok: false,
      error: `创世纪生成失败：${message}`
    });
  }
});

app.post('/api/genesis', async (req, res) => {
  const settingsPayload = req.body || {};
  const settings = settingsPayload.settings || settingsPayload;
  const modelSettings = settingsPayload.modelSettings || settings.modelSettings || {};
  const worldDescRaw = settings.worldDesc?.trim() || '';
  const charDescRaw = settings.charDesc?.trim() || '';

  await wait(SIMULATION_DELAY);

  const checkPayload = await runGenesisChecks({ worldDescRaw, charDescRaw, modelSettings });
  if (!checkPayload.ok) {
    const statusCode = checkPayload.error ? 502 : 400;
    return res.status(statusCode).json(checkPayload);
  }

  const input = {
    worldDesc: checkPayload.sanitizedInput.worldDesc || worldDescRaw,
    charDesc: checkPayload.sanitizedInput.charDesc || charDescRaw,
    settings: {
      magic: settings.magic || 'mid',
      physics: settings.physics || 'mid',
      tech: settings.tech || 'mid'
    }
  };

  try {
    const buildPayload = await buildGenesisPayload({ input, modelSettings });
    res.json({
      ok: true,
      checks: checkPayload.checks,
      ...buildPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({
      ok: false,
      error: `创世纪生成失败：${message}`
    });
  }
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
