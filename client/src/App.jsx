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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openaiApiKey') || '');
  const [keyStatus, setKeyStatus] = useState('idle');

  useEffect(() => {
    const stored = localStorage.getItem('genesisDebug');
    if (stored) {
      setDebugData(JSON.parse(stored));
    }
  }, []);

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('openaiApiKey', trimmed);
      setKeyStatus('saved');
    } else {
      localStorage.removeItem('openaiApiKey');
      setKeyStatus('cleared');
    }
    setTimeout(() => setKeyStatus('idle'), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Genesis Debug Console</h1>
        <a href="/" className="text-cyan-400 text-sm">
          返回游戏
        </a>
      </div>

      <section className="space-y-3 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h2 className="text-lg text-cyan-300">调试 Key</h2>
        <p className="text-xs text-slate-400">
          Debug 模式下可写入 API Key，仅保存在浏览器本地存储中。
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="password"
            className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 focus:outline-none"
            placeholder="输入 API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            onClick={handleSaveKey}
            className="px-4 py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 text-sm font-semibold rounded-lg border border-cyan-700"
          >
            保存 Key
          </button>
        </div>
        {keyStatus !== 'idle' && (
          <p className="text-xs text-emerald-400">
            {keyStatus === 'saved' ? 'Key 已保存。' : 'Key 已清除。'}
          </p>
        )}
      </section>

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

  const scrollRef = useRef(null);

  const buildHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const storedKey = localStorage.getItem('openaiApiKey');
    if (storedKey) {
      headers['X-API-Key'] = storedKey;
    }
    return headers;
  };

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

    const response = await fetch(`${API_BASE}/api/genesis`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(worldSettings)
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

    setPlayerInput(data.playerInput);
    setWorldBuilder(data.worldBuilder);
    setMultiAgent(data.multiAgent);
    setAssets(data.assets);
    setCharacter(data.character);
    setWorld(data.world);
    setTaskLine(data.taskLine || []);
    setQuestLog([
      { type: 'narrator', text: data.multiAgent?.narrator?.origin_story },
      { type: 'system', text: data.firstQuest?.text }
    ]);
    setCurrentOptions(data.firstQuest?.options || []);

    localStorage.setItem(
      'genesisDebug',
      JSON.stringify({
        worldBuilder: data.worldBuilder,
        multiAgent: data.multiAgent,
        assets: data.assets
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
              href="/debug"
              className="px-3 py-2 text-xs uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:text-white hover:border-cyan-400 transition"
            >
              Debug
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

  return (
    <>
      {phase === 'SETUP' && renderSetup()}
      {phase === 'GENESIS' && renderGenesis()}
      {phase === 'GAME' && character && world && renderGame()}
    </>
  );
}
