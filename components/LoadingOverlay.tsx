import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Synchronizing with neural engine...",
  "Veo is analyzing visual composition...",
  "Calibrating cinematic perspectives...",
  "Rendering high-fidelity narratives...",
  "Encoding multi-layered visual effects...",
  "Optimizing frame consistency...",
  "Applying temporal lighting adjustments...",
  "Finalizing production buffers..."
];

interface LoadingOverlayProps {
  isVisible: boolean;
  stepName?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, stepName }) => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % MESSAGES.length);
    }, 3500); // Slightly slower to allow reading reassuring messages
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 transition-opacity duration-500">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-3xl">🎬</div>
      </div>
      
      <div className="mt-12 text-center max-w-sm">
        <h3 className="text-2xl font-bold text-slate-900 mb-2 uppercase tracking-tighter whitespace-pre-wrap">
          {stepName || "Processing"}
        </h3>
        <p className="text-blue-600 font-medium h-6 animate-pulse transition-all italic text-sm">
          {MESSAGES[msgIdx]}
        </p>
      </div>

      <div className="mt-8 w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 animate-progress"></div>
      </div>

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;