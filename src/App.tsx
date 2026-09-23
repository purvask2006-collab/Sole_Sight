import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sun,
  Wind,
  Droplets,
  AlertTriangle,
  Zap,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Radio,
  FileCode,
  Download,
  Copy,
  Info,
  Layers,
  Thermometer,
  CloudRain,
  ChevronRight,
  ShieldCheck,
  Bot,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  MapPin,
  IndianRupee,
  Leaf,
  Box
} from 'lucide-react';
import { SolarFarm3DView } from './components/SolarFarm3DView';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
  ChartOptions
} from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

interface SolarBlock {
  id: string;
  row: string;
  col: number;
  soiling: number; // 0 to 45%
  isCleaning: boolean;
  lastCleaned: string;
  ratedOutputKw: number;
  dustType: 'Fine Sand' | 'Airborne Dust' | 'Bird Droppings' | 'Pollen';
}

interface LogEntry {
  id: string;
  time: string;
  block: string;
  action: string;
  trigger: string;
  waterUsed: string;
  recovery: string;
  status: 'clean' | 'skip' | 'emergency' | 'dew';
}

export default function App() {
  // Simulation Controls State
  const [soilingRate, setSoilingRate] = useState<number>(18.3);
  const [windSpeed, setWindSpeed] = useState<number>(18);
  const [dewHarvesting, setDewHarvesting] = useState<boolean>(true);
  const [satelliteAlerts, setSatelliteAlerts] = useState<boolean>(true);
  const [dustStormActive, setDustStormActive] = useState<boolean>(false);
  const [morningDewActive, setMorningDewActive] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [standaloneHtml, setStandaloneHtml] = useState<string>('');

  // Fetch full standalone HTML
  useEffect(() => {
    fetch('/solesight-ai-dashboard.html')
      .then(res => res.text())
      .then(html => setStandaloneHtml(html))
      .catch(() => {});
  }, []);
  
  // Chart refs
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Selected Block Modal / Hover
  const [hoveredBlock, setHoveredBlock] = useState<SolarBlock | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<SolarBlock | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [cleanAllInProgress, setCleanAllInProgress] = useState<boolean>(false);
  const [waterSaved, setWaterSaved] = useState<number>(1240);

  // Audio tone helper
  const playBeep = (freq = 440, type: OscillatorType = 'sine', duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext muted/unsupported
    }
  };

  // Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Kolkata'
        }) + ' IST'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 24 Solar Blocks Setup (6x4 grid)
  const [blocks, setBlocks] = useState<SolarBlock[]>(() => {
    const rows = ['A', 'B', 'C', 'D'];
    const initial: SolarBlock[] = [];
    
    // Seeded variations
    const seedVariations = [
      8.5, 9.2, 28.4, 14.1, 7.8, 31.2,
      12.0, 22.4, 15.6, 29.8, 8.1, 16.5,
      27.1, 18.0, 11.2, 9.8, 24.3, 19.5,
      10.5, 13.8, 33.2, 17.4, 21.0, 8.9
    ];

    let idx = 0;
    for (const r of rows) {
      for (let c = 1; c <= 6; c++) {
        const id = `${r}${c}`;
        const base = seedVariations[idx] || 18.0;
        const dustTypes: ('Fine Sand' | 'Airborne Dust' | 'Bird Droppings' | 'Pollen')[] = [
          'Fine Sand', 'Airborne Dust', 'Bird Droppings', 'Pollen'
        ];
        initial.push({
          id,
          row: r,
          col: c,
          soiling: base,
          isCleaning: false,
          lastCleaned: c % 2 === 0 ? '1 day ago' : '05:15 AM today',
          ratedOutputKw: 416.7, // 24 * 416.7 kW ≈ 10,000 kW (10 MW)
          dustType: dustTypes[(idx * 3) % 4]
        });
        idx++;
      }
    }
    return initial;
  });

  // Cleaning Activity Log
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      time: '02:00 PM',
      block: 'Block C2',
      action: 'Robot Deployed',
      trigger: 'LCR > 3.0',
      waterUsed: '45 L',
      recovery: '+11.5%',
      status: 'clean'
    },
    {
      id: 'log-2',
      time: '08:30 AM',
      block: 'Block B4',
      action: 'Skipped',
      trigger: 'AI Decision',
      waterUsed: '0 L',
      recovery: 'Rain forecast',
      status: 'skip'
    },
    {
      id: 'log-3',
      time: '05:15 AM',
      block: 'Block A1',
      action: 'Dew Harvest Clean',
      trigger: 'Auto',
      waterUsed: '0 L',
      recovery: '+8.2%',
      status: 'dew'
    },
    {
      id: 'log-4',
      time: 'Yesterday',
      block: 'Block D5',
      action: 'Robot Deployed',
      trigger: 'Soiling > 26%',
      waterUsed: '40 L',
      recovery: '+13.1%',
      status: 'clean'
    }
  ]);

  // Sync block soiling values dynamically when slider changes
  const handleSoilingSliderChange = (newSoiling: number) => {
    setSoilingRate(newSoiling);
    setBlocks(prev =>
      prev.map(b => {
        if (b.isCleaning) return b;
        // Distribute variance around the target average soiling rate
        const factor = (newSoiling / 18.3);
        const randomJitter = ((b.col * 7 + b.row.charCodeAt(0)) % 7) - 3;
        const computed = Math.max(1, Math.min(48, Number((b.soiling * 0.4 + (newSoiling + randomJitter) * 0.6).toFixed(1))));
        return {
          ...b,
          soiling: computed
        };
      })
    );
  };

  // KPIs Calculations
  const averageSoiling = useMemo(() => {
    if (blocks.length === 0) return soilingRate;
    const sum = blocks.reduce((acc, curr) => acc + curr.soiling, 0);
    return Number((sum / blocks.length).toFixed(1));
  }, [blocks, soilingRate]);

  // Generation: Nominal clear sky generation for this hour is ~7.8 MW.
  // Efficiency loss is directly proportional to soiling
  const cleanBaselineMw = 7.75;
  const currentGenMw = useMemo(() => {
    const lossPercentage = averageSoiling * 0.68; // ~12.4% drop at 18.3% soiling
    const actual = cleanBaselineMw * (1 - lossPercentage / 100);
    return Math.max(1.8, Math.min(cleanBaselineMw, Number(actual.toFixed(1))));
  }, [averageSoiling]);

  const generationLossPercent = useMemo(() => {
    const diff = ((currentGenMw - cleanBaselineMw) / cleanBaselineMw) * 100;
    return Math.abs(Number(diff.toFixed(0)));
  }, [currentGenMw]);

  // Revenue loss: 10 MW plant, Rajasthan APPC tariff ~₹3.15 per kWh
  // Daily generation loss = (cleanBaselineMw - currentGenMw) * 5.5 peak sun hours * 1000 kWh/MWh * ₹3.15
  const dailyRevenueLoss = useMemo(() => {
    const lostMw = Math.max(0, cleanBaselineMw - currentGenMw);
    const lostKwhDaily = lostMw * 5.8 * 1000;
    const lossInr = Math.round(lostKwhDaily * 3.18);
    return Math.max(4500, lossInr);
  }, [currentGenMw]);

  // Critical blocks count (> 25% soiling)
  const criticalBlocks = useMemo(() => {
    return blocks.filter(b => b.soiling > 25);
  }, [blocks]);

  const moderateBlocks = useMemo(() => {
    return blocks.filter(b => b.soiling >= 10 && b.soiling <= 25);
  }, [blocks]);

  // AI Recommendation Metrics
  const lcrRatio = useMemo(() => {
    if (dustStormActive) return '7.4 : 1';
    if (averageSoiling > 25) return '5.8 : 1';
    if (averageSoiling > 15) return '4.2 : 1';
    if (averageSoiling > 10) return '2.6 : 1';
    return '1.2 : 1';
  }, [dustStormActive, averageSoiling]);

  const estimatedRoi = useMemo(() => {
    const gain = Math.round(dailyRevenueLoss * 0.44);
    return `₹${gain.toLocaleString('en-IN')}`;
  }, [dailyRevenueLoss]);

  // AI recommendation text
  const aiAnalysisText = useMemo(() => {
    if (dustStormActive) {
      return 'CRITICAL SANDSTORM EVENT: Satellite aerosol optical depth > 1.8. Immediate perimeter robot lockdown, followed by emergency cycle upon wind stabilization.';
    }
    if (criticalBlocks.length > 0) {
      const topIds = criticalBlocks.slice(0, 3).map(b => `Block ${b.id}`).join(', ');
      return `${topIds}${criticalBlocks.length > 3 ? ` +${criticalBlocks.length - 3} more` : ''} showing soiling loss > cleaning cost`;
    }
    return 'All sectors nominal. Scheduled dew harvest active; no high-loss zones detected.';
  }, [criticalBlocks, dustStormActive]);

  // Chart Data preparation
  const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  // Theoretical clear sky curve peaking at 12:00-14:00
  const expectedPowerCurve = [0.0, 0.0, 0.0, 1.2, 4.6, 7.8, 8.6, 7.9, 4.8, 1.1, 0.0, 0.0];
  
  const actualPowerCurve = useMemo(() => {
    const factor = (1 - (averageSoiling * 0.72) / 100);
    return expectedPowerCurve.map(val => Number((val * factor).toFixed(2)));
  }, [averageSoiling]);

  const chartData = {
    labels: hours,
    datasets: [
      {
        label: 'Expected Output (Clean Panels)',
        data: expectedPowerCurve,
        borderColor: '#F5A62B', // Solar orange
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        fill: false
      },
      {
        label: 'Actual Output (Current Soiling)',
        data: actualPowerCurve,
        borderColor: '#27AE60', // Sustainability green
        backgroundColor: 'rgba(239, 68, 68, 0.18)', // Red shaded loss between lines
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: '#27AE60',
        tension: 0.35,
        fill: '-1' // Fills between Actual and Expected line
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 14,
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
          color: '#334155'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#0A2E5C',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        padding: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y} MW`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.7)' },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#64748b' }
      },
      y: {
        min: 0,
        max: 10,
        title: {
          display: true,
          text: 'Power (MW)',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
          color: '#475569'
        },
        grid: { color: 'rgba(226, 232, 240, 0.7)' },
        ticks: {
          font: { family: 'JetBrains Mono', size: 10 },
          color: '#64748b',
          stepSize: 2
        }
      }
    }
  };

  // Direct Chart.js rendering effect
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [actualPowerCurve]);

  // Trigger Autonomous Cleaning for Critical Blocks
  const handleTriggerCleaning = () => {
    if (cleanAllInProgress) return;
    setCleanAllInProgress(true);
    playBeep(620, 'sine', 0.2);

    const targetBlocks = criticalBlocks.length > 0 ? criticalBlocks : moderateBlocks;
    const targetIds = new Set(targetBlocks.map(b => b.id));

    // Turn target blocks to cleaning pulse
    setBlocks(prev =>
      prev.map(b => (targetIds.has(b.id) ? { ...b, isCleaning: true } : b))
    );

    // Simulate robot travel & cleaning cycle (2 seconds)
    setTimeout(() => {
      setBlocks(prev =>
        prev.map(b => {
          if (targetIds.has(b.id)) {
            return {
              ...b,
              isCleaning: false,
              soiling: Number((3.5 + Math.random() * 2.5).toFixed(1)), // clean to 3-6%
              lastCleaned: 'Just now (SoleSight Bot)'
            };
          }
          return b;
        })
      );

      // Add log entry
      const nowStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        time: nowStr,
        block: targetBlocks.length > 1 ? `${targetBlocks.length} Blocks Fleet` : `Block ${targetBlocks[0]?.id || 'A3'}`,
        action: 'Autonomous Robot Deployed',
        trigger: 'LCR > 3.0 Threshold',
        waterUsed: dewHarvesting ? '0 L (Dry Brush)' : `${targetBlocks.length * 35} L`,
        recovery: `+${(targetBlocks.length * 2.4).toFixed(1)}%`,
        status: 'clean'
      };

      setLogs(prev => [newLog, ...prev.slice(0, 7)]);
      setCleanAllInProgress(false);
      playBeep(880, 'sine', 0.3);
    }, 2200);
  };

  // Clean a single block
  const handleCleanSingleBlock = (blockId: string) => {
    playBeep(520, 'sine', 0.15);
    setBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, isCleaning: true } : b))
    );

    setTimeout(() => {
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? {
                ...b,
                isCleaning: false,
                soiling: 4.1,
                lastCleaned: 'Just now'
              }
            : b
        )
      );

      const nowStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      setLogs(prev => [
        {
          id: `log-${Date.now()}`,
          time: nowStr,
          block: `Block ${blockId}`,
          action: 'Spot Clean Deployed',
          trigger: 'Manual Dispatch',
          waterUsed: '0 L (Dry)',
          recovery: '+9.8%',
          status: 'clean'
        },
        ...prev.slice(0, 7)
      ]);

      if (selectedBlock?.id === blockId) {
        setSelectedBlock(prev => (prev ? { ...prev, soiling: 4.1, isCleaning: false } : null));
      }
      playBeep(780, 'sine', 0.2);
    }, 1800);
  };

  // Simulate Dust Storm Action
  const handleSimulateDustStorm = () => {
    playBeep(260, 'sawtooth', 0.4);
    setDustStormActive(true);
    setWindSpeed(42);

    // Random blocks jump to critical soiling
    setBlocks(prev =>
      prev.map(b => {
        const jump = 28 + Math.floor(Math.random() * 15);
        return {
          ...b,
          soiling: jump
        };
      })
    );

    // Add alert log
    const nowStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        time: nowStr,
        block: 'All Sectors (24)',
        action: 'Dust Storm Influx',
        trigger: 'INSAT-3D Satellite',
        waterUsed: '0 L',
        recovery: '-18.5% Loss',
        status: 'emergency'
      },
      ...prev.slice(0, 7)
    ]);
  };

  // Simulate Morning Dew Action
  const handleSimulateMorningDew = () => {
    playBeep(680, 'sine', 0.3);
    setMorningDewActive(true);

    // Dew droplets animation for 2.5s
    setTimeout(() => {
      setMorningDewActive(false);
    }, 2800);

    // All blocks experience natural dew lubrication and dry micro-clearing
    setBlocks(prev =>
      prev.map(b => ({
        ...b,
        soiling: Math.max(3.2, Number((b.soiling * 0.55).toFixed(1))),
        lastCleaned: '05:15 AM Dew Cycle'
      }))
    );

    setWaterSaved(prev => prev + 340);

    const nowStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        time: nowStr,
        block: 'Block A1-D6',
        action: 'Dew Harvest Clean',
        trigger: 'Microclimate Dew Point',
        waterUsed: '0 L (Passive)',
        recovery: '+10.4%',
        status: 'dew'
      },
      ...prev.slice(0, 7)
    ]);
  };

  // Reset Simulation to SIH Default
  const handleResetSimulation = () => {
    playBeep(440, 'triangle', 0.2);
    setSoilingRate(18.3);
    setWindSpeed(18);
    setDewHarvesting(true);
    setSatelliteAlerts(true);
    setDustStormActive(false);
    setMorningDewActive(false);
    setWaterSaved(1240);

    const seedVariations = [
      8.5, 9.2, 28.4, 14.1, 7.8, 31.2,
      12.0, 22.4, 15.6, 29.8, 8.1, 16.5,
      27.1, 18.0, 11.2, 9.8, 24.3, 19.5,
      10.5, 13.8, 33.2, 17.4, 21.0, 8.9
    ];

    setBlocks(prev =>
      prev.map((b, idx) => ({
        ...b,
        soiling: seedVariations[idx] || 18.0,
        isCleaning: false,
        lastCleaned: b.col % 2 === 0 ? '1 day ago' : '05:15 AM today'
      }))
    );
  };

  // Single-file HTML generator code for download & export
  const getSingleFileHtmlCode = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoleSight AI | Solar Asset Intelligence Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .bg-solar-navy { background-color: #0A2E5C; }
    .text-solar-navy { color: #0A2E5C; }
    @keyframes pulseCleaning { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 50% { box-shadow: 0 0 16px 4px rgba(59, 130, 246, 0.9); } }
    .cleaning-pulse { animation: pulseCleaning 1.2s infinite; }
  </style>
</head>
<body class="bg-slate-100 text-slate-800 antialiased">
  <!-- Top Navigation Bar -->
  <header class="bg-solar-navy text-white px-6 py-3.5 flex flex-wrap items-center justify-between shadow-md border-b border-blue-950">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xl">
        <i class="fa-solid fa-solar-panel"></i>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold tracking-tight text-white">SoleSight AI <span class="text-amber-400">|</span> Solar Asset Intelligence</h1>
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-700/50">SIH 2024</span>
        </div>
        <p class="text-xs text-slate-300 flex items-center gap-2">
          <span><i class="fa-solid fa-location-dot text-amber-400 mr-1"></i> Bikaner Solar Park, Rajasthan | 10 MW</span>
          <span>·</span>
          <span class="text-emerald-400 inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span> System Online</span>
        </p>
      </div>
    </div>
    <div class="flex items-center gap-4 text-xs font-mono text-slate-300">
      <div class="px-3 py-1.5 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center gap-2">
        <i class="fa-regular fa-clock text-amber-400"></i>
        <span id="liveClock">${currentTime || '12:00:00 IST'}</span>
      </div>
    </div>
  </header>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- View full interactive React app in preview or run with simulated Rajasthan desert solar data -->
    <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h2 class="text-xl font-bold text-slate-900 mb-2">Smart India Hackathon 2024 — SoleSight AI</h2>
      <p class="text-sm text-slate-600 mb-4">Complete production-ready solar farm telemetry dashboard deployed for Bikaner Solar Park 10 MW installation.</p>
    </div>
  </div>
</body>
</html>`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(standaloneHtml || getSingleFileHtmlCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadHtml = () => {
    const content = standaloneHtml || getSingleFileHtmlCode();
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = 'solesight-ai-dashboard.html';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 selection:bg-amber-500 selection:text-white relative">
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className="bg-solar-navy text-white px-4 sm:px-6 py-3.5 shadow-lg border-b border-blue-950 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand & Plant Location */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
              <Sun className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  SoleSight AI <span className="text-amber-400 font-normal">|</span> Solar Asset Intelligence Dashboard
                </h1>
                <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-900/90 text-amber-300 border border-blue-700/60 shadow-xs">
                  Smart India Hackathon 2024
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Bikaner Solar Park, Rajasthan | 10 MW
                </span>
                <span className="text-slate-500">·</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  System Online
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Live Clock */}
          <div className="flex items-center gap-3 self-end md:self-center">
            {/* Live Clock */}
            <div className="px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-800/60 text-xs font-mono text-slate-200 flex items-center gap-2 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentTime || 'Loading clock...'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playBeep(soundEnabled ? 300 : 600, 'sine', 0.15);
              }}
              title={soundEnabled ? 'Disable Simulation Sound' : 'Enable Simulation Sound'}
              className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-center ${
                soundEnabled
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-blue-950/50 border-blue-800/40 text-slate-400 hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Single-file HTML Modal */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Single HTML</span>
            </button>
          </div>
        </div>
      </header>

      {/* DUST STORM ALERT BANNER (Conditional) */}
      {dustStormActive && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md animate-pulse">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              DUST STORM DETECTED — SATELLITE ALERT ACTIVE (AOD 1.84 over Bikaner sector). High-velocity particulates settling across sectors.
            </span>
            <button
              onClick={() => setDustStormActive(false)}
              className="underline hover:text-slate-200 ml-4 font-normal"
            >
              Dismiss Alert
            </button>
          </div>
        </div>
      )}

      {/* MORNING DEW NOTIFICATION (Conditional) */}
      {morningDewActive && (
        <div className="bg-blue-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm">
          <Droplets className="w-4 h-4 text-cyan-200 animate-bounce" />
          <span>Morning dew harvesting cycle engaged — passive dust aggregation & recovery active.</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        
        {/* 2. KPI CARDS ROW (4 cards with animated number counters) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Current Generation */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Generation</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                    {currentGenMw} MW
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-solar-orange">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>-{generationLossPercent}% vs clean baseline</span>
              <span className="text-slate-400 font-normal">· (7.8 MW nominal)</span>
            </div>
            {/* Visual Mini Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(currentGenMw / 10) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* KPI 2: Soiling Ratio */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Soiling Ratio</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                    {averageSoiling}%
                  </span>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                averageSoiling > 25
                  ? 'bg-rose-50 border border-rose-200 text-rose-600'
                  : averageSoiling >= 10
                  ? 'bg-amber-50 border border-amber-200 text-amber-600'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
              }`}>
                <Sun className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                averageSoiling > 25
                  ? 'bg-rose-100 text-rose-800'
                  : averageSoiling >= 10
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  averageSoiling > 25 ? 'bg-rose-600' : averageSoiling >= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}></span>
                {averageSoiling > 25 ? 'Critical Level' : averageSoiling >= 10 ? 'Moderate Soiling' : 'Clean Nominal'}
              </span>
              <span className="text-xs text-slate-500">24 blocks active</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  averageSoiling > 25 ? 'bg-rose-500' : averageSoiling >= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (averageSoiling / 40) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* KPI 3: Daily Revenue Loss */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Daily Revenue Loss</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight font-mono">
                    ₹{dailyRevenueLoss.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-rose-700 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Due to soiling accumulation
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              ~₹{(dailyRevenueLoss / 24).toFixed(0)}/hr at current irradiance
            </p>
          </div>

          {/* KPI 4: Water Saved Today */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Water Saved Today</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight font-mono">
                    {waterSaved.toLocaleString('en-IN')} L
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                <Leaf className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <Droplets className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Dry-brush + Dew Harvesting</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              vs manual high-pressure wash (1,800 L)
            </p>
          </div>

        </section>

        {/* 3. MAIN VISUALIZATION AREA (2-column layout: 60% Left, 40% Right) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN (60% width -> 7 cols on lg, or approx 60%) */}
          <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-4 h-4 text-solar-navy" />
                  Solar Farm Visualization
                  <span className="text-xs font-mono font-normal text-slate-500">
                    (24 Blocks · 10 MW Bikaner)
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Interactive real-time digital twin and autonomous cleaning fleet telemetry.
                </p>
              </div>

              {/* Viewport mode toggle & Quick action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 3D vs 2D Segmented Switch */}
                <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === '3d'
                        ? 'bg-solar-navy text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className={`w-3.5 h-3.5 ${viewMode === '3d' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>3D Digital Twin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === '2d'
                        ? 'bg-solar-navy text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${viewMode === '2d' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>2D Grid Map</span>
                  </button>
                </div>

                <button
                  onClick={handleTriggerCleaning}
                  disabled={cleanAllInProgress}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{cleanAllInProgress ? 'Cleaning...' : 'Clean All Critical'}</span>
                </button>
              </div>
            </div>

            {/* VIEWPORT CONTAINER (3D WebGL or 2D Matrix) */}
            {viewMode === '3d' ? (
              <SolarFarm3DView
                blocks={blocks}
                selectedBlock={selectedBlock}
                onSelectBlock={setSelectedBlock}
                dustStormActive={dustStormActive}
                morningDewActive={morningDewActive}
                cleanAllInProgress={cleanAllInProgress}
                windSpeed={windSpeed}
              />
            ) : (
              <div className="relative">
                {/* Dew droplets animation layer when morning dew is active */}
                {morningDewActive && (
                  <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex flex-wrap gap-6 justify-around p-4">
                    {[...Array(18)].map((_, i) => (
                      <div
                        key={i}
                        className="dew-drop-anim text-blue-400 opacity-80"
                        style={{ animationDelay: `${(i * 0.15)}s` }}
                      >
                        <Droplets className="w-5 h-5 fill-blue-300" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-6 gap-2 sm:gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                  {blocks.map((block) => {
                    const isClean = block.soiling < 10;
                    const isModerate = block.soiling >= 10 && block.soiling <= 25;
                    const isCritical = block.soiling > 25;
                    
                    // Color coding
                    let tileBg = 'bg-emerald-600/90 hover:bg-emerald-500 border-emerald-400/40 text-emerald-100';
                    if (isCritical) {
                      tileBg = 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/60 text-rose-100';
                    } else if (isModerate) {
                      tileBg = 'bg-amber-500/90 hover:bg-amber-400 border-amber-300/50 text-amber-950';
                    }

                    if (block.isCleaning) {
                      tileBg = 'bg-blue-600 border-blue-300 text-white animate-cleaning-pulse';
                    }

                    return (
                      <button
                        key={block.id}
                        onClick={() => setSelectedBlock(block)}
                        onMouseEnter={(e) => {
                          setHoveredBlock(block);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredBlock(null)}
                        className={`relative aspect-4/3 rounded-lg border-2 p-1.5 sm:p-2 flex flex-col justify-between items-center transition-all cursor-pointer group shadow-sm ${tileBg}`}
                      >
                        {/* Photovoltaic Busbar Lines Texture */}
                        <div className="absolute inset-0 opacity-20 solar-cell-pattern rounded-md pointer-events-none"></div>

                        {/* Header in tile: Block ID & Cleaning status */}
                        <div className="w-full flex items-center justify-between text-[11px] font-bold font-mono z-10">
                          <span>{block.id}</span>
                          {block.isCleaning ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-white" />
                          ) : isCritical ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          ) : null}
                        </div>

                        {/* Center: Soiling percentage */}
                        <div className="text-center z-10">
                          <span className="text-xs sm:text-sm font-extrabold font-mono tracking-tight block">
                            {block.isCleaning ? 'CLEAN' : `${block.soiling}%`}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider opacity-85 block leading-none">
                            {block.isCleaning ? 'ROBOT' : 'SOIL'}
                          </span>
                        </div>

                        {/* Bottom: Power output */}
                        <div className="text-[10px] font-mono opacity-85 z-10 leading-none">
                          {(block.ratedOutputKw * (1 - block.soiling / 100) * 0.8).toFixed(0)} kW
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* FLOATING HOVER TOOLTIP */}
                {hoveredBlock && (
                  <div
                    className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 w-64 p-3 bg-slate-900/95 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 10}px` }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                      <span className="font-bold text-amber-400 font-mono text-sm">Block {hoveredBlock.id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        hoveredBlock.isCleaning
                          ? 'bg-blue-600 text-white'
                          : hoveredBlock.soiling > 25
                          ? 'bg-rose-500/30 text-rose-300'
                          : hoveredBlock.soiling >= 10
                          ? 'bg-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/30 text-emerald-300'
                      }`}>
                        {hoveredBlock.isCleaning ? 'Cleaning In Progress' : hoveredBlock.soiling > 25 ? 'Critical' : hoveredBlock.soiling >= 10 ? 'Moderate' : 'Clean'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                      <div>
                        <p className="text-slate-400 text-[10px]">Soiling Level</p>
                        <p className="font-bold text-white text-xs">{hoveredBlock.soiling}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Current Output</p>
                        <p className="font-bold text-white text-xs">
                          {(hoveredBlock.ratedOutputKw * (1 - hoveredBlock.soiling / 100) * 0.8).toFixed(1)} kW
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Last Cleaned</p>
                        <p className="font-medium text-slate-200 text-[11px] truncate">{hoveredBlock.lastCleaned}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Next Recommend</p>
                        <p className={`font-semibold text-[11px] ${
                          hoveredBlock.soiling > 25 ? 'text-rose-400 font-bold' : 'text-emerald-400'
                        }`}>
                          {hoveredBlock.soiling > 25 ? 'Immediate (LCR > 3)' : 'Nominal Schedule'}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex items-center justify-between">
                      <span>Dust Type: {hoveredBlock.dustType}</span>
                      <span className="text-amber-300">Click to Inspect</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LEGEND BELOW GRID */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-400"></span>
                  Clean (&lt;10%)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-300"></span>
                  Moderate (10–25%)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-400"></span>
                  Critical (&gt;25%)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-400 animate-pulse"></span>
                  Cleaning in Progress
                </span>
              </div>
              <span className="text-[11px] text-slate-400 italic">
                {criticalBlocks.length} critical / {moderateBlocks.length} moderate
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN (40% width -> 5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Power Output Chart (24h) */}
            <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    24-Hour Power Generation Profile
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Red shaded area highlights cumulative energy loss due to soiling.
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  10 MW Capacity
                </span>
              </div>

              {/* Chart Canvas */}
              <div className="h-56 w-full relative">
                <canvas ref={chartCanvasRef} className="w-full h-full block" />
              </div>
            </div>

            {/* Weather Panel */}
            <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-rose-500" />
                  Bikaner Desert Weather & Dust Index
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Live Sensor Feed
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {/* Temp */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Temperature</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono text-slate-900">
                    {dustStormActive ? 41 : 38}°C
                  </p>
                  <p className="text-[10px] text-slate-400">Irradiance: 845 W/m²</p>
                </div>

                {/* Wind */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Wind className="w-3.5 h-3.5 text-blue-500" />
                    <span>Wind Speed</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono text-slate-900">
                    {windSpeed} km/h
                  </p>
                  <p className="text-[10px] text-slate-400">Direction: WNW (Desert)</p>
                </div>

                {/* Humidity */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Humidity</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono text-slate-900">
                    {morningDewActive ? 48 : 24}%
                  </p>
                  <p className="text-[10px] text-slate-400">Dew Point: 11.2°C</p>
                </div>

                {/* Dust Index */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dust Index</span>
                  </div>
                  <p className={`text-base font-extrabold font-mono ${
                    dustStormActive ? 'text-rose-600' : windSpeed > 30 ? 'text-rose-500' : 'text-amber-600'
                  }`}>
                    {dustStormActive ? 'Critical (PM10 420)' : windSpeed > 25 ? 'High (PM10 210)' : 'Moderate (115)'}
                  </p>
                  <p className="text-[10px] text-slate-400">Optical Sensor Active</p>
                </div>

                {/* Next Rain */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 col-span-1 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Precipitation Forecast</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    No rain forecast (7 days)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Clean trigger priority: <span className="font-semibold text-emerald-600">High (Dry period ahead)</span>
                  </p>
                </div>
              </div>
            </div>

          </div>

        </section>

        {/* 4. AI DECISION ENGINE PANEL */}
        <section className="bg-solar-navy text-white rounded-2xl p-6 sm:p-7 shadow-xl border border-blue-900/80 relative overflow-hidden">
          {/* Subtle background solar grid pattern */}
          <div className="absolute inset-0 opacity-5 solar-cell-pattern pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            {/* Header & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Bot className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    AI RECOMMENDATION ENGINE
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      AUTONOMOUS MODEL v3.2
                    </span>
                  </h3>
                  <p className="text-xs text-blue-200">
                    Multi-variate optimization: Soiling rate vs Cleaning cost vs Energy tariff vs Weather forecast
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs text-slate-300 font-mono">Real-time Optimization</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
            </div>

            {/* Core Recommendation & Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Left Side: Current Analysis & LCR (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-blue-950/70 p-4 rounded-xl border border-blue-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Current Plant Analysis
                  </div>
                  <p className="text-sm font-medium text-slate-100 leading-relaxed">
                    {aiAnalysisText}
                  </p>
                  <p className="text-xs text-blue-300/80">
                    <span className="font-semibold text-blue-200">Alternative Strategy:</span> Wait on Blocks C1–C6 — Natural nocturnal dew condensation expected to clear ~8% dust by 05:00 AM.
                  </p>
                </div>

                {/* Metrics pair: LCR & ROI */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-950/40 p-3.5 rounded-xl border border-blue-800/40">
                    <span className="text-xs text-slate-400 block mb-1">Loss-to-Cost Ratio (LCR)</span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                      {lcrRatio}
                    </span>
                    <span className="text-[11px] text-slate-300 block mt-0.5">Threshold &gt; 3.0 triggers deploy</span>
                  </div>

                  <div className="bg-blue-950/40 p-3.5 rounded-xl border border-blue-800/40">
                    <span className="text-xs text-slate-400 block mb-1">Estimated Net ROI</span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono tracking-tight">
                      {estimatedRoi}
                    </span>
                    <span className="text-[11px] text-slate-300 block mt-0.5">Net gain if cleaned now</span>
                  </div>
                </div>
              </div>

              {/* Right Side: CTA Button & ROI Gate (5 cols) */}
              <div className="md:col-span-5 flex flex-col justify-center items-center p-4 bg-blue-950/60 rounded-xl border border-blue-800/60 text-center space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Recommended Action
                </span>
                
                <button
                  onClick={handleTriggerCleaning}
                  disabled={cleanAllInProgress}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>{cleanAllInProgress ? 'CLEANING DISPATCHED...' : 'TRIGGER AUTONOMOUS CLEANING'}</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>

                <p className="text-[11px] text-slate-400">
                  Deploys dry-brush crawling robots. Zero water consumed with dew-harvest optimization.
                </p>
              </div>

            </div>

            {/* FLOWCHART VISUALIZATION: Dust Detected -> ROI Calculation -> Yes/No Gate -> Action */}
            <div className="border-t border-blue-800/80 pt-5">
              <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Autonomous Decision Pipeline
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div className="bg-blue-950/80 p-3 rounded-lg border border-blue-800/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Dust Detected</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Optical sensors + Satellite PM aerosol</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-blue-950/80 p-3 rounded-lg border border-blue-800/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">ROI Calculation</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Power Loss (₹) vs Cleaning OpEx (₹)</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-blue-950/80 p-3 rounded-lg border border-blue-800/60 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Yes / No Gate</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">LCR &gt; 3.0 &amp; No Rain within 48h</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-blue-950/80 p-3 rounded-lg border border-emerald-500/50 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-300">Action Dispatched</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Deploy robot fleet or hold for dew</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 5. CLEANING ACTIVITY LOG */}
        <section className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-solar-orange" />
                Cleaning Activity &amp; Audit Log
              </h3>
              <p className="text-xs text-slate-500">
                Automated telemetry record of cleaning triggers, water expenditure, and efficiency recovery.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Showing recent {logs.length} events
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                  <th className="py-2.5 px-3 font-semibold">Block</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Trigger</th>
                  <th className="py-2.5 px-3 font-semibold">Water Used</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors font-mono">
                    <td className="py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                      {log.time}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {log.block}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 font-sans font-medium px-2 py-0.5 rounded text-[11px] ${
                        log.status === 'clean'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : log.status === 'dew'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : log.status === 'emergency'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-sans">
                      {log.trigger}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-semibold">
                      {log.waterUsed}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      log.recovery.startsWith('+') ? 'text-emerald-600' : 'text-slate-600'
                    }`}>
                      {log.recovery}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. BOTTOM CONTROL BAR (Interactive simulation controls) */}
        <section className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                INTERACTIVE SIMULATION CONTROL PANEL
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Adjust sliders and triggers to test AI decision behavior live
            </span>
          </div>

          {/* Sliders & Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Slider 1: Soiling Rate */}
            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">Soiling Rate</label>
                <span className="font-mono font-bold text-amber-400">{soilingRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="0.5"
                value={soilingRate}
                onChange={(e) => handleSoilingSliderChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Clean)</span>
                <span>20% (Moderate)</span>
                <span>40% (Severe)</span>
              </div>
            </div>

            {/* Slider 2: Wind Speed */}
            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">Wind Speed</label>
                <span className="font-mono font-bold text-blue-400">{windSpeed} km/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={windSpeed}
                onChange={(e) => setWindSpeed(parseInt(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 (Calm)</span>
                <span>25 (Breeze)</span>
                <span>50 (High Dust)</span>
              </div>
            </div>

            {/* Toggle 1: Dew Harvesting */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Dew Harvesting</p>
                <p className="text-[10px] text-slate-400">Zero-water moisture capture</p>
              </div>
              <button
                type="button"
                onClick={() => setDewHarvesting(!dewHarvesting)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  dewHarvesting ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    dewHarvesting ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Satellite Dust Alerts */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Satellite Dust Alerts</p>
                <p className="text-[10px] text-slate-400">INSAT-3D &amp; Sentinel AOD</p>
              </div>
              <button
                type="button"
                onClick={() => setSatelliteAlerts(!satelliteAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  satelliteAlerts ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    satelliteAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>

          {/* Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Simulate Dust Storm */}
            <button
              onClick={handleSimulateDustStorm}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-md shadow-rose-950/30"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>Simulate Dust Storm</span>
            </button>

            {/* Simulate Morning Dew */}
            <button
              onClick={handleSimulateMorningDew}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-md shadow-blue-950/30"
            >
              <Droplets className="w-4 h-4 text-cyan-200" />
              <span>Simulate Morning Dew</span>
            </button>

            {/* Reset Simulation */}
            <button
              onClick={handleResetSimulation}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-slate-300" />
              <span>Reset Simulation</span>
            </button>

            <span className="text-xs text-slate-400 ml-auto hidden sm:inline">
              SoleSight AI Autonomous Plant Agent Active
            </span>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-solar-navy text-slate-400 text-xs py-4 px-6 border-t border-blue-950 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            SoleSight AI © 2024 · Smart India Hackathon Prototype · Autonomous Solar Cleaning &amp; Soiling Intelligence.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Location: Bikaner, RJ</span>
            <span>·</span>
            <span>Capacity: 10 MW (24 Sectors)</span>
            <span>·</span>
            <span className="text-amber-400 font-medium">SIH 2024</span>
          </div>
        </div>
      </footer>

      {/* INSPECT BLOCK MODAL DIALOG */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-mono font-bold text-sm">
                  {selectedBlock.id}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Block Diagnostics: {selectedBlock.id}</h4>
                  <p className="text-xs text-slate-500">Sub-array Array Section (Row {selectedBlock.row})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                <span className="text-slate-500 block">Current Soiling</span>
                <span className={`text-xl font-bold ${
                  selectedBlock.soiling > 25 ? 'text-rose-600' : selectedBlock.soiling >= 10 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {selectedBlock.soiling}%
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                <span className="text-slate-500 block">Rated Power</span>
                <span className="text-xl font-bold text-slate-900">
                  {selectedBlock.ratedOutputKw.toFixed(0)} kW
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                <span className="text-slate-500 block">Estimated Loss</span>
                <span className="text-base font-bold text-rose-600">
                  ₹{Math.round(selectedBlock.soiling * 125)} / day
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                <span className="text-slate-500 block">Predominant Dust</span>
                <span className="text-xs font-semibold text-slate-800 font-sans mt-1 block">
                  {selectedBlock.dustType}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200/60 text-xs text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-blue-600" />
                SoleSight AI Recommendation:
              </p>
              <p className="text-blue-800">
                {selectedBlock.soiling > 25
                  ? 'Urgent cleaning advised. Estimated efficiency recovery is +14.2% within 20 minutes.'
                  : 'Block efficiency is within optimal operational range. Scheduled dew cleaning sufficient.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleCleanSingleBlock(selectedBlock.id)}
                disabled={selectedBlock.isCleaning}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Bot className="w-4 h-4" />
                <span>{selectedBlock.isCleaning ? 'Cleaning Active...' : 'Deploy Robot to Block'}</span>
              </button>
              <button
                onClick={() => setSelectedBlock(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT STANDALONE HTML MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-500" />
                <h4 className="text-base font-bold text-slate-900">
                  Export Standalone Single-File HTML
                </h4>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              As requested for the Smart India Hackathon submission, you can copy or download the complete standalone HTML dashboard. It contains all Tailwind CSS, Font Awesome icons, Chart.js visualizations, and scripts in a single file ready for immediate offline browser demonstration.
            </p>

            <div className="bg-slate-900 rounded-xl p-3 text-slate-200 font-mono text-xs max-h-60 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{standaloneHtml || getSingleFileHtmlCode()}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy HTML Code'}</span>
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .html File</span>
                </button>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
