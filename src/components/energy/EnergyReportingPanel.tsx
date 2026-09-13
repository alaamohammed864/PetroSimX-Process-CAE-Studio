import React, { useState } from 'react';
import { CompleteEnergyAssessment, generateEnergyAndEmissionsReportText } from '../../engine/energy/energyEngine';
import { PinchAnalysisResult } from '../../types/energy';

interface EnergyReportingPanelProps {
  assessment: CompleteEnergyAssessment;
  pinchResult: PinchAnalysisResult;
}

export const EnergyReportingPanel: React.FC<EnergyReportingPanelProps> = ({
  assessment,
  pinchResult,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const reportText = generateEnergyAndEmissionsReportText(assessment);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PetroSimX_Energy_Emissions_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const rows = [
      ['SECTION', 'METRIC', 'VALUE', 'UNIT'],
      ['OVERALL', 'Heating Thermal Demand', assessment.summary.heatingDutyMW, 'MW'],
      ['OVERALL', 'Cooling Thermal Rejection', assessment.summary.coolingDutyMW, 'MW'],
      ['OVERALL', 'Electrical Power Load', assessment.summary.electricalPowerMW, 'MW'],
      ['OVERALL', 'Hourly Energy Cost', assessment.summary.hourlyEnergyCost, 'USD/h'],
      ['OVERALL', 'Annual Energy Cost', assessment.summary.annualEnergyCost, 'USD/yr'],
      ['OVERALL', 'Specific Energy Intensity', assessment.summary.energyIntensityGjPerTonProduct, 'GJ/ton product'],
      ['OVERALL', 'Specific Power Requirement', assessment.summary.energyIntensityKwhPerBblProduct, 'kWh/bbl'],
      [],
      ['UTILITIES', 'Name', 'Consumption Rate', 'Unit', 'Cost Rate ($/h)'],
      ...assessment.utilities.map((u) => [
        'UTILITIES',
        u.name,
        u.consumptionRate,
        u.consumptionUnit,
        u.costPerHour.toFixed(2),
      ]),
      [],
      ['EQUIPMENT RANKING', 'Tag', 'Name', 'Type', 'Duty (MW)', 'Hourly Cost ($/h)'],
      ...assessment.equipmentRanking.map((e) => [
        'EQUIPMENT',
        e.unitTag,
        e.unitName,
        e.category,
        e.dutyMW.toFixed(2),
        e.costPerHour.toFixed(2),
      ]),
      [],
      ['EMISSIONS', 'Pollutant', 'Rate (kg/h)', 'Metric Tons / Year'],
      ['EMISSIONS', 'CO2 (Total)', assessment.emissions.co2RateKgH, assessment.emissions.co2TonPerYear],
      ['EMISSIONS', 'CO2 Scope 1 (Direct)', assessment.emissions.scope1Co2KgH, Math.round((assessment.emissions.scope1Co2KgH * 8000) / 1000)],
      ['EMISSIONS', 'CO2 Scope 2 (Indirect)', assessment.emissions.scope2Co2KgH, Math.round((assessment.emissions.scope2Co2KgH * 8000) / 1000)],
      ['EMISSIONS', 'CO (Carbon Monoxide)', assessment.emissions.coRateKgH, ((assessment.emissions.coRateKgH * 8000) / 1000).toFixed(2)],
      ['EMISSIONS', 'NOx (Nitrogen Oxides)', assessment.emissions.noxRateKgH, ((assessment.emissions.noxRateKgH * 8000) / 1000).toFixed(2)],
      ['EMISSIONS', 'SOx (Sulfur Oxides)', assessment.emissions.soxRateKgH, ((assessment.emissions.soxRateKgH * 8000) / 1000).toFixed(2)],
      [],
      ['PINCH ANALYSIS', 'Parameter', 'Value', 'Unit'],
      ['PINCH', 'Minimum Approach Delta Tmin', pinchResult.deltaTmin, '°C'],
      ['PINCH', 'Pinch Temperature', pinchResult.pinchTempC, '°C'],
      ['PINCH', 'Min Hot Utility Qh,min', pinchResult.qhMinMW, 'MW'],
      ['PINCH', 'Min Cold Utility Qc,min', pinchResult.qcMinMW, 'MW'],
      ['PINCH', 'Potential Heating Savings', pinchResult.potentialHeatingSavingsMW, 'MW'],
      ['PINCH', 'Potential Annual Cost Savings', pinchResult.potentialAnnualCostSavingsUSD, 'USD/yr'],
    ];

    const csvContent = rows
      .map((r) => r.map((cell) => `"${cell ?? ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PetroSimX_Energy_Emissions_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">description</span>
            Official Process Energy, Utilities & Emissions Dossier
          </h2>
          <p className="text-xs text-[#869397] mt-0.5">
            ISO 50001 & API 560 compliant technical document with complete thermal balance, emissions inventories, and pinch recovery potential.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/50 text-[#dae2fd] text-xs font-mono rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied to Clipboard' : 'Copy Text'}
          </button>

          <button
            onClick={handleDownloadTxt}
            className="px-3 py-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/50 text-[#4cd7f6] text-xs font-mono rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            Export .TXT
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-3.5 py-1.5 bg-[#4cd7f6] hover:bg-[#38bde6] text-[#003640] font-semibold text-xs font-mono rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">table_chart</span>
            Export .CSV Matrix
          </button>
        </div>
      </div>

      {/* Engineering Warnings & Feasibility Checklist */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5 pb-2 border-b border-[#3d494c]/30">
          <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">warning</span>
          Engineering Audits & Pinch Feasibility Warnings
        </h3>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-[#171f33] rounded border border-[#3d494c]/40 space-y-1">
            <div className="font-semibold text-[#ffddb8] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">thermostat</span>
              Pinch Boundary Temperature Verification
            </div>
            <p className="text-[#bcc9cd] text-[11px] leading-relaxed">
              Pinch temperature is established at <strong className="text-[#dae2fd]">{pinchResult.pinchTempC}°C</strong> (Hot Pinch: {pinchResult.hotPinchTempC}°C, Cold Pinch: {pinchResult.coldPinchTempC}°C). Any heating below cold pinch or cooling above hot pinch destroys thermodynamic driving force and causes unnecessary utility expenditure.
            </p>
          </div>

          <div className="p-2.5 bg-[#171f33] rounded border border-[#3d494c]/40 space-y-1">
            <div className="font-semibold text-[#ffddb8] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">savings</span>
              Heat Exchanger Capital vs Fuel Trade-Off
            </div>
            <p className="text-[#bcc9cd] text-[11px] leading-relaxed">
              At ΔTmin = {pinchResult.deltaTmin}°C, maximum energy recovery is {pinchResult.maxEnergyRecoveryMW} MW. Lowering ΔTmin further increases logarithmic mean temperature difference (LMTD) penalty, requiring disproportionately larger heat exchanger surface area (high capital cost).
            </p>
          </div>

          {pinchResult.engineeringWarnings.map((warn, i) => (
            <div
              key={`warn-${i}`}
              className="p-2.5 bg-[#171f33] rounded border border-[#ffb95f]/40 space-y-1 md:col-span-2"
            >
              <div className="font-semibold text-[#ffddb8] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">info</span>
                Special Operational Note
              </div>
              <p className="text-[#bcc9cd] text-[11px]">{warn}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Report Monospace Preview */}
      <div className="bg-[#0b1326] border border-[#3d494c]/30 rounded p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
          <span className="text-xs font-mono text-[#869397] uppercase">Monospace Dossier Preview</span>
          <span className="text-[10.5px] font-mono text-[#4cd7f6]">UTF-8 INDUSTRIAL ENCODING</span>
        </div>

        <pre className="mt-3 p-3 bg-[#060e20] rounded border border-[#3d494c]/20 font-mono text-xs text-[#dae2fd] overflow-x-auto whitespace-pre leading-relaxed max-h-[480px]">
          {reportText}
        </pre>
      </div>
    </div>
  );
};
