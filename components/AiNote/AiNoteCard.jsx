import React, { useState } from 'react';
import { Mic, ArrowRight } from 'lucide-react';
import AiNoteModal from './AiNoteModal';

/**
 * AiNoteCard Dashboard Entrypoint
 * Completely isolated card that controls its own modal trigger.
 * Receives the onNavigate handler to push route changes (like settings) up to App.tsx.
 */
export default function AiNoteCard({ onNavigate }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="group aspect-square rounded-[35px] bg-[#E0E5EC] p-5 flex flex-col justify-between text-left transition-all duration-300 hover:scale-[1.02] active:scale-95 animate-fade-in-up"
        style={{
          boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
          animationDelay: '400ms' // Arranged as card 5, setting it after the 4th card delay
        }}
      >
        {/* Icon Container - Raised Neumorphic */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-700 mb-2 transition-transform group-hover:-translate-y-1"
          style={{
            background: "#E0E5EC",
            boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
          }}
        >
          <Mic size={22} strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">AiNote</h2>
          <p className="text-[10px] text-gray-500 font-medium mt-1 leading-snug">Voice & Web Memo</p>
        </div>

        <div className="flex items-center gap-1 text-[#6B7280] group-hover:text-blue-500 transition-colors text-xs font-semibold mt-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 duration-300">
          Launch <ArrowRight size={14} />
        </div>
      </button>

      <AiNoteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onNavigate={onNavigate} 
      />
    </>
  );
}
