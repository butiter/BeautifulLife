import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Backpack,
  Brain,
  Coins,
  Feather,
  Globe,
  Map as MapIcon,
  Send,
  Shield,
  Sword,
  Terminal,
  User,
  Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const PROVIDERS = {
  doubao: { label: '豆包', supports: ['text', 'image'] },
  openai: { label: 'OPENAI', supports: ['text', 'image'] },
  deepseek: { label: 'Deepseek', supports: ['text'] },
  qwen: { label: 'QWEN(海内版)', supports: ['text', 'image'] }
};

const MODEL_OPTIONS = {
  textLow: {
    doubao: [
      { id: 'doubao-seed-1.8', label: 'doubao-seed-1.8' },
      { id: 'doubao-seed-1.6-lite', label: 'doubao-seed-1.6-lite' },
      { id: 'doubao-seed-1.6-flash', label: 'doubao-seed-1.6-flash' },
      { id: 'doubao-1.5-pro-32k', label: 'doubao-1.5-pro-32k' },
      { id: 'doubao-1.5-lite-32k', label: 'doubao-1.5-lite-32k' }
    ],
    qwen: [
      { id: 'qwen-mt-lite', label: 'qwen-mt-lite' },
      { id: 'qwen-flash', label: 'qwen-flash' },
      { id: 'qwen-mt-plus', label: 'qwen-mt-plus' }
    ],
    deepseek: [{ id: 'deepseek-chat', label: 'deepseek-chat' }],
    openai: [
      { id: 'gpt-4.1-nano', label: 'gpt-4.1-nano(最快)' },
      { id: 'gpt-5-nano', label: 'gpt-5-nano' },
      { id: 'gpt-5.2-nano', label: 'gpt-5.2-nano' }
    ]
  },
  textHigh: {
    doubao: [
      { id: 'doubao-seed-1.8', label: 'doubao-seed-1.8' },
      { id: 'doubao-1.5-pro-32k', label: 'doubao-1.5-pro-32k' }
    ],
    qwen: [
      { id: 'qwen3-max', label: 'qwen3-max' },
      { id: 'qwen-plus', label: 'qwen-plus' }
    ],
    deepseek: [
      { id: 'deepseek-chat', label: 'deepseek-chat' },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner' }
    ],
    openai: [
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
      { id: 'gpt-5-mini', label: 'gpt-5-mini' },
      { id: 'gpt-5.2-mini', label: 'gpt-5.2-mini' },
      { id: 'gpt-5.2', label: 'gpt-5.2' }
    ]
  },
  image: {
    doubao: [
      { id: 'doubao-seedream-4.5', label: 'doubao-seedream-4.5' },
      { id: 'doubao-seedream-4.0', label: 'doubao-seedream-4.0' },
      { id: 'doubao-seedream-3.0-t2i', label: 'doubao-seedream-3.0-t2i' },
      { id: 'doubao-seededit-3.0-i2i', label: 'doubao-seededit-3.0-i2i' }
    ],
    qwen: [
      { id: 'qwen-image-plus', label: 'qwen-image-plus' },
      { id: 'qwen-image', label: 'qwen-image' }
    ],
    openai: [
      { id: 'gpt-image-1-mini', label: 'gpt-image-1-mini(可能需要权限)' },
      { id: 'gpt-image-1', label: 'gpt-image-1(可能需要权限)' },
      { id: 'gpt-image-1.5', label: 'gpt-image-1.5(可能需要权限)' },
      { id: 'gpt-5', label: 'gpt-5(可能需要权限，相应模式)' },
      { id: 'gpt-5-mini', label: 'gpt-5-mini(可能需要权限，相应模式)' }
    ]
  }
};

const buildProviderLabel = (provider) => PROVIDERS[provider]?.label || provider;
const buildModelLabel = (provider, model) => `[${buildProviderLabel(provider)}]${model}`;
const TEST_TYPE_LABELS = {
  textLow: '低质量文本',
  textHigh: '高质量文本',
  image: '图像'
};

const buildDefaultModelSettings = () => ({
  providers: {
    doubao: { apiKey: '' },
    openai: { apiKey: '' },
    deepseek: { apiKey: '' },
    qwen: { apiKey: '' }
  },
  selections: {
    textLow: { provider: 'openai', model: MODEL_OPTIONS.textLow.openai[0].id },
    textHigh: { provider: 'openai', model: MODEL_OPTIONS.textHigh.openai[0].id },
    image: { provider: 'openai', model: MODEL_OPTIONS.image.openai[0].id }
  }
});

const normalizeModelSettings = (rawSettings) => {
  const defaults = buildDefaultModelSettings();
  if (!rawSettings || typeof rawSettings !== 'object') return defaults;

  const selections = {};
  ['textLow', 'textHigh', 'image'].forEach((key) => {
    const rawSelection = rawSettings.selections?.[key] || {};
    const provider =
      MODEL_OPTIONS[key][rawSelection.provider] ? rawSelection.provider : defaults.selections[key].provider;
    const models = MODEL_OPTIONS[key][provider] || [];
    const modelIds = models.map((item) => item.id);
    const model = modelIds.includes(rawSelection.model) ? rawSelection.model : models[0]?.id;
    selections[key] = { provider, model };
  });

  return {
    providers: {
      doubao: { apiKey: rawSettings.providers?.doubao?.apiKey || '' },
      openai: { apiKey: rawSettings.providers?.openai?.apiKey || '' },
      deepseek: { apiKey: rawSettings.providers?.deepseek?.apiKey || '' },
      qwen: { apiKey: rawSettings.providers?.qwen?.apiKey || '' }
    },
    selections
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const StatBar = ({ icon: Icon, label, value, color }) => (
  <div className="mb-4">
    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
      <div className="flex items-center gap-2">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <span>{value}</span>
    </div>
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(value * 6, 100)}%` }}
      />
    </div>
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center">
    <span className="loader" />
  </div>
);

const GenesisCheckItem = ({ title, status, detail }) => {
  const statusStyles = {
    pending: 'text-slate-500',
    running: 'text-cyan-400',
    pass: 'text-emerald-400',
    fail: 'text-rose-400',
    warn: 'text-amber-400'
  };

  return (
    <div className="flex items-start gap-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
        {status === 'running' ? (
          <Spinner />
        ) : (
          <div
            className={`w-3 h-3 rounded-full ${
              status === 'pass'
                ? 'bg-emerald-400'
                : status === 'fail'
                ? 'bg-rose-400'
                : status === 'warn'
                ? 'bg-amber-400'
                : 'bg-slate-600'
            }`}
          />
        )}
      </div>
      <div className="flex-1">
        <h3 className={`text-sm font-semibold ${statusStyles[status] || 'text-slate-200'}`}>
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-1">{detail}</p>
      </div>
      <span className={`text-xs uppercase tracking-widest ${statusStyles[status] || 'text-slate-400'}`}>
        {status}
      </span>
    </div>
  );
};

const GameMap = ({ nodes, isOpen, toggle, mapImage }) => (
  <div
    className={`fixed top-0 right-0 h-full bg-slate-950 border-l border-slate-800 shadow-2xl transform transition-transform duration-500 ease-in-out z-50 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}
    style={{ width: '380px' }}
  >
    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/90 backdrop-blur">
      <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
        <Globe size={18} className="text-cyan-400" />
        世界全息图
      </h2>
      <button onClick={toggle} className="p-2 hover:bg-slate-800 rounded text-slate-400">
        ✕
      </button>
    </div>

    <div className="p-4 border-b border-slate-800">
      <img
        src={mapImage}
        alt="地图预览"
        className="w-full rounded-lg border border-slate-700"
      />
      <p className="text-xs text-slate-500 mt-2">地图由资产生成器提供，仅用于世界概览。</p>
    </div>

    <div className="relative w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 p-6">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute flex flex-col items-center group cursor-pointer"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 shadow-[0_0_12px_rgba(0,0,0,0.35)] ${
              node.type === 'start'
                ? 'bg-emerald-500 border-emerald-200 shadow-emerald-500/30'
                : node.type === 'danger'
                ? 'bg-rose-500 border-rose-200 shadow-rose-500/30'
                : node.type === 'secret'
                ? 'bg-violet-500 border-violet-200 shadow-violet-500/30'
                : 'bg-cyan-500 border-cyan-200 shadow-cyan-500/30'
            } hover:scale-125 transition-transform duration-300`}
          />
          <span className="mt-2 text-[10px] bg-black/80 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {node.name}
          </span>
        </div>
      ))}

      {nodes.length > 1 && (
        <svg className="absolute inset-0 pointer-events-none opacity-30">
          <path
            d={`M ${nodes[0]?.x}% ${nodes[0]?.y}% L ${nodes[1]?.x}% ${nodes[1]?.y}%`}
            stroke="white"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
      )}
    </div>
  </div>
);

const defaultSettings = {
  magic: 'mid',
  physics: 'mid',
  tech: 'mid',
  worldDesc: '',
  charDesc: ''
};

const avatarGradients = [
  'from-cyan-400 via-blue-500 to-indigo-600',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-fuchsia-400 via-purple-500 to-indigo-600',
  'from-amber-400 via-orange-500 to-rose-600'
];

const buildGenesisChecks = () => [
  { key: 'safety', title: '安全检查', status: 'pending', detail: '扫描潜在攻击与敏感内容...' },
  { key: 'utility', title: '效用检查', status: 'pending', detail: '验证世界观与角色描述的完整性...' },
  { key: 'expansion', title: '扩展检查', status: 'pending', detail: '检测强指向性与数值化描述...' },
  { key: 'builder', title: '世界构建器', status: 'pending', detail: '组织世界/角色/任务线结构化输出...' }
];

const DebugView = () => {
  const [debugData, setDebugData] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('genesisDebug');
    if (stored) {
      setDebugData(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Genesis Debug Console</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.open('/?forceGame=1', '_blank', 'noopener')}
            className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
          >
            新窗口打开游戏
          </button>
          <a href="/" className="text-cyan-400 text-sm">
            返回游戏
          </a>
        </div>
      </div>

      {!debugData ? (
        <div className="flex flex-col items-center justify-center p-8 border border-slate-800 rounded-xl bg-slate-900/40">
          <Terminal size={48} className="text-cyan-400 mb-4" />
          <p className="text-slate-400">暂无 Debug 数据，请先完成创世纪流程。</p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg text-cyan-300">世界构建器 (World Builder)</h2>
            <pre className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs overflow-auto">
              {JSON.stringify(debugData.worldBuilder, null, 2)}
            </pre>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg text-cyan-300">身份与剧情编排器 (Multi-Agent)</h2>
            <pre className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs overflow-auto">
              {JSON.stringify(debugData.multiAgent, null, 2)}
            </pre>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg text-cyan-300">资产生成器</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm text-slate-300 mb-2">头像</h3>
                <img
                  src={debugData.assets.avatar.image}
                  alt="avatar"
                  className="rounded-lg border border-slate-700"
                />
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm text-slate-300 mb-2">地图</h3>
                <img
                  src={debugData.assets.map.image}
                  alt="map"
                  className="rounded-lg border border-slate-700"
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const LogView = () => {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setStatus('loading');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/logs`);
      const data = await response.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : '日志加载失败';
      setError(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">LLM 调用日志</h1>
          <p className="text-xs text-slate-400 mt-1">记录每次 LLM 输入与返回文本。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
          >
            刷新
          </button>
          <a href="/" className="text-cyan-400 text-sm">
            返回游戏
          </a>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-cyan-300">
          <Spinner />
          日志加载中...
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!logs.length && status === 'ready' && !error && (
        <div className="flex flex-col items-center justify-center p-8 border border-slate-800 rounded-xl bg-slate-900/40">
          <Terminal size={48} className="text-cyan-400 mb-4" />
          <p className="text-slate-400">暂无日志，请先完成一次 LLM 调用。</p>
        </div>
      )}

      <div className="space-y-4">
        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span>时间：{log.createdAt}</span>
              <span>模型：{log.model}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <p className="text-slate-400 mb-2">输入</p>
                <pre className="whitespace-pre-wrap text-slate-200">
                  {JSON.stringify(log.input, null, 2)}
                </pre>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                <p className="text-slate-400 mb-2">输出</p>
                <pre className="whitespace-pre-wrap text-slate-200">{log.output}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView = ({ modelSettings, onSave }) => {
  const [draft, setDraft] = useState(() => normalizeModelSettings(modelSettings));
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [testStatus, setTestStatus] = useState('idle');
  const [testResults, setTestResults] = useState([]);
  const [testError, setTestError] = useState('');
  const [showTestInfo, setShowTestInfo] = useState(true);

  useEffect(() => {
    setDraft(normalizeModelSettings(modelSettings));
  }, [modelSettings]);

  const updateSelection = (key, updates) => {
    setDraft((prev) => {
      const current = prev.selections[key];
      const next = { ...current, ...updates };
      if (updates.provider && updates.provider !== current.provider) {
        const providerModels = MODEL_OPTIONS[key][updates.provider] || [];
        next.model = providerModels[0]?.id || '';
      }
      return {
        ...prev,
        selections: {
          ...prev.selections,
          [key]: next
        }
      };
    });
  };

  const handleSave = () => {
    const normalized = normalizeModelSettings(draft);
    setDraft(normalized);
    onSave(normalized);
  };

  const handleTest = async () => {
    setTestStatus('running');
    setTestResults([]);
    setTestError('');
    setShowTestInfo(true);
    try {
      const response = await fetch(`${API_BASE}/api/settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: draft.providers })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || '测试失败');
      }
      setTestResults(Array.isArray(data.results) ? data.results : []);
      setTestStatus('done');
    } catch (error) {
      const message = error instanceof Error ? error.message : '测试失败';
      setTestError(message);
      setTestStatus('error');
    }
  };

  const handleSaveAndTest = async () => {
    handleSave();
    await handleTest();
  };

  const hasTestInfo =
    testStatus === 'running' || testError || (Array.isArray(testResults) && testResults.length > 0);

  const renderModelRow = (key, title, description) => {
    const selection = draft.selections[key];
    const providerOptions = Object.keys(MODEL_OPTIONS[key]);
    const models = MODEL_OPTIONS[key][selection.provider] || [];
    return (
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 focus:outline-none"
            value={selection.provider}
            onChange={(e) => updateSelection(key, { provider: e.target.value })}
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {buildProviderLabel(provider)}
              </option>
            ))}
          </select>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 focus:outline-none"
            value={selection.model}
            onChange={(e) => updateSelection(key, { model: e.target.value })}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {buildModelLabel(selection.provider, model.label)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-400 mt-1">配置 API 与模型分配规则。</p>
        </div>
        <a href="/" className="text-cyan-400 text-sm">
          返回游戏
        </a>
      </div>

      <section className="space-y-4 bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg text-cyan-300">API 提供方</h2>
            <p className="text-xs text-slate-500">点击填写 API Key，保存后会测试已填写的所有模型。</p>
          </div>
          <button
            type="button"
            onClick={() => setIsApiModalOpen(true)}
            className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
          >
            填写 API
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.keys(PROVIDERS).map((provider) => (
            <div
              key={provider}
              className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs"
            >
              <span className="text-slate-300">{buildProviderLabel(provider)}</span>
              <span className="text-slate-500">
                {draft.providers[provider]?.apiKey ? '已填写' : '未填写'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs uppercase tracking-widest bg-cyan-900 hover:bg-cyan-800 text-cyan-100 rounded-lg border border-cyan-700"
          >
            保存
          </button>
          <button
            onClick={handleSaveAndTest}
            className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
          >
            保存并测试
          </button>
          {hasTestInfo && (
            <button
              type="button"
              onClick={() => setShowTestInfo((prev) => !prev)}
              className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-900/60 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition"
            >
              {showTestInfo ? '隐藏测试信息' : '显示测试信息'}
            </button>
          )}
        </div>

        {showTestInfo && testStatus === 'running' && (
          <div className="flex items-center gap-2 text-sm text-cyan-300">
            <Spinner />
            正在测试 API 模型可用性...
          </div>
        )}

        {showTestInfo && testError && (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 rounded-xl p-4 text-sm">
            {testError}
          </div>
        )}

        {showTestInfo && testStatus === 'done' && (
          <div className="space-y-2">
            <h3 className="text-sm text-slate-200 font-semibold">测试结果</h3>
            <div className="grid gap-2">
              {testResults.map((result) => {
                const modelOption = MODEL_OPTIONS[result.type]?.[result.provider]?.find(
                  (item) => item.id === result.model
                );
                const modelLabel = modelOption?.label || result.model;
                return (
                <div
                  key={`${result.provider}-${result.model}-${result.type}`}
                  className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="text-slate-200">
                      {buildModelLabel(result.provider, modelLabel)}
                    </div>
                    <div className="text-slate-500">
                      {TEST_TYPE_LABELS[result.type] || result.type}
                    </div>
                    {!result.ok && result.message && (
                      <div className="text-rose-300">{result.message}</div>
                    )}
                  </div>
                  <span
                    className={
                      result.ok
                        ? 'text-emerald-400 font-semibold'
                        : 'text-rose-400 font-semibold'
                    }
                  >
                    {result.ok ? '通过' : '失败'}
                  </span>
                </div>
              );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-6 bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg text-cyan-300">模型分配</h2>
        {renderModelRow('textLow', '低质量文本生成', '用于安全检查与快速推理。')}
        {renderModelRow('textHigh', '高质量文本生成', '用于世界构建、人物与任务生成。')}
        {renderModelRow('image', '图像生成', '用于角色头像与地图资产。')}
      </section>

      {isApiModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-white font-semibold">填写 API Key</h3>
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {Object.keys(PROVIDERS).map((provider) => (
                <div key={provider} className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-slate-500">
                    {buildProviderLabel(provider)}
                  </label>
                  <input
                    type="password"
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 focus:outline-none"
                    placeholder={`输入 ${buildProviderLabel(provider)} API Key`}
                    value={draft.providers[provider]?.apiKey || ''}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        providers: {
                          ...prev.providers,
                          [provider]: { apiKey: e.target.value }
                        }
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApiModalOpen(false)}
                className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setIsApiModalOpen(false);
                  handleSaveAndTest();
                }}
                className="px-4 py-2 text-xs uppercase tracking-widest bg-cyan-900 hover:bg-cyan-800 text-cyan-100 rounded-lg border border-cyan-700"
              >
                保存并测试
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [phase, setPhase] = useState('SETUP');
  const [worldSettings, setWorldSettings] = useState(defaultSettings);
  const [character, setCharacter] = useState(null);
  const [world, setWorld] = useState(null);
  const [taskLine, setTaskLine] = useState([]);
  const [questLog, setQuestLog] = useState([]);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [isLoadingTurn, setIsLoadingTurn] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [saveId, setSaveId] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [genesisChecks, setGenesisChecks] = useState(buildGenesisChecks());
  const [genesisError, setGenesisError] = useState('');
  const [playerInput, setPlayerInput] = useState(null);
  const [worldBuilder, setWorldBuilder] = useState(null);
  const [multiAgent, setMultiAgent] = useState(null);
  const [assets, setAssets] = useState(null);
  const [modelSettings, setModelSettings] = useState(() => {
    const stored = localStorage.getItem('genesisModelSettings');
    if (!stored) return buildDefaultModelSettings();
    try {
      return normalizeModelSettings(JSON.parse(stored));
    } catch (error) {
      return buildDefaultModelSettings();
    }
  });

  const scrollRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('forceGame') !== '1') return;
    const stored = localStorage.getItem('genesisSession');
    if (!stored) return;
    try {
      const session = JSON.parse(stored);
      if (!session?.character || !session?.world) return;
      setPlayerInput(session.playerInput || null);
      setWorldBuilder(session.worldBuilder || null);
      setMultiAgent(session.multiAgent || null);
      setAssets(session.assets || null);
      setCharacter(session.character || null);
      setWorld(session.world || null);
      setTaskLine(session.taskLine || []);
      setQuestLog(session.questLog || []);
      setCurrentOptions(session.currentOptions || []);
      setPhase('GAME');
    } catch (error) {
      console.error('Failed to restore game session', error);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'GAME') return;
    if (!character || !world) return;
    const snapshot = {
      playerInput,
      worldBuilder,
      multiAgent,
      assets,
      character,
      world,
      taskLine,
      questLog,
      currentOptions
    };
    localStorage.setItem('genesisSession', JSON.stringify(snapshot));
  }, [
    phase,
    playerInput,
    worldBuilder,
    multiAgent,
    assets,
    character,
    world,
    taskLine,
    questLog,
    currentOptions
  ]);

  useEffect(() => {
    localStorage.setItem('genesisModelSettings', JSON.stringify(modelSettings));
  }, [modelSettings]);

  const buildHeaders = () => ({ 'Content-Type': 'application/json' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [questLog, isLoadingTurn]);

  const avatarGradient = useMemo(() => {
    if (!character?.avatarSeed) return avatarGradients[0];
    return avatarGradients[character.avatarSeed % avatarGradients.length];
  }, [character]);

  const handleStartGenesis = async () => {
    setPhase('GENESIS');
    setGenesisChecks(buildGenesisChecks());
    setGenesisError('');

    const response = await fetch(`${API_BASE}/api/genesis/checks`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ settings: worldSettings, modelSettings })
    });
    const data = await response.json();

    const order = ['safety', 'utility', 'expansion', 'builder'];
    for (let i = 0; i < order.length; i += 1) {
      setGenesisChecks((prev) =>
        prev.map((item, index) =>
          index === i ? { ...item, status: 'running', detail: item.detail } : item
        )
      );
      await sleep(650);

      if (order[i] === 'builder') {
        setGenesisChecks((prev) =>
          prev.map((item, index) =>
            index === i
              ? { ...item, status: data.ok ? 'pass' : 'fail', detail: '结构化输出完成。' }
              : item
          )
        );
      } else {
        const checkResult = data.checks?.[order[i]];
        const status = checkResult?.status === 'warn' ? 'warn' : checkResult?.status || 'fail';
        setGenesisChecks((prev) =>
          prev.map((item, index) =>
            index === i
              ? { ...item, status, detail: checkResult?.message || '检测失败。' }
              : item
          )
        );
      }
      await sleep(400);
    }

    if (!data.ok) {
      setGenesisError('创世纪校验未通过，请重新调整输入后再试。');
      return;
    }

    setPhase('GENESIS_LOADING');

    const buildResponse = await fetch(`${API_BASE}/api/genesis/build`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        settings: worldSettings,
        modelSettings,
        sanitizedInput: data.sanitizedInput || {},
        worldDesc: worldSettings.worldDesc,
        charDesc: worldSettings.charDesc
      })
    });
    const buildData = await buildResponse.json();

    if (!buildData.ok) {
      setGenesisError(buildData.error || '创世纪生成失败，请稍后重试。');
      return;
    }

    setPlayerInput(buildData.playerInput);
    setWorldBuilder(buildData.worldBuilder);
    setMultiAgent(buildData.multiAgent);
    setAssets(buildData.assets);
    setCharacter(buildData.character);
    setWorld(buildData.world);
    setTaskLine(buildData.taskLine || []);
    setQuestLog([
      { type: 'narrator', text: buildData.multiAgent?.narrator?.origin_story },
      { type: 'system', text: buildData.firstQuest?.text }
    ]);
    setCurrentOptions(buildData.firstQuest?.options || []);

    localStorage.setItem(
      'genesisSession',
      JSON.stringify({
        playerInput: buildData.playerInput,
        worldBuilder: buildData.worldBuilder,
        multiAgent: buildData.multiAgent,
        assets: buildData.assets,
        character: buildData.character,
        world: buildData.world,
        taskLine: buildData.taskLine || [],
        questLog: [
          { type: 'narrator', text: buildData.multiAgent?.narrator?.origin_story },
          { type: 'system', text: buildData.firstQuest?.text }
        ],
        currentOptions: buildData.firstQuest?.options || []
      })
    );

    localStorage.setItem(
      'genesisDebug',
      JSON.stringify({
        worldBuilder: buildData.worldBuilder,
        multiAgent: buildData.multiAgent,
        assets: buildData.assets
      })
    );

    await sleep(800);
    setPhase('GAME');
  };

  const handleAction = async (actionText) => {
    setQuestLog((prev) => [...prev, { type: 'player', text: actionText }]);
    setCustomInput('');
    setIsLoadingTurn(true);

    const response = await fetch(`${API_BASE}/api/turn`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ action: actionText, stats: character.stats })
    });
    const result = await response.json();

    setQuestLog((prev) => [...prev, { type: 'narrator', text: result.narrative }]);
    setCurrentOptions(result.newOptions);
    setCharacter((prev) => ({
      ...prev,
      stats: { ...prev.stats, ...result.statUpdates }
    }));

    if (result.mapUnlock) {
      setWorld((prev) => ({
        ...prev,
        mapNodes: [...prev.mapNodes, result.mapUnlock]
      }));
    }

    setIsLoadingTurn(false);
  };

  const handleSave = async () => {
    if (!character || !world) return;
    setSaveStatus('saving');

    const response = await fetch(`${API_BASE}/api/save`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        character,
        world,
        questLog,
        taskLine,
        playerInput,
        worldBuilder,
        multiAgent,
        assets
      })
    });

    const result = await response.json();
    if (result.id) {
      setSaveId(result.id);
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('error');
  };

  const renderSetup = () => (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-end">
          <a href="/settings" className="text-xs text-cyan-400 hover:text-cyan-300">
            打开设置
          </a>
        </div>
        <h1 className="text-4xl md:text-5xl font-extralight tracking-[0.3em] text-center mb-10 text-white">
          BEAUTIFUL <span className="font-semibold text-cyan-400">LIFE</span>
        </h1>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['magic', 'physics', 'tech'].map((attr) => (
              <div key={attr} className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-slate-500">
                  {attr} Level
                </label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 focus:outline-none"
                  value={worldSettings[attr]}
                  onChange={(e) => setWorldSettings({ ...worldSettings, [attr]: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="mid">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500">世界描述 (World Context)</label>
            <textarea
              className="w-full h-28 bg-slate-800 border border-slate-700 rounded p-3 text-sm focus:border-cyan-500 focus:outline-none resize-none"
              placeholder="描述你想要的世界..."
              value={worldSettings.worldDesc}
              onChange={(e) => setWorldSettings({ ...worldSettings, worldDesc: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-500">角色描述 (Character Origin)</label>
            <textarea
              className="w-full h-20 bg-slate-800 border border-slate-700 rounded p-3 text-sm focus:border-cyan-500 focus:outline-none resize-none"
              placeholder="描述你的主角..."
              value={worldSettings.charDesc}
              onChange={(e) => setWorldSettings({ ...worldSettings, charDesc: e.target.value })}
            />
          </div>

          <button
            onClick={handleStartGenesis}
            className="w-full py-4 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 font-semibold tracking-widest rounded-lg transition-all border border-cyan-700 shadow-[0_0_20px_rgba(34,211,238,0.25)] mt-4"
          >
            开始模拟 / INITIALIZE
          </button>
        </div>
      </div>
    </div>
  );

  const renderGenesis = () => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-white">创世纪 · Genesis</h2>
          <p className="text-sm text-slate-500 mt-2">正在进行多层检查与结构化构建，请稍候...</p>
        </div>

        <div className="space-y-3">
          {genesisChecks.map((check) => (
            <GenesisCheckItem
              key={check.key}
              title={check.title}
              status={check.status}
              detail={check.detail}
            />
          ))}
        </div>

        {genesisError && (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 rounded-xl p-4 text-sm">
            {genesisError}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPhase('SETUP')}
                className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
              >
                返回调整
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderGenesisLoading = () => (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.35),rgba(0,0,0,0.95))]" />
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="genesis-title text-4xl md:text-5xl tracking-[0.4em] font-semibold">
          创世纪
        </div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Genesis Loading</p>
        {genesisError && (
          <div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 rounded-xl p-4 text-sm max-w-md">
            {genesisError}
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setPhase('SETUP')}
                className="px-4 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
              >
                返回调整
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="h-screen bg-slate-950 text-slate-200 flex overflow-hidden">
      <div className="w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col hidden lg:flex">
        <div className="p-6 flex flex-col items-center border-b border-slate-800 bg-slate-900/80">
          <div
            className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarGradient} mb-4 shadow-lg ring-4 ring-slate-800 flex items-center justify-center text-4xl text-white/70 overflow-hidden`}
          >
            {assets?.avatar?.image ? (
              <img src={assets.avatar.image} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <User size={40} />
            )}
          </div>
          <h2 className="text-xl font-semibold text-white">{character.name}</h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{character.title}</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
            <Activity size={14} /> 核心属性
          </h3>
          <StatBar icon={Sword} label="力量 (STR)" value={character.stats.str} color="bg-rose-500" />
          <StatBar icon={Zap} label="敏捷 (DEX)" value={character.stats.dex} color="bg-amber-500" />
          <StatBar icon={Brain} label="智力 (INT)" value={character.stats.int} color="bg-cyan-500" />
          <StatBar icon={Feather} label="魅力 (CHA)" value={character.stats.cha} color="bg-purple-500" />

          <div className="mt-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
              <Backpack size={14} /> 物品 & 资产
            </h3>
            <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded mb-3 border border-slate-700">
              <span className="text-sm text-amber-400 flex items-center gap-2">
                <Coins size={14} /> 信用点
              </span>
              <span className="font-mono text-white">{character.stats.money}</span>
            </div>
            <div className="space-y-2">
              {character.inventory.map((item) => (
                <div
                  key={item}
                  className="text-sm bg-slate-800/80 p-2 rounded border border-slate-700 text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
              <Shield size={14} /> 世界势力
            </h3>
            <div className="space-y-2">
              {world.factions.map((faction) => (
                <div
                  key={faction}
                  className="text-xs uppercase tracking-widest bg-slate-800/80 px-3 py-2 rounded border border-slate-700 text-slate-300"
                >
                  {faction}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/60 backdrop-blur z-10">
          <div>
            <span className="text-xs text-cyan-400 uppercase tracking-wider">当前区域</span>
            <h2 className="text-lg font-semibold text-white">{world.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
            >
              Settings
            </a>
            <a
              href="/debug"
              className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
            >
              Debug
            </a>
            <a
              href="/log"
              className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
            >
              Log
            </a>
            <button
              onClick={handleSave}
              className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
            >
              {saveStatus === 'saving' ? '保存中...' : '保存游戏'}
            </button>
            <button
              onClick={() => setIsMapOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-cyan-300 transition-colors flex items-center gap-2"
            >
              <MapIcon size={18} />
              <span className="hidden sm:inline text-sm">打开地图</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 scroll-smooth" ref={scrollRef}>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-xs uppercase tracking-widest text-cyan-400 mb-3">玩家身份</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{playerInput?.charDesc}</p>
              <p className="text-xs text-slate-500 mt-2">{multiAgent?.narrator?.origin_story}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-xs uppercase tracking-widest text-cyan-400 mb-3">世界观概览</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{worldBuilder?.world_setting}</p>
              <p className="text-xs text-slate-500 mt-2">{worldBuilder?.Power_level}</p>
            </div>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs uppercase tracking-widest text-cyan-400 mb-3">系统任务线</h3>
            <div className="space-y-2 text-sm text-slate-300">
              {taskLine.map((line) => (
                <p key={line} className="leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
            {saveId && <p className="mt-3 text-xs text-emerald-400">存档编号：{saveId}</p>}
          </section>

          <section className="space-y-6">
            {questLog.map((log, index) => (
              <div
                key={`${log.type}-${index}`}
                className={`flex ${log.type === 'player' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm text-base leading-relaxed ${
                    log.type === 'player'
                      ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700'
                      : log.type === 'system'
                      ? 'bg-slate-900/80 text-slate-200 border border-cyan-700/60'
                      : 'bg-transparent text-slate-300 border-l-2 border-cyan-500 pl-6 rounded-none'
                  }`}
                >
                  {log.text}
                </div>
              </div>
            ))}

            {isLoadingTurn && (
              <div className="flex justify-start animate-pulse pl-6">
                <span className="text-cyan-400 text-sm">AI 正在推演世界线变动...</span>
              </div>
            )}
          </section>
        </div>

        <div className="min-h-[200px] bg-slate-900 border-t border-slate-800 p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {currentOptions.map((opt, i) => (
              <button
                key={opt}
                onClick={() => handleAction(opt)}
                disabled={isLoadingTurn}
                className="p-3 text-sm text-left bg-slate-800 hover:bg-slate-700 hover:border-cyan-400 border border-slate-700 rounded-lg transition-all duration-200 text-slate-300 disabled:opacity-50"
              >
                {i + 1}. {opt}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && customInput && handleAction(customInput)}
              placeholder="或者输入你自己的行动..."
              disabled={isLoadingTurn}
              className="flex-1 bg-black/40 border border-slate-700 rounded-lg px-4 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              onClick={() => customInput && handleAction(customInput)}
              disabled={isLoadingTurn || !customInput}
              className="px-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-700 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsMapOpen(true)}
        className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-full text-cyan-300 gap-2 items-center shadow-lg"
      >
        <MapIcon size={18} />
        地图
      </button>

      {world && (
        <GameMap
          nodes={world.mapNodes}
          isOpen={isMapOpen}
          toggle={() => setIsMapOpen(false)}
          mapImage={assets?.map?.image}
        />
      )}
    </div>
  );

  if (window.location.pathname === '/debug') {
    return <DebugView />;
  }
  if (window.location.pathname === '/log') {
    return <LogView />;
  }
  if (window.location.pathname === '/settings') {
    return <SettingsView modelSettings={modelSettings} onSave={setModelSettings} />;
  }

  return (
    <>
      {phase === 'SETUP' && renderSetup()}
      {phase === 'GENESIS' && renderGenesis()}
      {phase === 'GENESIS_LOADING' && renderGenesisLoading()}
      {phase === 'GAME' && character && world && renderGame()}
    </>
  );
}
