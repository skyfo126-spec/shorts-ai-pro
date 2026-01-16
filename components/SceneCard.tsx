import React, { useState } from 'react';
import { Scene } from '../types';
import { decodeBase64, decodeAudioData, playAudioBuffer } from '../utils/audioUtils';

interface SceneCardProps {
  scene: Scene;
  onUpdate: (id: number, updates: Partial<Scene>) => void;
  onGenerateImage: (id: number) => void;
  onGenerateVoice: (id: number) => void;
  onGenerateVideo: (id: number) => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, onUpdate, onGenerateImage, onGenerateVoice, onGenerateVideo }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handlePlayVoice = async () => {
    if (!scene.audioBlob) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bytes = decodeBase64(scene.audioBlob);
    const buffer = await decodeAudioData(bytes, ctx);
    playAudioBuffer(buffer, ctx);
  };

  return (
    <div className="group bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-pink-400 transition-all duration-300 shadow-sm flex flex-col h-full hover:shadow-md">
      <div className="relative aspect-video md:aspect-[9/16] bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
        {scene.videoUrl ? (
          <video src={scene.videoUrl} className="w-full h-full object-cover" controls autoPlay loop muted />
        ) : scene.imageUrl ? (
          <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
        ) : (
          <div className="p-4 text-center space-y-2">
            <div className="text-2xl opacity-50">🖼️</div>
            <button
              onClick={() => onGenerateImage(scene.id)}
              disabled={scene.isGeneratingImage}
              className="px-4 py-2 bg-pink-600 text-white rounded-full text-[10px] font-bold disabled:opacity-50 hover:bg-pink-700 transition-colors"
            >
              {scene.isGeneratingImage ? '이미지 생성 중...' : '이미지 생성'}
            </button>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="bg-white/90 backdrop-blur text-pink-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-pink-100 shadow-sm">
            #{scene.id}
          </span>
        </div>
        {scene.imageUrl && !scene.videoUrl && (
          <button 
            onClick={() => onGenerateVideo(scene.id)}
            disabled={scene.isGeneratingVideo}
            className="absolute bottom-2 right-2 p-2 bg-pink-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
          >
            {scene.isGeneratingVideo ? '🎥...' : '🎥'}
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        {isEditing ? (
          <div className="space-y-3 flex-1">
            <input 
              value={scene.title} 
              onChange={e => onUpdate(scene.id, { title: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="장면 제목"
            />
            <textarea 
              value={scene.narration} 
              onChange={e => onUpdate(scene.id, { narration: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] text-slate-700 h-24 resize-none focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="대본 (자막)"
            />
            <textarea 
              value={scene.visualPrompt} 
              onChange={e => onUpdate(scene.id, { visualPrompt: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] text-pink-600 h-20 resize-none font-mono focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="이미지 프롬프트"
            />
            <button 
              onClick={() => setIsEditing(false)}
              className="w-full bg-slate-900 text-white text-[10px] py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors"
            >
              저장 완료
            </button>
          </div>
        ) : (
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
              <h4 className="text-xs font-bold text-slate-900 truncate w-3/4">{scene.title}</h4>
              <button onClick={() => setIsEditing(true)} className="text-[10px] text-pink-600 hover:underline">수정</button>
            </div>
            <p className="text-slate-600 text-[10px] leading-relaxed line-clamp-3 italic">"{scene.narration}"</p>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <p className="text-pink-500 text-[9px] font-mono line-clamp-2">{scene.visualPrompt}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handlePlayVoice}
            disabled={!scene.audioBlob || scene.isGeneratingVoice}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all ${
              scene.audioBlob ? 'bg-pink-600 text-white hover:bg-pink-700 shadow-md' : 'bg-slate-100 text-slate-400'
            }`}
          >
            🔊 재생
          </button>
          <button
            onClick={() => onGenerateVoice(scene.id)}
            disabled={scene.isGeneratingVoice}
            className="px-3 bg-pink-50 text-pink-600 border border-pink-100 rounded-xl hover:bg-pink-100 transition-all disabled:opacity-50"
          >
            {scene.isGeneratingVoice ? '...' : '🎙️'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;