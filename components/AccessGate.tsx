
import React, { useState } from 'react';

interface AccessGateProps {
  onUnlock: () => void;
}

const AccessGate: React.FC<AccessGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const getTodayPassword = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return mm + dd;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === getTodayPassword()) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-50 blur-[120px] rounded-full"></div>
      </div>

      <div className={`relative z-10 w-full max-w-md bg-white border ${error ? 'border-red-500 shadow-red-100' : 'border-slate-200'} p-10 rounded-[2.5rem] shadow-2xl transition-all duration-300`}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-pink-50 text-pink-600 rounded-3xl mb-6 border border-pink-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">SHORTS AI <span className="text-pink-600 italic">PRO</span></h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">ENTER ACCESS CODE (MMDD)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={4}
              placeholder="••••"
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-4xl text-pink-600 font-bold tracking-[1em] focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder:text-slate-200"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-5 rounded-2xl shadow-lg shadow-pink-600/10 active:scale-[0.98] transition-all"
          >
            INITIALIZE STUDIO
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccessGate;
