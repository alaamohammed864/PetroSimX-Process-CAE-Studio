import { UtilityDefinition, EmissionFactorSpec } from '../types/energy';

export const DEFAULT_EMISSION_FACTORS: Record<string, EmissionFactorSpec> = {
  fuel_gas: {
    id: 'fuel_gas',
    name: 'Refinery Fuel Gas Combustion',
    utilityType: 'fuel_gas',
    co2: 56.1, // kg CO2 / GJ (approx 2.75 kg CO2 / kg fuel gas at 49.5 MJ/kg)
    co: 0.084, // kg CO / GJ
    nox: 0.048, // kg NOx / GJ (Low-NOx burner benchmark)
    sox: 0.015, // kg SOx / GJ (treated refinery fuel gas < 50 ppm H2S)
    unit: 'kg / GJ',
    isUserDefined: false,
    sourceReference: 'US EPA AP-42 & IPCC 2006 Stationary Combustion Guidelines',
  },
  electricity: {
    id: 'electricity',
    name: 'Imported Electrical Power (Regional Grid)',
    utilityType: 'electricity',
    co2: 420.0, // kg CO2 / MWh (Grid mix default benchmark)
    co: 0.12,   // kg CO / MWh
    nox: 0.35,  // kg NOx / MWh
    sox: 0.28,  // kg SOx / MWh
    unit: 'kg / MWh',
    isUserDefined: false,
    sourceReference: 'IEA Global Grid Average 2024 (Scope 2 Benchmark)',
  },
  hp_steam: {
    id: 'hp_steam',
    name: 'High-Pressure Steam Boiler (40 bar)',
    utilityType: 'hp_steam',
    co2: 175.0, // kg CO2 / metric ton steam
    co: 0.25,   // kg CO / ton steam
    nox: 0.14,  // kg NOx / ton steam
    sox: 0.04,  // kg SOx / ton steam
    unit: 'kg / ton',
    isUserDefined: false,
    sourceReference: 'Boiler efficiency 84% on natural gas (EU ETS Benchmark)',
  },
  mp_steam: {
    id: 'mp_steam',
    name: 'Medium-Pressure Steam Boiler (15 bar)',
    utilityType: 'mp_steam',
    co2: 160.0, // kg CO2 / metric ton steam
    co: 0.22,   // kg CO / ton steam
    nox: 0.12,  // kg NOx / ton steam
    sox: 0.03,  // kg SOx / ton steam
    unit: 'kg / ton',
    isUserDefined: false,
    sourceReference: 'Industrial Cogeneration / Extraction Steam Benchmark',
  },
  lp_steam: {
    id: 'lp_steam',
    name: 'Low-Pressure Steam Boiler (3.5 bar)',
    utilityType: 'lp_steam',
    co2: 140.0, // kg CO2 / metric ton steam
    co: 0.18,   // kg CO / ton steam
    nox: 0.10,  // kg NOx / ton steam
    sox: 0.02,  // kg SOx / ton steam
    unit: 'kg / ton',
    isUserDefined: false,
    sourceReference: 'Low-pressure process heat boiler benchmark',
  },
  cooling_water: {
    id: 'cooling_water',
    name: 'Cooling Tower Auxiliary Power',
    utilityType: 'cooling_water',
    co2: 0.042, // kg CO2 / m³ pumped & evaporated
    co: 0.0001,
    nox: 0.0002,
    sox: 0.0001,
    unit: 'kg / m³',
    isUserDefined: false,
    sourceReference: 'Cooling tower fans & circulating pump electricity allocation',
  },
  chilled_water: {
    id: 'chilled_water',
    name: 'Mechanical Chiller Refrigeration',
    utilityType: 'chilled_water',
    co2: 1.85, // kg CO2 / ton-hour refrigeration
    co: 0.002,
    nox: 0.004,
    sox: 0.003,
    unit: 'kg / ton-hr',
    isUserDefined: false,
    sourceReference: 'Centrifugal Chiller COP 5.2 electric drive benchmark',
  },
  hot_oil: {
    id: 'hot_oil',
    name: 'Thermal Fluid Fired Heater (Hot Oil)',
    utilityType: 'hot_oil',
    co2: 58.4, // kg CO2 / GJ delivered
    co: 0.09,
    nox: 0.052,
    sox: 0.018,
    unit: 'kg / GJ',
    isUserDefined: false,
    sourceReference: 'Therminol 66 closed-loop fired heater benchmark',
  },
};

export const INITIAL_UTILITIES: UtilityDefinition[] = [
  {
    id: 'util_cooling_water',
    name: 'Cooling Water (CW)',
    type: 'cooling_water',
    category: 'cooling',
    description: 'Recirculating cooling tower water. Temperature range 25°C - 35°C, 4.0 bar.',
    supplyTempC: 25,
    returnTempC: 35,
    pressureBar: 4.0,
    enthalpyOrCpValue: 4.184, // kJ/kg-K
    enthalpyOrCpUnit: 'kJ/kg-K',
    unitCost: 0.045, // $/m³
    costUnit: '$/m³',
    consumptionRate: 0,
    consumptionUnit: 'm³/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 0.042,
      coKgPerUnit: 0.0001,
      noxKgPerUnit: 0.0002,
      soxKgPerUnit: 0.0001,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Standard cooling tower fan and pump electrical allocation.',
  },
  {
    id: 'util_chilled_water',
    name: 'Chilled Water (CHW)',
    type: 'chilled_water',
    category: 'cooling',
    description: 'Centrifugal refrigeration chiller circuit. Supply 7°C, return 12°C.',
    supplyTempC: 7,
    returnTempC: 12,
    pressureBar: 3.5,
    enthalpyOrCpValue: 4.19, // kJ/kg-K
    enthalpyOrCpUnit: 'kJ/kg-K',
    unitCost: 0.22, // $/m³
    costUnit: '$/m³',
    consumptionRate: 0,
    consumptionUnit: 'm³/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 0.18,
      coKgPerUnit: 0.0003,
      noxKgPerUnit: 0.0007,
      soxKgPerUnit: 0.0005,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'COP 5.0 chiller driven by industrial grid electricity.',
  },
  {
    id: 'util_hp_steam',
    name: 'High Pressure Steam (HPS)',
    type: 'hp_steam',
    category: 'heating',
    description: 'Saturated steam at 40 bar(g), 253°C. For turbine drives and high-temp reboilers.',
    supplyTempC: 253,
    returnTempC: 160,
    pressureBar: 40.0,
    enthalpyOrCpValue: 1715, // kJ/kg latent heat of vaporization
    enthalpyOrCpUnit: 'kJ/kg',
    unitCost: 28.5, // $/ton
    costUnit: '$/ton',
    consumptionRate: 0,
    consumptionUnit: 'ton/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 175.0,
      coKgPerUnit: 0.25,
      noxKgPerUnit: 0.14,
      soxKgPerUnit: 0.04,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Standard utility boiler (84% efficiency on fuel gas).',
  },
  {
    id: 'util_mp_steam',
    name: 'Medium Pressure Steam (MPS)',
    type: 'mp_steam',
    category: 'heating',
    description: 'Saturated steam at 15 bar(g), 201°C. Standard process heating & distillation reboilers.',
    supplyTempC: 201,
    returnTempC: 130,
    pressureBar: 15.0,
    enthalpyOrCpValue: 1945, // kJ/kg latent heat
    enthalpyOrCpUnit: 'kJ/kg',
    unitCost: 22.0, // $/ton
    costUnit: '$/ton',
    consumptionRate: 0,
    consumptionUnit: 'ton/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 160.0,
      coKgPerUnit: 0.22,
      noxKgPerUnit: 0.12,
      soxKgPerUnit: 0.03,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Cogeneration extraction header benchmark.',
  },
  {
    id: 'util_lp_steam',
    name: 'Low Pressure Steam (LPS)',
    type: 'lp_steam',
    category: 'heating',
    description: 'Saturated steam at 3.5 bar(g), 148°C. For preheating, deaerators, and reboilers.',
    supplyTempC: 148,
    returnTempC: 95,
    pressureBar: 3.5,
    enthalpyOrCpValue: 2120, // kJ/kg latent heat
    enthalpyOrCpUnit: 'kJ/kg',
    unitCost: 16.5, // $/ton
    costUnit: '$/ton',
    consumptionRate: 0,
    consumptionUnit: 'ton/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 140.0,
      coKgPerUnit: 0.18,
      noxKgPerUnit: 0.10,
      soxKgPerUnit: 0.02,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Process exhaust steam / deaerator supply benchmark.',
  },
  {
    id: 'util_fuel_gas',
    name: 'Refinery Fuel Gas (RFG)',
    type: 'fuel_gas',
    category: 'fuel',
    description: 'Methane/Ethane rich fuel gas with LHV = 48.5 MJ/kg. Used in fired heaters & furnaces.',
    supplyTempC: 25,
    returnTempC: 25,
    pressureBar: 5.0,
    enthalpyOrCpValue: 48.5, // MJ/kg Lower Heating Value (LHV)
    enthalpyOrCpUnit: 'MJ/kg',
    unitCost: 6.80, // $/GJ (~$7.17 / MMBtu)
    costUnit: '$/GJ',
    consumptionRate: 0,
    consumptionUnit: 'kg/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 56.1, // kg CO2 / GJ
      coKgPerUnit: 0.084,
      noxKgPerUnit: 0.048,
      soxKgPerUnit: 0.015,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'US EPA AP-42 Table 1.4-1 for natural gas & treated refinery gas.',
  },
  {
    id: 'util_electricity',
    name: 'Electrical Power',
    type: 'electricity',
    category: 'power',
    description: '3-Phase 4160V / 480V Industrial Power for pumps, compressors, and instruments.',
    supplyTempC: 25,
    returnTempC: 25,
    pressureBar: 1.0,
    enthalpyOrCpValue: 3.6, // MJ/kWh
    enthalpyOrCpUnit: 'MJ/kWh',
    unitCost: 0.085, // $/kWh ($85 / MWh)
    costUnit: '$/kWh',
    consumptionRate: 0,
    consumptionUnit: 'kW',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 0.42, // kg CO2 / kWh (420 kg/MWh)
      coKgPerUnit: 0.00012,
      noxKgPerUnit: 0.00035,
      soxKgPerUnit: 0.00028,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Scope 2 Location-Based Grid Average (IEA 2024 Reference).',
  },
  {
    id: 'util_hot_oil',
    name: 'Hot Oil (Thermal Fluid)',
    type: 'hot_oil',
    category: 'heating',
    description: 'Therminol 66 synthetic thermal fluid circuit for high-temp reboilers (up to 320°C).',
    supplyTempC: 290,
    returnTempC: 240,
    pressureBar: 6.0,
    enthalpyOrCpValue: 2.38, // kJ/kg-K
    enthalpyOrCpUnit: 'kJ/kg-K',
    unitCost: 9.20, // $/GJ
    costUnit: '$/GJ',
    consumptionRate: 0,
    consumptionUnit: 'm³/h',
    costPerHour: 0,
    emissionFactors: {
      co2KgPerUnit: 58.4,
      coKgPerUnit: 0.09,
      noxKgPerUnit: 0.052,
      soxKgPerUnit: 0.018,
    },
    isUserDefinedFactor: false,
    emissionFactorNotes: 'Indirect fired heater with 82% thermal efficiency.',
  },
];
