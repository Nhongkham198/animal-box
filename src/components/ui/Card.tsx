import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({ children, className, title, headerAction, noPadding }: CardProps) {
  return (
    <div className={cn("bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden", className)}>
      {(title || headerAction) && (
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          {title && <h3 className="font-bold text-slate-900">{title}</h3>}
          {headerAction}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-6")}>
        {children}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: string | number;
  isUp?: boolean;
  delay?: number;
  description?: string;
}

import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function StatCard({ label, value, icon: Icon, color, trend, isUp, delay = 0, description }: StatCardProps) {
  const trendValue = typeof trend === 'number' ? `${Math.abs(trend)}%` : trend;
  const trendIsUp = typeof trend === 'number' ? trend >= 0 : isUp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
    >
      <div className={cn("absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-500", color)}>
        <Icon className="w-16 h-16" />
      </div>
      
      <div className="relative space-y-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 duration-300", 
          color.startsWith('bg-') ? color : "bg-slate-100"
        )}>
          <Icon className={cn("w-6 h-6", color.startsWith('bg-') ? 'text-white' : color)} />
        </div>
        
        <div>
          <h3 className="text-slate-600 text-xs font-black uppercase tracking-widest mb-1">{label}</h3>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>

        {(trend !== undefined || description) && (
          <div className="flex items-center gap-2">
            {trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                trendIsUp ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
              )}>
                {trendIsUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trendValue}
              </div>
            )}
            {description && <span className="text-xs text-slate-400 font-medium">{description}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
