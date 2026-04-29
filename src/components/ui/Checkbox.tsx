"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export default function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input 
          type="checkbox" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only" 
        />
        <div 
          className={`w-5 h-5 rounded-lg border-2 transition-all duration-300 flex items-center justify-center
            ${checked 
              ? 'bg-brand-orange border-brand-orange shadow-[0_0_15px_rgba(255,107,0,0.4)]' 
              : 'bg-surface border-edge group-hover:border-brand-orange/50 group-hover:bg-white/5'
            }`}
        >
          {checked && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Check size={14} className="text-white font-black stroke-[4]" />
            </motion.div>
          )}
        </div>
      </div>
      {label && (
        <span className={`text-sm sm:text-[15px] font-medium leading-6 transition-colors tracking-tight
          ${checked ? 'text-foreground' : 'text-muted group-hover:text-foreground/80'}`}
        >
          {label}
        </span>
      )}
    </label>
  );
}
