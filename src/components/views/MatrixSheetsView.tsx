import React from 'react';
import { ChemicalComponent, ProcessStream, UnitSystem } from '../../types/simulation';
import { formatFlow, formatPres, formatTemp } from '../../engine/thermoEngine';

interface MatrixSheetsViewProps {
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
}

export const MatrixSheetsView: React.FC<MatrixSheetsViewProps> = ({
  streams,
  components,
  unitSystem,
}) => {
  const handleExportCsv = () => {
    let csv = `Stream,Name,Phase,Temp[C],Pres[bar],Flow[kg/h],MW,Enthalpy[kJ/kg],VF,Density[kg/m3],` +
      components.map((c) => `x_${c.name}`).join(',') + `\n`;

    streams.forEach((s) => {
      const compVals = components.map((c) => (s.compositions[c.id] ?? 0).toFixed(4)).join(',');
      csv += `${s.id},"${s.name}",${s.phase},${s.tempC},${s.presBar},${s.flowKgH},${s.mw},${s.enthalpyKjKg},${s.vaporFraction},${s.densityKgM3},${compVals}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Heat_and_Material_Balance_Matrix.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-mono text-[11px] select-none">
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            <span>HEAT &amp; MATERIAL BALANCE (H&amp;MB) MATRIX SHEETS</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Full plant stream table with thermodynamic properties and individual chemical component fractions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 overflow-x-auto shadow-xl">
        <table className="w-full text-left text-[10.5px]">
          <thead>
            <tr className="text-[#869397] border-b border-[#3d494c]/30 uppercase text-[9.5px]">
              <th className="py-2 px-2">Stream</th>
              <th className="py-2 px-2">Phase</th>
              <th className="py-2 px-2 text-right">Temp</th>
              <th className="py-2 px-2 text-right">Pressure</th>
              <th className="py-2 px-2 text-right">Mass Flow</th>
              <th className="py-2 px-2 text-right">Vapor Frac.</th>
              <th className="py-2 px-2 text-right">MW</th>
              <th className="py-2 px-2 text-right">Enthalpy</th>
              <th className="py-2 px-2 text-right">Density</th>
              {components.map((c) => (
                <th key={c.id} className="py-2 px-2 text-right text-[#4cd7f6]">{c.formula}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d494c]/20">
            {streams.map((st) => (
              <tr key={st.id} className="hover:bg-[#222a3d] transition-colors">
                <td className="py-2 px-2 font-bold text-[#4cd7f6]">{st.id}</td>
                <td className="py-2 px-2 text-[#bcc9cd]">{st.phase}</td>
                <td className="py-2 px-2 text-right text-[#ffddb8]">{formatTemp(st.tempC, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#dae2fd]">{formatPres(st.presBar, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#4edea3]">{formatFlow(st.flowKgH, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#4cd7f6]">{st.vaporFraction.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-[#dae2fd]">{st.mw.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-[#bcc9cd]">
                  {st.enthalpyKjKg > 0 ? `+${st.enthalpyKjKg.toFixed(1)}` : st.enthalpyKjKg.toFixed(1)} kJ/kg
                </td>
                <td className="py-2 px-2 text-right text-[#869397]">{st.densityKgM3.toFixed(1)} kg/m³</td>
                {components.map((c) => {
                  const val = st.compositions[c.id] ?? 0;
                  return (
                    <td
                      key={c.id}
                      className={`py-2 px-2 text-right ${
                        val > 0.1 ? 'text-[#ffddb8] font-bold' : val > 0 ? 'text-[#dae2fd]' : 'text-[#869397]/50'
                      }`}
                    >
                      {val.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
