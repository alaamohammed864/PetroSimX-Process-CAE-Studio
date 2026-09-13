import React, { useState } from 'react';

interface UnitConverterModalProps {
  onClose: () => void;
}

export const UnitConverterModal: React.FC<UnitConverterModalProps> = ({ onClose }) => {
  const [val, setVal] = useState<number>(82.5);
  const [category, setCategory] = useState<'pressure' | 'temp' | 'flow' | 'duty'>('pressure');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#171f33] border border-[#3d494c] rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden font-mono text-[11px]">
        {/* Header */}
        <div className="px-4 py-2.5 bg-[#222a3d] border-b border-[#3d494c]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">calculate</span>
            <span className="font-bold text-[12px] text-[#dae2fd]">
              CHEMICAL PROCESS UNITS CONVERTER
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-[#869397] hover:text-white rounded" type="button">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Category Tabs */}
          <div className="flex bg-[#060e20] p-1 rounded border border-[#3d494c]/30 text-[10px]">
            {(['pressure', 'temp', 'flow', 'duty'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  if (cat === 'pressure') setVal(82.5);
                  if (cat === 'temp') setVal(510.0);
                  if (cat === 'flow') setVal(45000.0);
                  if (cat === 'duty') setVal(14.82);
                }}
                className={`flex-1 py-1 text-center rounded uppercase font-semibold transition-colors ${
                  category === cat ? 'bg-[#222a3d] text-[#4cd7f6]' : 'text-[#bcc9cd] hover:text-[#dae2fd]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Input Value */}
          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/30 flex items-center justify-between">
            <span className="text-[#869397]">Base Value:</span>
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
              className="w-36 bg-[#131b2e] text-[#4cd7f6] border border-[#3d494c] rounded px-2 py-1 text-right text-[12px] font-bold focus:outline-none focus:border-[#4cd7f6]"
            />
          </div>

          {/* Conversion Grid */}
          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/30 space-y-2">
            <span className="text-[#869397] text-[10px] block pb-1 border-b border-[#3d494c]/20 uppercase">
              Converted Equivalents
            </span>

            {category === 'pressure' && (
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Bar:</span>
                  <span className="text-[#dae2fd] font-bold">{val.toFixed(2)} bar</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Pounds / sq in (psi):</span>
                  <span className="text-[#ffddb8] font-bold">{(val * 14.5038).toFixed(2)} psi</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Kilopascals (kPa):</span>
                  <span className="text-[#4edea3] font-bold">{(val * 100).toFixed(1)} kPa</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Atmospheres (atm):</span>
                  <span className="text-[#acedff] font-bold">{(val * 0.986923).toFixed(3)} atm</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Technical (kg/cm²):</span>
                  <span className="text-[#dae2fd] font-bold">{(val * 1.01972).toFixed(2)} kg/cm²</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Torr / mmHg:</span>
                  <span className="text-[#dae2fd] font-bold">{(val * 750.062).toFixed(0)} mmHg</span>
                </div>
              </div>
            )}

            {category === 'temp' && (
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Celsius (°C):</span>
                  <span className="text-[#dae2fd] font-bold">{val.toFixed(2)} °C</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Fahrenheit (°F):</span>
                  <span className="text-[#ffddb8] font-bold">{(val * 9 / 5 + 32).toFixed(2)} °F</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Kelvin (K):</span>
                  <span className="text-[#4edea3] font-bold">{(val + 273.15).toFixed(2)} K</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Rankine (°R):</span>
                  <span className="text-[#acedff] font-bold">{((val + 273.15) * 1.8).toFixed(2)} °R</span>
                </div>
              </div>
            )}

            {category === 'flow' && (
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Mass Flow (kg/h):</span>
                  <span className="text-[#dae2fd] font-bold">{val.toLocaleString()} kg/h</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Mass Flow (lb/h):</span>
                  <span className="text-[#ffddb8] font-bold">{(val * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb/h</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Metric Ton / Day (t/d):</span>
                  <span className="text-[#4edea3] font-bold">{(val * 24 / 1000).toFixed(2)} t/d</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Mass Flow (kg/s):</span>
                  <span className="text-[#acedff] font-bold">{(val / 3600).toFixed(3)} kg/s</span>
                </div>
              </div>
            )}

            {category === 'duty' && (
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Megawatts (MW):</span>
                  <span className="text-[#dae2fd] font-bold">{val.toFixed(2)} MW</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Kilowatts (kW):</span>
                  <span className="text-[#ffddb8] font-bold">{(val * 1000).toLocaleString()} kW</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">MMBTU / Hour:</span>
                  <span className="text-[#4edea3] font-bold">{(val * 3.41214).toFixed(2)} MMBTU/h</span>
                </div>
                <div className="p-1.5 bg-[#171f33] rounded">
                  <span className="text-[#869397] block text-[9px]">Giga-Joules / hr:</span>
                  <span className="text-[#acedff] font-bold">{(val * 3.6).toFixed(2)} GJ/h</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#222a3d] border-t border-[#3d494c]/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 transition-opacity"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
