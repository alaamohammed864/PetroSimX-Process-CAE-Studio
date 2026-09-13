import { UnitType } from './simulation';

export type UtilityType =
  | 'cooling_water'
  | 'chilled_water'
  | 'lp_steam'
  | 'mp_steam'
  | 'hp_steam'
  | 'fuel_gas'
  | 'electricity'
  | 'hot_oil';

export type UtilityCategory = 'cooling' | 'heating' | 'power' | 'fuel';

export interface UtilityDefinition {
  id: string;
  name: string;
  type: UtilityType;
  category: UtilityCategory;
  description: string;
  supplyTempC: number;
  returnTempC: number;
  pressureBar: number;
  // Specific enthalpy change (kJ/kg) or Cp (kJ/kg-K) or fuel LHV (MJ/kg)
  enthalpyOrCpValue: number;
  enthalpyOrCpUnit: string;
  unitCost: number; // e.g. $/ton, $/MWh, $/MMBtu, $/GJ
  costUnit: string;
  // Computed consumption
  consumptionRate: number;
  consumptionUnit: string;
  costPerHour: number;
  // Emission Factors per unit of utility consumed
  emissionFactors: {
    co2KgPerUnit: number;
    coKgPerUnit: number;
    noxKgPerUnit: number;
    soxKgPerUnit: number;
  };
  isUserDefinedFactor: boolean;
  emissionFactorNotes: string;
}

export interface EnergyBalanceSummary {
  heatingDutyMW: number;
  coolingDutyMW: number;
  electricalPowerMW: number;
  pumpPowerMW: number;
  compressorPowerMW: number;
  furnaceDutyMW: number;
  reboilerDutyMW: number;
  condenserDutyMW: number;
  totalPrimaryEnergyMW: number;
  netThermalDutyMW: number;
  hourlyEnergyCost: number;
  annualEnergyCost: number; // based on 8000 operating hours/year
  feedThroughputKgH: number;
  productThroughputKgH: number;
  energyIntensityGjPerTonProduct: number;
  energyIntensityKwhPerBblProduct: number;
}

export interface EquipmentEnergyItem {
  unitId: string;
  unitName: string;
  unitTag: string;
  unitType: UnitType;
  category: 'heating' | 'cooling' | 'power';
  dutyKW: number;
  dutyMW: number;
  assignedUtilityId: string;
  assignedUtilityName: string;
  utilityRate: number;
  utilityRateUnit: string;
  costPerHour: number;
  co2EmissionsKgH: number;
  percentageOfCategoryTotal: number;
  percentageOfPlantTotal: number;
}

export interface HeatLossAnalysis {
  ambientTempC: number;
  insulationCondition: 'Good' | 'Average' | 'Degraded';
  furnaceFiredDutyMW: number;
  furnaceUsefulHeatMW: number;
  furnaceStackLossMW: number;
  furnaceRadiantLossMW: number;
  furnaceThermalEfficiencyPct: number;
  equipmentSurfaceConvectionRadiationMW: number;
  pipingConvectionRadiationLossMW: number;
  totalHeatLossMW: number;
  lossPercentageOfPrimaryEnergy: number;
  potentialInsulationRecoveryMW: number;
  annualCostOfLossesUSD: number;
}

export interface EmissionFactorSpec {
  id: string;
  name: string;
  utilityType: UtilityType;
  co2: number;
  co: number;
  nox: number;
  sox: number;
  unit: string;
  isUserDefined: boolean;
  sourceReference: string;
}

export interface EmissionsSummary {
  co2RateKgH: number;
  coRateKgH: number;
  noxRateKgH: number;
  soxRateKgH: number;
  co2TonPerDay: number;
  co2TonPerYear: number;
  scope1Co2KgH: number; // Direct combustion on site (furnaces, fuel gas)
  scope2Co2KgH: number; // Indirect from purchased electricity
  specificCo2IntensityKgPerTonProduct: number;
  totalAnnualCarbonTaxUSD: number; // assuming e.g. $50/ton CO2 equivalent
  emissionFactors: Record<string, EmissionFactorSpec>;
}

export interface PinchStream {
  id: string;
  name: string;
  type: 'hot' | 'cold';
  sourceUnitId: string;
  tinC: number;
  toutC: number;
  dutyMW: number;
  mCpMWK: number; // duty / |Tin - Tout|
}

export interface CompositeCurvePoint {
  h: number; // Cumulative Enthalpy in MW
  t: number; // Temperature in °C
}

export interface PinchAnalysisResult {
  deltaTmin: number;
  pinchTempC: number;
  hotPinchTempC: number;
  coldPinchTempC: number;
  qhMinMW: number; // Minimum hot utility requirement
  qcMinMW: number; // Minimum cold utility requirement
  maxEnergyRecoveryMW: number; // MER
  currentHotUtilityMW: number;
  currentColdUtilityMW: number;
  potentialHeatingSavingsMW: number;
  potentialCoolingSavingsMW: number;
  potentialAnnualCostSavingsUSD: number;
  hotCompositeCurve: CompositeCurvePoint[];
  coldCompositeCurve: CompositeCurvePoint[];
  streams: PinchStream[];
  opportunities: HeatIntegrationOpportunity[];
  engineeringWarnings: string[];
}

export interface HeatIntegrationOpportunity {
  id: string;
  title: string;
  type: 'heating' | 'cooling' | 'cross_pinch' | 'exchanger_match' | 'integration';
  description: string;
  potentialSavingMW: number;
  estimatedAnnualSavingsUSD: number;
  priority: 'High' | 'Medium' | 'Low';
  hotStreamName?: string;
  coldStreamName?: string;
}
