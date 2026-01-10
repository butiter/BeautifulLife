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
  User,
  Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const rng = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

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
        style={{ width: `${Math.min(value * 4, 100)}%` }}
      />
    </div>
  </div>
);

const GameMap = ({ nodes, isOpen, toggle }) => (
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

export default function App() {
  const [phase, setPhase] = useState('SETUP');
  const [genesisStep, setGenesisStep] = useState(0);
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

  const scrollRef = useRef(null);

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

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setGenesisStep(step);
      if (step > 3) clearInterval(interval);
    }, 800);

    const response = await fetch(`${API_BASE}/api/genesis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(worldSettings)
    });
    const data = await response.json();

    setCharacter(data.character);
    setWorld(data.world);
    setTaskLine(data.taskLine || []);
    setQuestLog([{ type: 'narrator', text: data.firstQuest.text }]);
    setCurrentOptions(data.firstQuest.options);

    setTimeout(() => setPhase('GAME'), 3200);
  };

  const handleAction = async (actionText) => {
    setQuestLog((prev) => [...prev, { type: 'player', text: actionText }]);
    setCustomInput('');
    setIsLoadingTurn(true);

    const response = await fetch(`${API_BASE}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character,
        world,
        questLog,
        taskLine
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className={`text-6xl md:text-8xl font-black tracking-widest text-white transition-opacity duration-1000 ${
          genesisStep >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        创
      </div>
      <div
        className={`text-6xl md:text-8xl font-black tracking-widest text-white transition-opacity duration-1000 delay-300 mt-4 ${
          genesisStep >= 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        世
      </div>
      <div
        className={`text-6xl md:text-8xl font-black tracking-widest text-white transition-opacity duration-1000 delay-600 mt-4 ${
          genesisStep >= 3 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        纪
      </div>

      <div className="absolute bottom-10 text-cyan-400 font-mono text-sm animate-pulse">
        Generating World Parameters... 构建神经网络...
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="h-screen bg-slate-950 text-slate-200 flex overflow-hidden">
      <div className="w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col hidden lg:flex">
        <div className="p-6 flex flex-col items-center border-b border-slate-800 bg-slate-900/80">
          <div
            className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarGradient} mb-4 shadow-lg ring-4 ring-slate-800 flex items-center justify-center text-4xl text-white/70`}
          >
            <User size={40} />
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
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs uppercase tracking-widest text-cyan-400 mb-3">系统任务线</h3>
            <div className="space-y-2 text-sm text-slate-300">
              {taskLine.map((line) => (
                <p key={line} className="leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
            {saveId && (
              <p className="mt-3 text-xs text-emerald-400">存档编号：{saveId}</p>
            )}
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

      {world && <GameMap nodes={world.mapNodes} isOpen={isMapOpen} toggle={() => setIsMapOpen(false)} />}
    </div>
  );

  return (
    <>
      {phase === 'SETUP' && renderSetup()}
      {phase === 'GENESIS' && renderGenesis()}
      {phase === 'GAME' && character && world && renderGame()}
    </>
  );
}

