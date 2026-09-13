import { EquipmentUnit, ProcessStream } from '../../types/simulation';
import {
  PinchStream,
  PinchAnalysisResult,
  CompositeCurvePoint,
  HeatIntegrationOpportunity,
} from '../../types/energy';

/**
 * Extracts hot and cold streams requiring thermal duty from the flowsheet.
 */
export function extractPinchStreams(
  units: EquipmentUnit[],
  streams: ProcessStream[]
): PinchStream[] {
  const pinchStreams: PinchStream[] = [];

  // Helper to find stream by ID
  const getStream = (id?: string) => streams.find((s) => s.id === id);

  units.forEach((u) => {
    // 1. Heat Exchangers
    if (u.type === 'heatex') {
      const inStream = getStream(u.inletStreamIds[0]);
      const outStream = getStream(u.outletStreamIds[0]);
      const dutyMW = u.equilibrium?.dutyMW ?? 2.5;

      if (inStream && outStream && Math.abs(inStream.tempC - outStream.tempC) > 1) {
        if (inStream.tempC > outStream.tempC) {
          // Hot stream being cooled
          const dt = inStream.tempC - outStream.tempC;
          pinchStreams.push({
            id: `hot_${u.id}`,
            name: `${u.name} (Hot Process Stream)`,
            type: 'hot',
            sourceUnitId: u.id,
            tinC: inStream.tempC,
            toutC: outStream.tempC,
            dutyMW,
            mCpMWK: dutyMW / dt,
          });
        } else {
          // Cold stream being heated
          const dt = outStream.tempC - inStream.tempC;
          pinchStreams.push({
            id: `cold_${u.id}`,
            name: `${u.name} (Cold Process Stream)`,
            type: 'cold',
            sourceUnitId: u.id,
            tinC: inStream.tempC,
            toutC: outStream.tempC,
            dutyMW,
            mCpMWK: dutyMW / dt,
          });
        }
      } else {
        // Fallback standard stream for demo
        pinchStreams.push({
          id: `cold_${u.id}`,
          name: `${u.name} (Preheat Duty)`,
          type: 'cold',
          sourceUnitId: u.id,
          tinC: 85,
          toutC: 220,
          dutyMW: dutyMW > 0 ? dutyMW : 3.8,
          mCpMWK: (dutyMW > 0 ? dutyMW : 3.8) / (220 - 85),
        });
      }
    }

    // 2. Furnaces / Fired Heaters
    if (u.type === 'furnace') {
      const dutyMW = u.equilibrium?.dutyMW ?? 8.5;
      const inStream = getStream(u.inletStreamIds[0]);
      const tin = inStream ? inStream.tempC : (u.equilibrium?.inletTempC ?? 320);
      const tout = u.equilibrium?.outletTempC ?? 510;
      const dt = Math.max(10, tout - tin);

      pinchStreams.push({
        id: `cold_${u.id}`,
        name: `${u.name} (Feed Charge Heating)`,
        type: 'cold',
        sourceUnitId: u.id,
        tinC: tin,
        toutC: tout,
        dutyMW,
        mCpMWK: dutyMW / dt,
      });
    }

    // 3. Distillation Columns: Reboiler (Cold) and Condenser (Hot)
    if (u.type === 'column') {
      const reboilerDutyMW = u.columnSpec?.refluxRatio ? 4.2 : 3.5;
      const condenserDutyMW = u.columnSpec?.refluxRatio ? 3.8 : 3.2;

      // Reboiler heats bottoms liquid
      pinchStreams.push({
        id: `cold_${u.id}_reb`,
        name: `${u.name} (Reboiler Vaporization)`,
        type: 'cold',
        sourceUnitId: u.id,
        tinC: 175,
        toutC: 180, // Narrow boiling range
        dutyMW: reboilerDutyMW,
        mCpMWK: reboilerDutyMW / 5,
      });

      // Condenser cools overhead vapor
      pinchStreams.push({
        id: `hot_${u.id}_cond`,
        name: `${u.name} (Overhead Condenser)`,
        type: 'hot',
        sourceUnitId: u.id,
        tinC: 88,
        toutC: 45,
        dutyMW: condenserDutyMW,
        mCpMWK: condenserDutyMW / (88 - 45),
      });
    }

    // 4. Exothermic / High Temp Reactors
    if (u.type === 'reactor') {
      const outStream = getStream(u.outletStreamIds[0]);
      const tin = u.equilibrium?.inletTempC ?? 510;
      const tout = outStream ? outStream.tempC : (u.equilibrium?.outletTempC ?? 495);

      // Effluent cooling down downstream
      pinchStreams.push({
        id: `hot_${u.id}_effluent`,
        name: `${u.name} (Effluent Cooling Train)`,
        type: 'hot',
        sourceUnitId: u.id,
        tinC: Math.max(tin, tout),
        toutC: 95,
        dutyMW: 5.4,
        mCpMWK: 5.4 / (Math.max(tin, tout) - 95),
      });
    }
  });

  // Ensure we have at least standard streams if flowsheet is sparse
  if (pinchStreams.filter((s) => s.type === 'hot').length === 0) {
    pinchStreams.push({
      id: 'hot_default_1',
      name: 'Reactor Effluent Stream',
      type: 'hot',
      sourceUnitId: 'R-101',
      tinC: 495,
      toutC: 80,
      dutyMW: 6.2,
      mCpMWK: 6.2 / (495 - 80),
    });
    pinchStreams.push({
      id: 'hot_default_2',
      name: 'Stabilizer Column Overhead',
      type: 'hot',
      sourceUnitId: 'C-101',
      tinC: 92,
      toutC: 42,
      dutyMW: 3.5,
      mCpMWK: 3.5 / (92 - 42),
    });
  }

  if (pinchStreams.filter((s) => s.type === 'cold').length === 0) {
    pinchStreams.push({
      id: 'cold_default_1',
      name: 'Raw Naphtha Feed Preheat',
      type: 'cold',
      sourceUnitId: 'E-101',
      tinC: 35,
      toutC: 320,
      dutyMW: 5.8,
      mCpMWK: 5.8 / (320 - 35),
    });
    pinchStreams.push({
      id: 'cold_default_2',
      name: 'Furnace Radiant Charge',
      type: 'cold',
      sourceUnitId: 'F-101',
      tinC: 320,
      toutC: 510,
      dutyMW: 8.5,
      mCpMWK: 8.5 / (510 - 320),
    });
    pinchStreams.push({
      id: 'cold_default_3',
      name: 'Stabilizer Reboiler Boilup',
      type: 'cold',
      sourceUnitId: 'C-101',
      tinC: 175,
      toutC: 180,
      dutyMW: 4.2,
      mCpMWK: 4.2 / 5,
    });
  }

  return pinchStreams;
}

/**
 * Performs Linnhoff Problem Table Algorithm for a given ΔTmin.
 */
export function runPinchAnalysis(
  streams: PinchStream[],
  deltaTmin: number = 10
): PinchAnalysisResult {
  const halfDt = deltaTmin / 2;

  // 1. Shifted temperatures
  // Hot streams: T* = T - ΔTmin/2
  // Cold streams: T* = T + ΔTmin/2
  const shiftedTempsSet = new Set<number>();

  streams.forEach((s) => {
    if (s.type === 'hot') {
      shiftedTempsSet.add(s.tinC - halfDt);
      shiftedTempsSet.add(s.toutC - halfDt);
    } else {
      shiftedTempsSet.add(s.tinC + halfDt);
      shiftedTempsSet.add(s.toutC + halfDt);
    }
  });

  // Sort shifted temperatures descending
  const sortedShiftedTemps = Array.from(shiftedTempsSet).sort((a, b) => b - a);

  // 2. Evaluate heat balance in each interval
  const intervalTable: {
    upper: number;
    lower: number;
    dt: number;
    sumCpHot: number;
    sumCpCold: number;
    netDeltaH: number; // (sumCpCold - sumCpHot) * dt
  }[] = [];

  for (let i = 0; i < sortedShiftedTemps.length - 1; i++) {
    const upper = sortedShiftedTemps[i];
    const lower = sortedShiftedTemps[i + 1];
    const dt = upper - lower;

    if (dt <= 0.001) continue;

    let sumCpHot = 0;
    let sumCpCold = 0;

    streams.forEach((s) => {
      if (s.type === 'hot') {
        const tHigh = s.tinC - halfDt;
        const tLow = s.toutC - halfDt;
        // Check if stream is present in this interval
        if (tHigh >= upper - 0.001 && tLow <= lower + 0.001) {
          sumCpHot += s.mCpMWK;
        }
      } else {
        const tLow = s.tinC + halfDt;
        const tHigh = s.toutC + halfDt;
        // Cold stream heats from tLow to tHigh
        if (tHigh >= upper - 0.001 && tLow <= lower + 0.001) {
          sumCpCold += s.mCpMWK;
        }
      }
    });

    const netDeltaH = (sumCpCold - sumCpHot) * dt;
    intervalTable.push({
      upper,
      lower,
      dt,
      sumCpHot,
      sumCpCold,
      netDeltaH,
    });
  }

  // 3. Heat Cascade (Unadjusted)
  const unadjustedCascade: number[] = [0];
  for (let i = 0; i < intervalTable.length; i++) {
    const nextR = unadjustedCascade[i] - intervalTable[i].netDeltaH;
    unadjustedCascade.push(nextR);
  }

  // Find minimum cascade residual
  const minResidual = Math.min(...unadjustedCascade);
  const qhMin = minResidual < 0 ? -minResidual : 0;

  // 4. Feasible Heat Cascade
  const feasibleCascade: number[] = [];
  let pinchIntervalIndex = 0;
  let minFeasibleVal = Infinity;

  for (let i = 0; i < unadjustedCascade.length; i++) {
    const val = unadjustedCascade[i] + qhMin;
    feasibleCascade.push(val);
    if (Math.abs(val) < minFeasibleVal) {
      minFeasibleVal = Math.abs(val);
      pinchIntervalIndex = i;
    }
  }

  const qcMin = feasibleCascade[feasibleCascade.length - 1];

  // Shifted pinch temperature is at pinchIntervalIndex
  const shiftedPinchTemp = sortedShiftedTemps[pinchIntervalIndex] ?? 145;
  const hotPinchTemp = shiftedPinchTemp + halfDt;
  const coldPinchTemp = shiftedPinchTemp - halfDt;

  // Current utilities in the flowsheet without integration
  const totalHotDuty = streams
    .filter((s) => s.type === 'hot')
    .reduce((sum, s) => sum + s.dutyMW, 0);
  const totalColdDuty = streams
    .filter((s) => s.type === 'cold')
    .reduce((sum, s) => sum + s.dutyMW, 0);

  const currentHotUtility = totalColdDuty;
  const currentColdUtility = totalHotDuty;

  const maxEnergyRecovery = Math.max(0, totalHotDuty - qcMin);
  const potentialHeatingSavings = Math.max(0, currentHotUtility - qhMin);
  const potentialCoolingSavings = Math.max(0, currentColdUtility - qcMin);

  // Economic estimation: $22/MWh for heat, $0.045/m3 for cooling (~$10/MWh)
  const potentialAnnualCostSavingsUSD =
    (potentialHeatingSavings * 22 + potentialCoolingSavings * 10) * 8000;

  // 5. Construct Hot and Cold Composite Curves
  const hotCompositeCurve = constructHotComposite(streams.filter((s) => s.type === 'hot'));
  const coldCompositeCurve = constructColdComposite(
    streams.filter((s) => s.type === 'cold'),
    qcMin,
    qhMin
  );

  // 6. Identify specific opportunities & engineering warnings
  const opportunities = generatePinchOpportunities(
    streams,
    hotPinchTemp,
    coldPinchTemp,
    potentialHeatingSavings,
    potentialAnnualCostSavingsUSD
  );

  const engineeringWarnings: string[] = [];
  if (deltaTmin < 8) {
    engineeringWarnings.push(
      `Selected ΔTmin of ${deltaTmin}°C is aggressively low; capital expenditure for heat exchanger surface area will rise exponentially.`
    );
  }
  if (hotPinchTemp > 250) {
    engineeringWarnings.push(
      `Pinch temperature is high (${hotPinchTemp.toFixed(1)}°C). Ensure high-temperature heat recovery metallurgy is rated for hydrogen/cracking service.`
    );
  }

  return {
    deltaTmin,
    pinchTempC: parseFloat(shiftedPinchTemp.toFixed(1)),
    hotPinchTempC: parseFloat(hotPinchTemp.toFixed(1)),
    coldPinchTempC: parseFloat(coldPinchTemp.toFixed(1)),
    qhMinMW: parseFloat(qhMin.toFixed(2)),
    qcMinMW: parseFloat(qcMin.toFixed(2)),
    maxEnergyRecoveryMW: parseFloat(maxEnergyRecovery.toFixed(2)),
    currentHotUtilityMW: parseFloat(currentHotUtility.toFixed(2)),
    currentColdUtilityMW: parseFloat(currentColdUtility.toFixed(2)),
    potentialHeatingSavingsMW: parseFloat(potentialHeatingSavings.toFixed(2)),
    potentialCoolingSavingsMW: parseFloat(potentialCoolingSavings.toFixed(2)),
    potentialAnnualCostSavingsUSD: Math.round(potentialAnnualCostSavingsUSD),
    hotCompositeCurve,
    coldCompositeCurve,
    streams,
    opportunities,
    engineeringWarnings,
  };
}

/**
 * Constructs points (H, T) for Hot Composite Curve.
 */
function constructHotComposite(hotStreams: PinchStream[]): CompositeCurvePoint[] {
  if (hotStreams.length === 0) return [];

  const tempSet = new Set<number>();
  hotStreams.forEach((s) => {
    tempSet.add(s.tinC);
    tempSet.add(s.toutC);
  });
  const temps = Array.from(tempSet).sort((a, b) => a - b); // ascending

  const points: CompositeCurvePoint[] = [];
  let cumulativeH = 0;

  points.push({ h: 0, t: temps[0] });

  for (let i = 0; i < temps.length - 1; i++) {
    const tLow = temps[i];
    const tHigh = temps[i + 1];
    const dt = tHigh - tLow;

    let activeCp = 0;
    hotStreams.forEach((s) => {
      if (s.tinC >= tHigh - 0.001 && s.toutC <= tLow + 0.001) {
        activeCp += s.mCpMWK;
      }
    });

    cumulativeH += activeCp * dt;
    points.push({
      h: parseFloat(cumulativeH.toFixed(2)),
      t: tHigh,
    });
  }

  return points;
}

/**
 * Constructs points (H, T) for Cold Composite Curve, offset by Qc,min.
 */
function constructColdComposite(
  coldStreams: PinchStream[],
  qcMin: number,
  _qhMin: number
): CompositeCurvePoint[] {
  if (coldStreams.length === 0) return [];

  const tempSet = new Set<number>();
  coldStreams.forEach((s) => {
    tempSet.add(s.tinC);
    tempSet.add(s.toutC);
  });
  const temps = Array.from(tempSet).sort((a, b) => a - b); // ascending

  const points: CompositeCurvePoint[] = [];
  let cumulativeH = qcMin; // offset by cooling requirement

  points.push({ h: parseFloat(cumulativeH.toFixed(2)), t: temps[0] });

  for (let i = 0; i < temps.length - 1; i++) {
    const tLow = temps[i];
    const tHigh = temps[i + 1];
    const dt = tHigh - tLow;

    let activeCp = 0;
    coldStreams.forEach((s) => {
      if (s.toutC >= tHigh - 0.001 && s.tinC <= tLow + 0.001) {
        activeCp += s.mCpMWK;
      }
    });

    cumulativeH += activeCp * dt;
    points.push({
      h: parseFloat(cumulativeH.toFixed(2)),
      t: tHigh,
    });
  }

  return points;
}

/**
 * Generates actionable heat integration matches and opportunities.
 */
function generatePinchOpportunities(
  streams: PinchStream[],
  hotPinch: number,
  coldPinch: number,
  potentialSavingsMW: number,
  annualSavingsUSD: number
): HeatIntegrationOpportunity[] {
  const list: HeatIntegrationOpportunity[] = [];

  // 1. Reactor Effluent to Feed Preheat Match
  const reactorEffluent = streams.find((s) => s.type === 'hot' && s.tinC > 400);
  const feedPreheat = streams.find((s) => s.type === 'cold' && s.tinC < 100 && s.toutC > 250);

  if (reactorEffluent && feedPreheat) {
    list.push({
      id: 'opp_1',
      title: 'Reactor Effluent / Cold Feed Heat Integration (E-101 Train)',
      type: 'exchanger_match',
      description: `Cross-exchange hot reactor effluent (${reactorEffluent.tinC}°C) against cold incoming naphtha feed (${feedPreheat.tinC}°C to ${feedPreheat.toutC}°C). Directly displaces furnace radiant fuel gas duty.`,
      potentialSavingMW: parseFloat(Math.min(reactorEffluent.dutyMW, feedPreheat.dutyMW * 0.75).toFixed(2)),
      estimatedAnnualSavingsUSD: Math.round(annualSavingsUSD * 0.55),
      priority: 'High',
      hotStreamName: reactorEffluent.name,
      coldStreamName: feedPreheat.name,
    });
  }

  // 2. Column Overhead Condenser Heat Recovery
  const condenser = streams.find((s) => s.name.includes('Condenser') || s.name.includes('Overhead'));
  if (condenser) {
    list.push({
      id: 'opp_2',
      title: 'Low-Temperature Heat Recovery from Column Overhead Condenser',
      type: 'cooling',
      description: `Overhead vapor sensible and latent condensation duty (${condenser.dutyMW} MW at ${condenser.tinC}°C) currently rejected to cooling water can preheat boiler feedwater or deaerator makeup water.`,
      potentialSavingMW: parseFloat((condenser.dutyMW * 0.4).toFixed(2)),
      estimatedAnnualSavingsUSD: Math.round(annualSavingsUSD * 0.2),
      priority: 'Medium',
      hotStreamName: condenser.name,
    });
  }

  // 3. Overall Pinch Target Realization
  list.push({
    id: 'opp_3',
    title: 'Pinch Network Retrofit & Hot Utility Reduction',
    type: 'heating',
    description: `Current process hot utility exceeds theoretical minimum Qh,min by ${potentialSavingsMW} MW due to cross-pinch heat dissipation below ${coldPinch.toFixed(0)}°C. Re-routing exchangers across pinch boundary captures full thermal potential.`,
    potentialSavingMW: potentialSavingsMW,
    estimatedAnnualSavingsUSD: annualSavingsUSD,
    priority: 'High',
  });

  // 4. Hot Oil vs High-Pressure Steam Balancing
  list.push({
    id: 'opp_4',
    title: 'Reboiler Steam Header Pressure Optimization',
    type: 'integration',
    description: `Stabilizer column reboiler operates at 180°C. Switching from 40 bar HPS to 15 bar MPS reduces exergy destruction in throttle valves and saves $4.50/ton in utility generation costs.`,
    potentialSavingMW: 0.85,
    estimatedAnnualSavingsUSD: 52000,
    priority: 'Medium',
  });

  return list;
}
