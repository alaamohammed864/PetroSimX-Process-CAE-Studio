/**
 * Thermodynamics and Physical Property Constants
 * Reference: Perry's Chemical Engineers' Handbook & NIST Chemistry WebBook
 */

export const R_GAS = 8.314462618; // Universal gas constant in J / (mol * K)
export const T_STD_K = 288.15; // 15 °C Standard temperature in Kelvin
export const P_STD_BAR = 1.01325; // 1 atm standard pressure in bar

export interface PureComponentData {
  id: string;
  name: string;
  formula: string;
  casNumber: string;
  mw: number; // Molecular weight in g/mol
  tcK: number; // Critical Temperature in Kelvin
  pcBar: number; // Critical Pressure in bar
  omega: number; // Accentric factor
  zc: number; // Critical compressibility factor
  vcM3Kmol: number; // Critical volume in m^3 / kmol
  tbK: number; // Normal boiling point in Kelvin
  // Ideal gas heat capacity Cp0 = A + B*T + C*T^2 + D*T^3 (J / (mol * K), T in K)
  cpCoeffs: [number, number, number, number];
  // Antoine parameters: log10(P_bar) = A - B / (T_K + C)
  antoine: [number, number, number];
  // Liquid density parameters (Rackett equation: V_s = (R*Tc/Pc) * Zc^[1 + (1 - Tr)^(2/7)])
  rackettZ: number;
}

export const PURE_COMPONENTS_DB: Record<string, PureComponentData> = {
  h2: {
    id: 'h2',
    name: 'Hydrogen',
    formula: 'H2',
    casNumber: '1333-74-0',
    mw: 2.01588,
    tcK: 33.19,
    pcBar: 13.13,
    omega: -0.216,
    zc: 0.303,
    vcM3Kmol: 0.0641,
    tbK: 20.28,
    cpCoeffs: [27.14, 0.00927, -1.38e-5, 7.64e-9],
    antoine: [3.543, 99.3, 7.7],
    rackettZ: 0.303,
  },
  c1: {
    id: 'c1',
    name: 'Methane',
    formula: 'CH4',
    casNumber: '74-82-8',
    mw: 16.0425,
    tcK: 190.56,
    pcBar: 45.99,
    omega: 0.011,
    zc: 0.286,
    vcM3Kmol: 0.0986,
    tbK: 111.66,
    cpCoeffs: [19.25, 0.05213, 1.197e-5, -1.132e-8],
    antoine: [3.989, 443.0, -0.49],
    rackettZ: 0.288,
  },
  c2: {
    id: 'c2',
    name: 'Ethane',
    formula: 'C2H6',
    casNumber: '74-84-0',
    mw: 30.07,
    tcK: 305.32,
    pcBar: 48.72,
    omega: 0.099,
    zc: 0.279,
    vcM3Kmol: 0.1455,
    tbK: 184.55,
    cpCoeffs: [5.409, 0.1781, -6.938e-5, 8.713e-9],
    antoine: [4.043, 663.7, -15.15],
    rackettZ: 0.281,
  },
  c3: {
    id: 'c3',
    name: 'Propane',
    formula: 'C3H8',
    casNumber: '74-98-6',
    mw: 44.0956,
    tcK: 369.83,
    pcBar: 42.48,
    omega: 0.152,
    zc: 0.276,
    vcM3Kmol: 0.200,
    tbK: 231.02,
    cpCoeffs: [-4.224, 0.3063, -1.586e-4, 3.215e-8],
    antoine: [4.011, 803.8, -26.15],
    rackettZ: 0.276,
  },
  ic4: {
    id: 'ic4',
    name: 'Isobutane',
    formula: 'i-C4H10',
    casNumber: '75-28-5',
    mw: 58.1222,
    tcK: 407.85,
    pcBar: 36.40,
    omega: 0.181,
    zc: 0.282,
    vcM3Kmol: 0.2627,
    tbK: 261.42,
    cpCoeffs: [-1.39, 0.3847, -1.846e-4, 3.495e-8],
    antoine: [4.002, 931.4, -33.6],
    rackettZ: 0.275,
  },
  nc4: {
    id: 'nc4',
    name: 'n-Butane',
    formula: 'n-C4H10',
    casNumber: '106-97-8',
    mw: 58.1222,
    tcK: 425.12,
    pcBar: 37.96,
    omega: 0.200,
    zc: 0.274,
    vcM3Kmol: 0.255,
    tbK: 272.65,
    cpCoeffs: [9.487, 0.3313, -1.108e-4, 2.822e-9],
    antoine: [4.053, 945.9, -32.8],
    rackettZ: 0.273,
  },
  c6h6: {
    id: 'c6h6',
    name: 'Benzene',
    formula: 'C6H6',
    casNumber: '71-43-2',
    mw: 78.1118,
    tcK: 562.05,
    pcBar: 48.95,
    omega: 0.210,
    zc: 0.271,
    vcM3Kmol: 0.256,
    tbK: 353.24,
    cpCoeffs: [-33.92, 0.4719, -2.983e-4, 7.081e-8],
    antoine: [4.018, 1203.8, -53.2],
    rackettZ: 0.269,
  },
  c7h14: {
    id: 'c7h14',
    name: 'Methylcyclohexane',
    formula: 'C7H14',
    casNumber: '108-87-2',
    mw: 98.1861,
    tcK: 572.2,
    pcBar: 34.71,
    omega: 0.235,
    zc: 0.269,
    vcM3Kmol: 0.368,
    tbK: 374.05,
    cpCoeffs: [-42.15, 0.612, -3.85e-4, 9.42e-8],
    antoine: [4.052, 1312.0, -51.8],
    rackettZ: 0.267,
  },
  c7h8: {
    id: 'c7h8',
    name: 'Toluene',
    formula: 'C7H8',
    casNumber: '108-88-3',
    mw: 92.14,
    tcK: 591.75,
    pcBar: 41.08,
    omega: 0.263,
    zc: 0.264,
    vcM3Kmol: 0.316,
    tbK: 383.75,
    cpCoeffs: [-24.35, 0.512, -2.765e-4, 4.91e-8],
    antoine: [4.078, 1343.9, -53.7],
    rackettZ: 0.264,
  },
  h2o: {
    id: 'h2o',
    name: 'Water',
    formula: 'H2O',
    casNumber: '7732-18-5',
    mw: 18.01528,
    tcK: 647.10,
    pcBar: 220.64,
    omega: 0.344,
    zc: 0.229,
    vcM3Kmol: 0.0559,
    tbK: 373.15,
    cpCoeffs: [32.24, 0.00192, 1.055e-5, -3.596e-9],
    antoine: [5.115, 1687.5, -42.98],
    rackettZ: 0.235,
  },
};

// Binary Interaction Parameters (k_ij) for Peng-Robinson EOS
export const BINARY_INTERACTION_MATRIX: Record<string, Record<string, number>> = {
  h2: {
    c1: 0.035,
    c2: 0.040,
    c3: 0.045,
    nc4: 0.050,
    c6h6: 0.082,
    c7h14: 0.090,
    c7h8: 0.085,
    h2o: 0.150,
  },
  c1: {
    c2: 0.002,
    c3: 0.008,
    nc4: 0.013,
    c6h6: 0.040,
    c7h14: 0.045,
    c7h8: 0.042,
    h2o: 0.490,
  },
  c3: {
    nc4: 0.001,
    c6h6: 0.015,
    c7h14: 0.018,
    c7h8: 0.016,
    h2o: 0.520,
  },
};

export function getBinaryInteraction(id1: string, id2: string): number {
  if (id1 === id2) return 0.0;
  if (BINARY_INTERACTION_MATRIX[id1] && BINARY_INTERACTION_MATRIX[id1][id2] !== undefined) {
    return BINARY_INTERACTION_MATRIX[id1][id2];
  }
  if (BINARY_INTERACTION_MATRIX[id2] && BINARY_INTERACTION_MATRIX[id2][id1] !== undefined) {
    return BINARY_INTERACTION_MATRIX[id2][id1];
  }
  return 0.0;
}
