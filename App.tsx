
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
      setProcessingLabel(`Veo 3.1 영상 일괄 제작 중... (${i + 1}/${scenesToProcess.length})\n※ 영상 하나당 약 1~3분 정도 소요됩니다.`);
      await handleGenerateVideo(scene.id);
    }
    setIsProcessing(false);
    alert("모든 영상 제작이 완료되었습니다.");
  };

  const handleUpdateScene = (id: number, updates: Partial<Scene>) => {
    setProduction(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, ...updates } : s) }));
  };

  const handleDownloadZip = async () => {
    setIs