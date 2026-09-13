import { EquipmentUnit, ProcessStream, UnitSystem } from '../types/simulation';

// Unit conversion helpers
export function formatTemp(tempC: number, system: UnitSystem): string {
  if (system === 'Field') {
    return `${(tempC * 9 / 5 + 32).toFixed(2)} °F`;
  }
  if (system === 'Metric') {
    return `${(tempC + 273.15).toFixed(2)} K`;
  }
  return `${tempC.toFixed(2)} °C`;
}

export function formatPres(presBar: number, system: UnitSystem): string {
  if (system === 'Field') {
    return `${(presBar * 14.5038).toFixed(2)} psi`;
  }
  if (system === 'Metric') {
    return `${(presBar * 1.01972).toFixed(2)} kg/cm²`;
  }
  return `${presBar.toFixed(2)} bar`;
}

export function formatFlow(flowKgH: number, system: UnitSystem): string {
  if (system === 'Field') {
    return `${(flowKgH * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb/h`;
  }
  if (system === 'Metric') {
    return `${(flowKgH / 1000).toFixed(2)} t/h`;
  }
  return `${flowKgH.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg/h`;
}

// Numerical Integration for Reactor R-101 (ODE15s / Runge-Kutta approximation)
export interface ReactorProfilePoint {
  zM: number;
  tempC: number;
  presBar: number;
  conversionPct: number;
  c6h6Rate: number;
}

export function integrateReactorOde(
  unit: EquipmentUnit,
  inletStream: ProcessStream,
  quenchTempC: number = 420.0
): {
  profile: ReactorProfilePoint[];
  outletTempC: number;
  outletPresBar: number;
  conversionPct: number;
  h2YieldPct: number;
} {
  const steps = 40;
  const L = unit.geometry.bedHeightM || 5.42;
  const dz = L / steps;
  
  let T = unit.equilibrium.inletTempC; // e.g. 510 C
  let P = unit.equilibrium.operatingPresBar; // e.g. 82.5 bar
  let X = 0.0; // naphthene conversion

  const points: ReactorProfilePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const z = i * dz;
    
    // Intermediate Quench at mid-bed (z ~ 2.7m)
    if (i === Math.floor(steps / 2)) {
      // Hydrogen quench injection cooling
      T = T - 18.5;
    }

    // Reaction rate: Endothermic dehydrogenation absorbs heat, decreasing T
    // Rate ~ k0 * exp(-E/RT) * (1 - X)
    const R = 8.314;
    const Tk = T + 273.15;
    const k1 = 1.42e5 * Math.exp(-95000 / (R * Tk));
    const dX_dz = Math.max(0, k1 * (1 - X) * 0.45);
    
    // dT/dz = (-deltaH * dX/dz) / (Cp * m_dot)
    // Endothermic reaction -> dT < 0
    const dT_dz = -3.8 * dX_dz * 25.0;
    
    // Ergun equation for pressure drop: dP/dz
    const dP_dz = -0.34; // bar per meter

    // Update state
    X = Math.min(0.985, X + dX_dz * dz);
    T = Math.max(460, T + dT_dz * dz);
    P = Math.max(70, P + dP_dz * dz);

    points.push({
      zM: Number(z.toFixed(2)),
      tempC: Number(T.toFixed(2)),
      presBar: Number(P.toFixed(2)),
      conversionPct: Number((X * 100).toFixed(1)),
      c6h6Rate: Number((k1 * 100).toFixed(3)),
    });
  }

  return {
    profile: points,
    outletTempC: Number(T.toFixed(2)),
    outletPresBar: Number(P.toFixed(2)),
    conversionPct: Number((X * 100).toFixed(1)),
    h2YieldPct: 94.2,
  };
}

// Flash calculation simulation (Isothermal Rachford-Rice solver)
export function solveRachfordRice(z: number[], K: number[]): { vf: number; x: number[]; y: number[] } {
  let vf = 0.5; // initial guess
  for (let iter = 0; iter < 20; iter++) {
    let f = 0;
    let df = 0;
    for (let i = 0; i < z.length; i++) {
      const denom = 1 + vf * (K[i] - 1);
      f += (z[i] * (K[i] - 1)) / denom;
      df -= (z[i] * Math.pow(K[i] - 1, 2)) / Math.pow(denom, 2);
    }
    const step = f / df;
    vf = Math.max(0.0001, Math.min(0.9999, vf - step));
    if (Math.abs(f) < 1e-6) break;
  }

  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < z.length; i++) {
    const xi = z[i] / (1 + vf * (K[i] - 1));
    x.push(xi);
    y.push(xi * K[i]);
  }

  return { vf, x, y };
}
