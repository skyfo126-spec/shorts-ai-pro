import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { Production, GenerationStep, Scene, Language, AspectRatio } from './types';
import { LANGUAGES, GENRES, TONES, STYLES, SEASONINGS, DEFAULT_PRODUCTION } from './constants';
import { GeminiService } from './services/geminiService';
import AccessGate from './components/AccessGate';
import LoadingOverlay from './components/LoadingOverlay';
import SceneCard from './components/SceneCard';
import { decodeBase64, encodeWAV, generateSRTContent } from './utils/audioUtils';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [production, setProduction] = useState<Production>(DEFAULT_PRODUCTION);
  const [step, setStep] = useState<GenerationStep>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [includeVideoInZip, setIncludeVideoInZip] = useState(true);

  const gemini = useMemo(() => new GeminiService(), []);

  const updateProduction = (updates: Partial<Production>) => {
    setProduction(prev => ({ ...prev, ...updates }));
  };

  const toggleSeasoning = (id: string) => {
    const current = production.seasoning;
    if (current.includes(id)) {
      updateProduction({ seasoning: current.filter(s => s !== id) });
    } else {
      updateProduction({ seasoning: [...current, id] });
    }
  };

  const currentStyle = useMemo(() => {
    return production.style === "직접 입력" ? customStyle : production.style;
  }, [production.style, customStyle]);

  const handleGenerateFullSynopsis = async () => {
    if (!production.topic) return;
    setIsProcessing(true);
    setProcessingLabel('시놉시스 설계 중...');
    try {
      const { text, tokens } = await gemini.generateSynopsis(production);
      updateProduction({ synopsis: text, totalTokens: production.totalTokens + tokens, groundingSources: [] });
      setStep('synopsis');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFactCheck = async () => {
    if (!production.synopsis) return;
    setIsProcessing(true);
    setProcessingLabel('Google 검색 기반 팩트 체크 중...');
    try {
      const { text, sources } = await gemini.factCheckSynopsis(production.synopsis);
      updateProduction({ synopsis: text, groundingSources: sources });
    } catch (e) {
      console.error(e);
      alert("팩트 체크 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    setIsProcessing(true);
    setProcessingLabel('스토리보드 구성 중...');
    try {
      const { scenes: rawScenes, tokens } = await gemini.generateScript(
        production.synopsis, production.sceneCount, production.tone, production.language, currentStyle
      );
      const scenes: Scene[] = rawScenes.map((s, i) => ({
        ...s, id: i + 1, isGeneratingImage: false, isGeneratingVoice: false, isGeneratingVideo: false
      } as Scene));
      updateProduction({ scenes, totalTokens: production.totalTokens + tokens });
      
      const viral = await gemini.generateViralAssets(production.synopsis, production.language);
      updateProduction({ viralAssets: viral });
      
      setStep('complete');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExpandScript = async () => {
    const isSecondPhase = (production.scenes[0]?.narration.length || 0) > 500;
    const target = isSecondPhase ? 45000 : 23000;
    setIsProcessing(true);
    setProcessingLabel(`대본 확장 중 (${target.toLocaleString()}자 목표)...`);
    try {
      const { scenes, tokens } = await gemini.expandScript(production.scenes, target, production.language, production.tone);
      updateProduction({ scenes, totalTokens: production.totalTokens + tokens });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateImage = async (id: number) => {
    const scene = production.scenes.find(s => s.id === id);
    if (!scene) return;
    setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingImage: true } : s) }));
    try {
      const url = await gemini.generateImage(scene.visualPrompt, production.aspectRatio);
      if (url) setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, imageUrl: url, isGeneratingImage: false } : s) }));
      else setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingImage: false } : s) }));
    } catch {
      setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingImage: false } : s) }));
    }
  };

  const handleGenerateAllImages = async () => {
    const scenesToProcess = production.scenes.filter(s => !s.imageUrl);
    if (scenesToProcess.length === 0) {
      alert("이미 생성할 이미지가 없거나 모두 완료되었습니다.");
      return;
    }

    setIsProcessing(true);
    for (let i = 0; i < scenesToProcess.length; i++) {
      const scene = scenesToProcess[i];
      setProcessingLabel(`이미지 일괄 생성 중... (${i + 1}/${scenesToProcess.length})`);
      await handleGenerateImage(scene.id);
    }
    setIsProcessing(false);
    alert("모든 이미지 생성이 완료되었습니다.");
  };

  const handleGenerateVoice = async (id: number) => {
    const scene = production.scenes.find(s => s.id === id);
    if (!scene) return;
    setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingVoice: true } : s) }));
    try {
      const blob = await gemini.generateVoice(scene.narration);
      if (blob) setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, audioBlob: blob, isGeneratingVoice: false } : s) }));
      else setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingVoice: false } : s) }));
    } catch {
      setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingVoice: false } : s) }));
    }
  };

  const handleGenerateAllVoices = async () => {
    const scenesToProcess = production.scenes.filter(s => !s.audioBlob);
    if (scenesToProcess.length === 0) {
      alert("이미 생성할 음성이 없거나 모두 완료되었습니다.");
      return;
    }
    setIsProcessing(true);
    for (let i = 0; i < scenesToProcess.length; i++) {
      const scene = scenesToProcess[i];
      setProcessingLabel(`음성 일괄 생성 중... (${i + 1}/${scenesToProcess.length})`);
      await handleGenerateVoice(scene.id);
    }
    setIsProcessing(false);
    alert("모든 음성 생성이 완료되었습니다.");
  };

  const handleGenerateVideo = async (id: number) => {
    const scene = production.scenes.find(s => s.id === id);
    if (!scene) return;

    if (typeof (window as any).aistudio !== 'undefined') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingVideo: true } : s) }));
    try {
      const url = await gemini.generateVideo(scene.visualPrompt, production.aspectRatio, scene.imageUrl);
      setProduction(p => ({ 
        ...p, 
        scenes: p.scenes.map(s => s.id === id ? { ...s, videoUrl: url || undefined, isGeneratingVideo: false } : s) 
      }));
    } catch (e: any) {
      console.error(`영상 생성 실패 (Scene ${id}):`, e);
      if (e.message?.includes("Requested entity was not found") || e.message?.includes("404")) {
        alert("Veo 모델 접근 권한이 없거나 무료 API 키를 사용 중입니다. 유료 프로젝트의 API 키를 다시 선택해주세요.");
        if (typeof (window as any).aistudio !== 'undefined') {
          await (window as any).aistudio.openSelectKey();
        }
      } else {
        alert(`영상 제작 중 오류가 발생했습니다: ${e.message || "서버 응답 없음"}`);
      }
      setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, isGeneratingVideo: false } : s) }));
    }
  };

  const handleGenerateAllVideos = async () => {
    const scenesToProcess = production.scenes.filter(s => !s.videoUrl);
    if (scenesToProcess.length === 0) {
      alert("이미 제작할 영상이 없거나 모두 완료되었습니다.");
      return;
    }

    if (typeof (window as any).aistudio !== 'undefined') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    setIsProcessing(true);
    for (let i = 0; i < scenesToProcess.length; i++) {
      const scene = scenesToProcess[i];
      setProcessingLabel(`Veo 3.1 영상 일괄 제작 중... (${i + 1}/${scenesToProcess.length})`);
      await handleGenerateVideo(scene.id);
    }
    setIsProcessing(false);
    alert("모든 영상 제작이 완료되었습니다.");
  };

  const handleUpdateScene = (id: number, updates: Partial<Scene>) => {
    setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, ...updates } : s) }));
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessingLabel('결과물 압축 중...');
    try {
      const zip = new JSZip();
      const folder = zip.folder("production_assets");
      
      folder?.file("full_script.txt", production.scenes.map(s => `[Scene ${s.id}] (${s.title})\n${s.narration}`).join('\n\n'));
      folder?.file("synopsis.txt", production.synopsis);

      if (production.viralAssets) {
          folder?.file("marketing_assets.json", JSON.stringify(production.viralAssets, null, 2));
      }

      for (const scene of production.scenes) {
        const sceneFolder = folder?.folder(`scene_${scene.id}`);
        
        if (scene.imageUrl) {
          const imgData = scene.imageUrl.split(',')[1];
          sceneFolder?.file(`visual_${scene.id}.png`, imgData, { base64: true });
        }

        let duration = scene.narration.length / 15;
        if (scene.audioBlob) {
          const audioBytes = decodeBase64(scene.audioBlob);
          const wavBlob = encodeWAV(new Int16Array(audioBytes.buffer));
          sceneFolder?.file(`narration_${scene.id}.wav`, wavBlob);
          duration = (audioBytes.length / 2) / 24000;
        }

        if (includeVideoInZip && scene.videoUrl) {
            try {
                const videoRes = await fetch(scene.videoUrl);
                const videoBlob = await videoRes.blob();
                sceneFolder?.file(`clip_${scene.id}.mp4`, videoBlob);
            } catch (e) {
                console.error("Video Zip Add Failed", e);
            }
        }

        const srtContent = generateSRTContent(scene.narration, duration);
        sceneFolder?.file(`subtitle_${scene.id}.srt`, srtContent);
        sceneFolder?.file(`narration_${scene.id}.txt`, scene.narration);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shorts_pro_${Date.now()}.zip`;
      link.click();
    } catch (error) {
      console.error("Zip generation failed", error);
      alert("파일 압축 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isUnlocked) {
    return <AccessGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-pink-100">
      <LoadingOverlay isVisible={isProcessing} stepName={processingLabel} />
      
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-pink-600/10">🎬</div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-slate-900">SHORTS AI <span className="text-pink-600 italic">PRO</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Advanced Cinematic Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Token Usage</p>
              <p className="text-xs font-mono text-pink-600">{production.totalTokens.toLocaleString()} pts</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              NEW PROJECT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10 space-y-12 pb-32">
        <section className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-pink-600 text-white text-[10px] font-bold rounded-full">1</span>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Project Identity</h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Main Topic / Concept</label>
                  <textarea 
                    value={production.topic}
                    onChange={e => updateProduction({ topic: e.target.value })}
                    placeholder="주제를 입력하세요 (예: 50대 남자의 은퇴 후 반전 성공 스토리)"
                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all h-24 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Genre</label>
                    <select 
                      value={production.genre}
                      onChange={e => updateProduction({ genre: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-pink-500 text-slate-700"
                    >
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Language</label>
                    <select 
                      value={production.language}
                      onChange={e => updateProduction({ language: e.target.value as Language })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-pink-500 text-slate-700"
                    >
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seasoning (Details)</label>
                   <div className="flex flex-wrap gap-2">
                     {SEASONINGS.map(s => (
                       <button
                         key={s.id}
                         onClick={() => toggleSeasoning(s.label)}
                         className={`px-4 py-2 rounded-full text-[10px] font-bold border transition-all ${
                           production.seasoning.includes(s.label) 
                           ? 'bg-pink-600 border-pink-600 text-white' 
                           : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                         }`}
                       >
                         {s.label}
                       </button>
                     ))}
                   </div>
                </div>
              </div>

              <button 
                onClick={handleGenerateFullSynopsis}
                disabled={!production.topic || isProcessing}
                className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl shadow-pink-600/10 transition-all flex items-center justify-center gap-2"
              >
                <span>시놉시스 설계하기</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-slate-100 text-pink-600 text-[10px] font-bold rounded-full">2</span>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Cinematic Synopsis</h2>
              </div>
              {production.synopsis && (
                <button 
                  onClick={handleFactCheck}
                  className="px-3 py-1 bg-pink-50 text-pink-600 border border-pink-200 rounded-full text-[10px] font-bold hover:bg-pink-100 transition-all"
                >
                  🔍 Google 팩트 체크
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-50 p-6 rounded-[2rem] border border-slate-200 min-h-[300px] relative overflow-hidden">
              {!production.synopsis ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 italic text-sm">
                  Waiting for input...
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-700">
                  <div className="prose prose-slate prose-sm max-w-none">
                    {production.synopsis.split('\n').map((line, i) => (
                      <p key={i} className="text-slate-700 leading-relaxed">{line}</p>
                    ))}
                  </div>
                  
                  {production.groundingSources && production.groundingSources.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Grounding Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {production.groundingSources.map((source, i) => (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-white border border-slate-200 px-3 py-1 rounded-lg text-pink-600 hover:border-pink-300 transition-all"
                          >
                            {source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {step !== 'idle' && (
          <section className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
              <div className="flex flex-col gap-6 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-pink-600 text-white text-[10px] font-bold rounded-full">3</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Storyboard Configuration</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Scene Count</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={12}
                      value={production.sceneCount}
                      onChange={e => updateProduction({ sceneCount: parseInt(e.target.value) || 6 })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Narration Tone</label>
                    <select 
                      value={production.tone}
                      onChange={e => updateProduction({ tone: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-pink-500 text-slate-700"
                    >
                      {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Aspect Ratio</label>
                    <select 
                      value={production.aspectRatio}
                      onChange={e => updateProduction({ aspectRatio: e.target.value as AspectRatio })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-pink-500 text-slate-700"
                    >
                      {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Visual Style</label>
                    <select 
                      value={production.style}
                      onChange={e => updateProduction({ style: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-pink-500 text-slate-700"
                    >
                      {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="직접 입력">직접 입력 (Custom)</option>
                    </select>
                  </div>
                </div>

                {production.style === "직접 입력" && (
                  <div className="animate-in fade-in duration-300">
                    <input 
                      value={customStyle}
                      onChange={e => setCustomStyle(e.target.value)}
                      placeholder="커스텀 스타일을 영어로 입력하세요 (예: Cyberpunk Neon Noir)"
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs text-pink-600 font-mono outline-none"
                    />
                  </div>
                )}
              </div>

              <button 
                onClick={handleGenerateStoryboard}
                disabled={isProcessing}
                className="w-full md:w-auto h-full px-12 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold py-6 rounded-2xl shadow-xl shadow-pink-600/10 transition-all flex items-center justify-center gap-2"
              >
                <span>스토리보드 생성</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.96 5.96m0 0L2.25 21l1.5-5.25L9.63 8.41m0 0L21 3" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {step === 'complete' && production.scenes.length > 0 && (
          <section className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-pink-600 text-white text-[10px] font-bold rounded-full">4</span>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Production Workbench</h2>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button 
                  onClick={handleExpandScript}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 transition-all"
                >
                  ✨ 대본 고도화
                </button>
                <button 
                  onClick={handleGenerateAllImages}
                  className="px-4 py-2 bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 rounded-xl text-[10px] font-bold transition-all"
                >
                  🖼️ 이미지 일괄 생성
                </button>
                <button 
                  onClick={handleGenerateAllVoices}
                  className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-[10px] font-bold transition-all"
                >
                  🎙️ 음성 일괄 생성
                </button>
                <button 
                  onClick={handleGenerateAllVideos}
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-black border border-slate-800 rounded-xl text-[10px] font-bold transition-all shadow-lg"
                >
                  🎬 영상 일괄 생성 (Veo 3.1)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {production.scenes.map(scene => (
                <SceneCard 
                  key={scene.id}
                  scene={scene}
                  onUpdate={handleUpdateScene}
                  onGenerateImage={handleGenerateImage}
                  onGenerateVoice={handleGenerateVoice}
                  onGenerateVideo={handleGenerateVideo}
                />
              ))}
            </div>

            {production.viralAssets && (
              <div className="mt-16 p-8 bg-slate-50 border border-slate-200 rounded-[3rem] space-y-8">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚀</span>
                  <h2 className="text-lg font-black tracking-tighter text-slate-900 uppercase">Viral Growth Assets</h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Killer Video Titles</h3>
                      <ul className="space-y-2">
                        {production.viralAssets.titles.map((t, i) => (
                          <li key={i} className="bg-white p-4 rounded-2xl border border-slate-200 text-sm font-bold text-pink-600">"{t}"</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Thumbnail Hooks</h3>
                      <ul className="space-y-2">
                        {production.viralAssets.thumbnailHooks.map((h, i) => (
                          <li key={i} className="bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-600">{h}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Smart Hashtags</h3>
                      <div className="space-y-4">
                        {Object.entries(production.viralAssets.hashtags).map(([platform, tags]) => (
                          <div key={platform} className="space-y-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{platform}</span>
                            <div className="flex flex-wrap gap-1">
                              {tags.map((tag, i) => (
                                <span key={i} className="bg-white px-2 py-1 rounded text-[10px] text-pink-600 border border-pink-100">{tag}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-6 py-12 border-t border-slate-100 mt-12">
              <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={includeVideoInZip} 
                        onChange={e => setIncludeVideoInZip(e.target.checked)}
                        className="w-4 h-4 bg-white border-slate-200 rounded focus:ring-pink-500"
                      />
                      <span className="text-xs font-bold text-slate-500">비디오 파일 포함</span>
                  </label>
              </div>
              <button 
                onClick={handleDownloadZip}
                className="group relative px-12 py-5 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black rounded-full shadow-2xl shadow-pink-600/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
              >
                <span className="text-lg">PROJECT EXPORT (.ZIP)</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 animate-bounce">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-slate-200 px-6 py-3 rounded-full shadow-xl z-40 sm:hidden">
        <p className="text-[9px] font-black tracking-widest text-pink-600">SYSTEM ACTIVE</p>
      </div>
    </div>
  );
};

export default App;
