import React, { useState } from 'react';
import { ChemicalComponent, UnitType } from '../types/simulation';

interface EquipmentPaletteProps {
  components: ChemicalComponent[];
  onUpdateComponentFraction: (id: string, fraction: number) => void;
  onSelectUnitType: (type: UnitType) => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  onClose?: () => void;
}

interface PaletteEquipmentItem {
  type: UnitType;
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
}

export const EquipmentPalette: React.FC<EquipmentPaletteProps> = ({
  components,
  onUpdateComponentFraction,
  onSelectUnitType,
  activeCategory,
  onSelectCategory,
  onClose,
}) => {
  const [filterText, setFilterText] = useState('');
  const [editingCompId, setEditingCompId] = useState<string | null>(null);

  const equipmentItems: PaletteEquipmentItem[] = [
    // Separation
    { type: 'column', name: 'Distillation Column', category: 'separation', icon: 'view_column', color: 'text-[#ffddb8]', description: 'Trayed/packed multi-component fractionator' },
    { type: 'absorber', name: 'Gas Absorber', category: 'separation', icon: 'swap_vert', color: 'text-[#4cd7f6]', description: 'Gas sweetening & counter-current scrubbing' },
    { type: 'stripper', name: 'Steam Stripper', category: 'separation', icon: 'vertical_align_bottom', color: 'text-[#ffddb8]', description: 'Volatile fraction removal & regeneration' },
    { type: 'three_phase_separator', name: '3-Phase Separator', category: 'separation', icon: 'water_damage', color: 'text-[#4edea3]', description: 'Gas - Hydrocarbon - Aqueous brine knockout' },
    { type: 'liquid_liquid_separator', name: 'Liquid Decanter', category: 'separation', icon: 'opacity', color: 'text-[#acedff]', description: 'Immiscible liquid-liquid phase separation' },
    { type: 'vessel', name: 'Flash Drum (Vessel)', category: 'separation', icon: 'propane_tank', color: 'text-[#4cd7f6]', description: 'High/low pressure vapor-liquid equilibrium flash' },
    { type: 'splitter', name: 'Stream Splitter', category: 'separation', icon: 'call_split', color: 'text-[#869397]', description: 'Fixed ratio mass flow divider' },

    // Heat Transfer
    { type: 'heatex', name: 'Shell & Tube Exchanger', category: 'heatex', icon: 'device_thermostat', color: 'text-[#4cd7f6]', description: 'TEMA counter-current shell & tube heat transfer' },
    { type: 'furnace', name: 'Fired Heater (Furnace)', category: 'heatex', icon: 'local_fire_department', color: 'text-[#ffb95f]', description: 'Radiant-convection refinery direct fired furnace' },

    // Chemical Reactors
    { type: 'reactor', name: 'Catalytic Reactor (PFR)', category: 'reactors', icon: 'science', color: 'text-[#4edea3]', description: 'Fixed-bed / trickle bed catalytic reactor' },

    // Rotating & Hydraulics
    { type: 'pump', name: 'Centrifugal Pump', category: 'rotating', icon: 'mode_fan', color: 'text-[#4edea3]', description: 'Liquid booster with hydraulic head & NPSH check' },
    { type: 'compressor', name: 'Gas Compressor', category: 'rotating', icon: 'speed', color: 'text-[#ffb95f]', description: 'Centrifugal/reciprocating gas compression' },
    { type: 'valve', name: 'Control Valve', category: 'rotating', icon: 'valve', color: 'text-[#ffb4ab]', description: 'ISA-75 pressure letdown & Joule-Thomson valve' },
  ];

  const categories = [
    { id: 'all', label: 'All Equipment', icon: 'dashboard' },
    { id: 'separation', label: 'Separation & Fractionation', icon: 'view_column' },
    { id: 'heatex', label: 'Heat Transfer', icon: 'device_thermostat' },
    { id: 'reactors', label: 'Reactors & Kinetics', icon: 'science' },
    { id: 'rotating', label: 'Rotating & Valves', icon: 'settings_input_component' },
  ];

  const filteredItems = equipmentItems.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.description.toLowerCase().includes(filterText.toLowerCase()) ||
                          item.type.toLowerCase().includes(filterText.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalFraction = components.reduce((sum, c) => sum + c.fraction, 0);

  return (
    <aside className="w-64 max-w-[85vw] h-full shrink-0 bg-[#131b2e] border-r border-[#3d494c]/30 flex flex-col z-10 select-none overflow-hidden font-mono">
      {/* Title */}
      <div className="h-8 sm:h-7 px-2.5 flex items-center justify-between bg-[#171f33] border-b border-[#3d494c]/20">
        <span className="text-[11px] uppercase text-[#dae2fd] font-semibold tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[15px]">inventory_2</span>
          <span>Equipment Palette</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[#869397] text-[10px]">{equipmentItems.length} UNITS</span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-[#869397] hover:text-white hover:bg-[#222a3d] transition-colors"
              title="Close Palette"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Palette */}
      <div className="p-1.5 border-b border-[#3d494c]/20">
        <div className="flex items-center gap-1.5 bg-[#060e20] px-2 py-1 rounded border border-[#3d494c]/40">
          <span className="material-symbols-outlined text-[#869397] text-[14px]">search</span>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search equipment..."
            className="bg-transparent w-full text-[#dae2fd] text-[10px] focus:outline-none placeholder-[#869397]"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="text-[#869397] hover:text-[#dae2fd]">
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-1 p-1.5 border-b border-[#3d494c]/20 overflow-x-auto text-[9.5px]">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-[#4cd7f6] text-[#003640] font-bold'
                : 'bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Equipment List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredItems.map((item) => (
          <div
            key={item.type}
            onClick={() => onSelectUnitType(item.type)}
            className="p-1.5 rounded bg-[#060e20] hover:bg-[#222a3d] border border-[#3d494c]/30 hover:border-[#4cd7f6]/60 cursor-pointer transition-all group flex items-start justify-between gap-2"
            title={`Click to place ${item.name} on flowsheet`}
          >
            <div className="flex items-start gap-2 overflow-hidden">
              <span className={`material-symbols-outlined text-[18px] ${item.color} mt-0.5`}>
                {item.icon}
              </span>
              <div className="overflow-hidden">
                <div className="text-[#dae2fd] group-hover:text-[#4cd7f6] font-bold text-[10.5px] truncate">
                  {item.name}
                </div>
                <div className="text-[#869397] text-[8.5px] line-clamp-1 leading-tight mt-0.5">
                  {item.description}
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectUnitType(item.type);
              }}
              className="p-1 bg-[#171f33] group-hover:bg-[#4cd7f6] text-[#869397] group-hover:text-[#003640] rounded transition-colors text-[10px]"
              title="Add to canvas"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
        ))}
      </div>

      {/* Active Chemical Components Section */}
      <div className="p-2 bg-[#060e20] border-t border-[#3d494c]/30 space-y-1">
        <div className="flex items-center justify-between text-[#869397] text-[9.5px] uppercase tracking-wider">
          <span>Active Components</span>
          <span className={`text-[9px] ${Math.abs(totalFraction - 1.0) < 0.005 ? 'text-[#4edea3]' : 'text-[#ffb4ab]'}`}>
            Σ = {totalFraction.toFixed(3)}
          </span>
        </div>

        <div className="space-y-0.5 max-h-24 overflow-y-auto pr-0.5 text-[9.5px]">
          {components.map((comp) => (
            <div key={comp.id} className="flex items-center justify-between text-[#bcc9cd] hover:text-[#dae2fd] py-0.5 px-1 rounded hover:bg-[#171f33]/60">
              <span className="truncate" title={`${comp.name} (${comp.formula})`}>
                {comp.name}
              </span>
              {editingCompId === comp.id ? (
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  defaultValue={comp.fraction}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) onUpdateComponentFraction(comp.id, Math.max(0, Math.min(1, val)));
                    setEditingCompId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat((e.target as HTMLInputElement).value);
                      if (!isNaN(val)) onUpdateComponentFraction(comp.id, Math.max(0, Math.min(1, val)));
                      setEditingCompId(null);
                    }
                  }}
                  autoFocus
                  className="w-14 bg-[#131b2e] text-[#4cd7f6] border border-[#4cd7f6] rounded px-1 text-right focus:outline-none text-[9px]"
                />
              ) : (
                <span
                  onClick={() => setEditingCompId(comp.id)}
                  className="text-[#869397] hover:text-[#4cd7f6] cursor-pointer pl-1 font-bold"
                  title="Click to edit fraction"
                >
                  {comp.fraction.toFixed(3)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
