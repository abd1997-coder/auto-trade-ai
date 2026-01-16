import React from 'react';

interface Props {
  label: string;
  value: number | string;
  color?: string;
}

const IndicatorBadge: React.FC<Props> = ({ label, value, color = 'blue' }) => {
  const colorClass = {
    blue: 'bg-blue-900 text-blue-200 border-blue-700',
    purple: 'bg-purple-900 text-purple-200 border-purple-700',
    green: 'bg-emerald-900 text-emerald-200 border-emerald-700',
    orange: 'bg-orange-900 text-orange-200 border-orange-700',
  }[color] || 'bg-gray-800';

  return (
    <div className={`flex flex-col items-center p-2 rounded border ${colorClass} min-w-[80px]`}>
      <span className="text-xs opacity-70 uppercase tracking-wider">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
};

export default IndicatorBadge;