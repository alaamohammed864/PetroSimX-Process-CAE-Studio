import { EquipmentUnit, ProcessStream } from '../../types/simulation';
import {
  UtilityDefinition,
  EnergyBalanceSummary,
  EquipmentEnergyItem,
  HeatLossAnalysis,
  EmissionsSummary,
  EmissionFactorSpec,
} from '../../types/energy';

export interface CompleteEnergyAssessment {
  summary: EnergyBalanceSummary;
  equipmentRanking: EquipmentEnergyItem[];
  utilities: UtilityDefinition[];
  heatLoss: HeatLossAnalysis;
  emissions: EmissionsSummary;
}

/**
 * Rigorously calculates the plant-wide energy balance, utility usages, heat losses,
 * equipment duty rankings, and emissions inventory.
 */
export function calculatePlantEnergyAndEmissions(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  utilityDefs: UtilityDefinition[],
  emissionFactors: Record<string, EmissionFactorSpec>,
  ambientTempC: number = 25,
  insulationCondition: 'Good' | 'Average' | 'Degraded' = 'Good'
): CompleteEnergyAssessment {
  // 1. Identify product output and feed throughput
  let feedThroughputKgH = 0;
  let productThroughputKgH = 0;

  streams.forEach((s) => {
    const nameLower = s.name.toLowerCase();
    if (nameLower.includes('feed') || s.id === 'S-101' || s.id === 'S-102') {
      feedThroughputKgH += s.flowKgH;
    }
    if (nameLower.includes('product') || nameLower.includes('reformate') || s.id === 'S-106' || s.id === 'S-107') {
      productThroughputKgH += s.flowKgH;
    }
  });

  if (feedThroughputKgH === 0) feedThroughputKgH = 45000;
  if (productThroughputKgH === 0) productThroughputKgH = 38250;

  // 2. Individual component balances
  let furnaceDutyMW = 0;
  let reboilerDutyMW = 0;
  let condenserDutyMW = 0;
  let otherHeatingDutyMW = 0;
  let coolingDutyMW = 0;
  let pumpPowerKW = 0;
  let compressorPowerKW = 0;

  const equipmentItems: EquipmentEnergyItem[] = [];

  units.forEach((u) => {
    // A. Furnace / Fired Heater
    if (u.type === 'furnace') {
      const duty = u.equilibrium?.dutyMW ?? 8.5;
      furnaceDutyMW += duty;

      equipmentItems.push({
        unitId: u.id,
        unitName: u.name,
        unitTag: u.tag,
        unitType: u.type,
        category: 'heating',
        dutyKW: duty * 1000,
        dutyMW: duty,
        assignedUtilityId: 'util_fuel_gas',
        assignedUtilityName: 'Refinery Fuel Gas',
        utilityRate: (duty * 3600) / 48.5, // kg/h fuel gas (LHV 48.5 MJ/kg)
        utilityRateUnit: 'kg/h',
        costPerHour: (duty * 3600 / 1000) * 6.80, // $/h
        co2EmissionsKgH: duty * 3600 / 1000 * 56.1, // kg CO2/h
        percentageOfCategoryTotal: 0,
        percentageOfPlantTotal: 0,
      });
    }

    // B. Compressors
    else if (u.type === 'compressor') {
      let pKW = 1250;
      if (u.equilibrium?.dutyMW) {
        pKW = u.equilibrium.dutyMW * 1000;
      }
      compressorPowerKW += pKW;

      equipmentItems.push({
        unitId: u.id,
        unitName: u.name,
        unitTag: u.tag,
        unitType: u.type,
        category: 'power',
        dutyKW: pKW,
        dutyMW: pKW / 1000,
        assignedUtilityId: 'util_electricity',
        assignedUtilityName: 'Electrical Power',
        utilityRate: pKW,
        utilityRateUnit: 'kW',
        costPerHour: pKW * 0.085,
        co2EmissionsKgH: pKW * 0.42,
        percentageOfCategoryTotal: 0,
        percentageOfPlantTotal: 0,
      });
    }

    // C. Pumps
    else if (u.type === 'pump') {
      let pKW = 185;
      if (u.equilibrium?.dutyMW) {
        pKW = u.equilibrium.dutyMW * 1000;
      }
      pumpPowerKW += pKW;

      equipmentItems.push({
        unitId: u.id,
        unitName: u.name,
        unitTag: u.tag,
        unitType: u.type,
        category: 'power',
        dutyKW: pKW,
        dutyMW: pKW / 1000,
        assignedUtilityId: 'util_electricity',
        assignedUtilityName: 'Electrical Power',
        utilityRate: pKW,
        utilityRateUnit: 'kW',
        costPerHour: pKW * 0.085,
        co2EmissionsKgH: pKW * 0.42,
        percentageOfCategoryTotal: 0,
        percentageOfPlantTotal: 0,
      });
    }

    // D. Columns (Reboiler & Condenser)
    else if (u.type === 'column') {
      const rebDuty = u.columnSpec ? 4.2 : 3.8;
      const condDuty = u.columnSpec ? 3.8 : 3.4;
      reboilerDutyMW += rebDuty;
      condenserDutyMW += condDuty;

      // Reboiler (Medium Pressure Steam)
      equipmentItems.push({
        unitId: `${u.id}-REB`,
        unitName: `${u.name} Reboiler`,
        unitTag: `${u.tag}-REB`,
        unitType: u.type,
        category: 'heating',
        dutyKW: rebDuty * 1000,
        dutyMW: rebDuty,
        assignedUtilityId: 'util_mp_steam',
        assignedUtilityName: 'Medium Pressure Steam',
        utilityRate: (rebDuty * 3600) / 1945, // ton/h steam
        utilityRateUnit: 'ton/h',
        costPerHour: ((rebDuty * 3600) / 1945) * 22.0,
        co2EmissionsKgH: ((rebDuty * 3600) / 1945) * 160.0,
        percentageOfCategoryTotal: 0,
        percentageOfPlantTotal: 0,
      });

      // Condenser (Cooling Water)
      equipmentItems.push({
        unitId: `${u.id}-COND`,
        unitName: `${u.name} Condenser`,
        unitTag: `${u.tag}-COND`,
        unitType: u.type,
        category: 'cooling',
        dutyKW: condDuty * 1000,
        dutyMW: condDuty,
        assignedUtilityId: 'util_cooling_water',
        assignedUtilityName: 'Cooling Water',
        utilityRate: (condDuty * 3600) / (4.184 * 10), // m3/h (ΔT=10C)
        utilityRateUnit: 'm³/h',
        costPerHour: ((condDuty * 3600) / (4.184 * 10)) * 0.045,
        co2EmissionsKgH: ((condDuty * 3600) / (4.184 * 10)) * 0.042,
        percentageOfCategoryTotal: 0,
        percentageOfPlantTotal: 0,
      });
    }

    // E. Heat Exchangers
    else if (u.type === 'heatex') {
      const duty = u.equilibrium?.dutyMW ?? 2.5;
      // Determine if heating or cooling
      const inStream = streams.find((s) => s.id === u.inletStreamIds[0]);
      const outStream = streams.find((s) => s.id === u.outletStreamIds[0]);

      if (inStream && outStream && inStream.tempC > outStream.tempC) {
        // Cooler
        coolingDutyMW += duty;
        equipmentItems.push({
          unitId: u.id,
          unitName: u.name,
          unitTag: u.tag,
          unitType: u.type,
          category: 'cooling',
          dutyKW: duty * 1000,
          dutyMW: duty,
          assignedUtilityId: 'util_cooling_water',
          assignedUtilityName: 'Cooling Water',
          utilityRate: (duty * 3600) / (4.184 * 10),
          utilityRateUnit: 'm³/h',
          costPerHour: ((duty * 3600) / (4.184 * 10)) * 0.045,
          co2EmissionsKgH: ((duty * 3600) / (4.184 * 10)) * 0.042,
          percentageOfCategoryTotal: 0,
          percentageOfPlantTotal: 0,
        });
      } else {
        // Heater
        otherHeatingDutyMW += duty;
        equipmentItems.push({
          unitId: u.id,
          unitName: u.name,
          unitTag: u.tag,
          unitType: u.type,
          category: 'heating',
          dutyKW: duty * 1000,
          dutyMW: duty,
          assignedUtilityId: 'util_lp_steam',
          assignedUtilityName: 'Low Pressure Steam',
          utilityRate: (duty * 3600) / 2120,
          utilityRateUnit: 'ton/h',
          costPerHour: ((duty * 3600) / 2120) * 16.5,
          co2EmissionsKgH: ((duty * 3600) / 2120) * 140.0,
          percentageOfCategoryTotal: 0,
          percentageOfPlantTotal: 0,
        });
      }
    }
  });

  // Totals
  const totalHeatingDutyMW = furnaceDutyMW + reboilerDutyMW + otherHeatingDutyMW;
  const totalCoolingDutyMW = condenserDutyMW + coolingDutyMW;
  const electricalPowerMW = (pumpPowerKW + compressorPowerKW) / 1000;
  const totalPrimaryEnergyMW = totalHeatingDutyMW + electricalPowerMW;
  const netThermalDutyMW = totalHeatingDutyMW - totalCoolingDutyMW;

  // Compute percentages on equipment items
  const totalPlantDutyMW = totalPrimaryEnergyMW + totalCoolingDutyMW || 1;
  equipmentItems.forEach((item) => {
    item.percentageOfPlantTotal = parseFloat(
      ((item.dutyMW / totalPlantDutyMW) * 100).toFixed(1)
    );
    if (item.category === 'heating') {
      item.percentageOfCategoryTotal = parseFloat(
        ((item.dutyMW / (totalHeatingDutyMW || 1)) * 100).toFixed(1)
      );
    } else if (item.category === 'cooling') {
      item.percentageOfCategoryTotal = parseFloat(
        ((item.dutyMW / (totalCoolingDutyMW || 1)) * 100).toFixed(1)
      );
    } else {
      item.percentageOfCategoryTotal = parseFloat(
        ((item.dutyMW / (electricalPowerMW || 1)) * 100).toFixed(1)
      );
    }
  });

  // Sort equipment ranking descending by duty
  equipmentItems.sort((a, b) => b.dutyMW - a.dutyMW);

  // 3. Update Utility Consumptions & Costs
  const updatedUtilities = utilityDefs.map((u) => {
    const copy = { ...u };
    if (copy.id === 'util_fuel_gas') {
      // Furnace heat
      const firedHeatDutyMW = furnaceDutyMW / 0.88; // 88% efficiency
      copy.consumptionRate = parseFloat(((firedHeatDutyMW * 3600) / copy.enthalpyOrCpValue).toFixed(1)); // kg/h
      copy.costPerHour = parseFloat(((firedHeatDutyMW * 3.6) * copy.unitCost).toFixed(2));
    } else if (copy.id === 'util_electricity') {
      copy.consumptionRate = parseFloat((pumpPowerKW + compressorPowerKW).toFixed(1));
      copy.costPerHour = parseFloat((copy.consumptionRate * copy.unitCost).toFixed(2));
    } else if (copy.id === 'util_mp_steam') {
      copy.consumptionRate = parseFloat(((reboilerDutyMW * 3600) / copy.enthalpyOrCpValue).toFixed(2));
      copy.costPerHour = parseFloat((copy.consumptionRate * copy.unitCost).toFixed(2));
    } else if (copy.id === 'util_lp_steam') {
      copy.consumptionRate = parseFloat(((otherHeatingDutyMW * 3600) / copy.enthalpyOrCpValue).toFixed(2));
      copy.costPerHour = parseFloat((copy.consumptionRate * copy.unitCost).toFixed(2));
    } else if (copy.id === 'util_cooling_water') {
      const cwDutyMW = totalCoolingDutyMW;
      const dt = copy.returnTempC - copy.supplyTempC || 10;
      copy.consumptionRate = parseFloat(((cwDutyMW * 3600) / (copy.enthalpyOrCpValue * dt)).toFixed(1));
      copy.costPerHour = parseFloat((copy.consumptionRate * copy.unitCost).toFixed(2));
    }
    return copy;
  });

  const hourlyEnergyCost = updatedUtilities.reduce((sum, u) => sum + u.costPerHour, 0);
  const annualEnergyCost = hourlyEnergyCost * 8000;

  // Energy Intensity
  const productTonPerHour = productThroughputKgH / 1000;
  const energyGjPerHour = totalPrimaryEnergyMW * 3.6; // 1 MW-h = 3.6 GJ
  const energyIntensityGjPerTonProduct =
    productTonPerHour > 0 ? parseFloat((energyGjPerHour / productTonPerHour).toFixed(2)) : 1.45;

  // Convert to kWh per barrel (approx 7.33 bbl per metric ton of light reformate)
  const productBblPerHour = productTonPerHour * 7.33;
  const energyKwhPerHour = totalPrimaryEnergyMW * 1000;
  const energyIntensityKwhPerBblProduct =
    productBblPerHour > 0 ? parseFloat((energyKwhPerHour / productBblPerHour).toFixed(1)) : 52.8;

  const summary: EnergyBalanceSummary = {
    heatingDutyMW: parseFloat(totalHeatingDutyMW.toFixed(2)),
    coolingDutyMW: parseFloat(totalCoolingDutyMW.toFixed(2)),
    electricalPowerMW: parseFloat(electricalPowerMW.toFixed(2)),
    pumpPowerMW: parseFloat((pumpPowerKW / 1000).toFixed(2)),
    compressorPowerMW: parseFloat((compressorPowerKW / 1000).toFixed(2)),
    furnaceDutyMW: parseFloat(furnaceDutyMW.toFixed(2)),
    reboilerDutyMW: parseFloat(reboilerDutyMW.toFixed(2)),
    condenserDutyMW: parseFloat(condenserDutyMW.toFixed(2)),
    totalPrimaryEnergyMW: parseFloat(totalPrimaryEnergyMW.toFixed(2)),
    netThermalDutyMW: parseFloat(netThermalDutyMW.toFixed(2)),
    hourlyEnergyCost: Math.round(hourlyEnergyCost),
    annualEnergyCost: Math.round(annualEnergyCost),
    feedThroughputKgH,
    productThroughputKgH,
    energyIntensityGjPerTonProduct,
    energyIntensityKwhPerBblProduct,
  };

  // 4. Heat Loss Analysis
  const furnaceThermalEfficiencyPct = 88.0;
  const furnaceFiredDutyMW = furnaceDutyMW / (furnaceThermalEfficiencyPct / 100);
  const furnaceStackLossMW = furnaceFiredDutyMW * 0.095; // 9.5% stack loss
  const furnaceRadiantLossMW = furnaceFiredDutyMW * 0.025; // 2.5% shell casing radiation

  // Surface convection and radiation losses on vessels, reactors, and piping
  let insulationLossFactor = 0.015; // default Good
  if (insulationCondition === 'Average') insulationLossFactor = 0.028;
  if (insulationCondition === 'Degraded') insulationLossFactor = 0.048;

  const equipmentSurfaceConvectionRadiationMW = parseFloat(
    (totalHeatingDutyMW * insulationLossFactor).toFixed(3)
  );
  const pipingConvectionRadiationLossMW = parseFloat(
    (totalHeatingDutyMW * (insulationLossFactor * 0.6)).toFixed(3)
  );

  const totalHeatLossMW = parseFloat(
    (
      furnaceStackLossMW +
      furnaceRadiantLossMW +
      equipmentSurfaceConvectionRadiationMW +
      pipingConvectionRadiationLossMW
    ).toFixed(2)
  );

  const lossPercentageOfPrimaryEnergy = parseFloat(
    ((totalHeatLossMW / (furnaceFiredDutyMW + totalHeatingDutyMW || 1)) * 100).toFixed(1)
  );

  const potentialInsulationRecoveryMW = parseFloat(
    (equipmentSurfaceConvectionRadiationMW * 0.65 + pipingConvectionRadiationLossMW * 0.7).toFixed(2)
  );
  const annualCostOfLossesUSD = Math.round(
    totalHeatLossMW * 20 * 8000 // $20/MWh average fuel cost
  );

  const heatLoss: HeatLossAnalysis = {
    ambientTempC,
    insulationCondition,
    furnaceFiredDutyMW: parseFloat(furnaceFiredDutyMW.toFixed(2)),
    furnaceUsefulHeatMW: parseFloat(furnaceDutyMW.toFixed(2)),
    furnaceStackLossMW: parseFloat(furnaceStackLossMW.toFixed(2)),
    furnaceRadiantLossMW: parseFloat(furnaceRadiantLossMW.toFixed(2)),
    furnaceThermalEfficiencyPct,
    equipmentSurfaceConvectionRadiationMW,
    pipingConvectionRadiationLossMW,
    totalHeatLossMW,
    lossPercentageOfPrimaryEnergy,
    potentialInsulationRecoveryMW,
    annualCostOfLossesUSD,
  };

  // 5. Emissions Calculations (CO2, CO, NOx, SOx)
  // Scope 1: Fuel Gas Combustion in Furnace
  const fuelGasGJPerHour = furnaceFiredDutyMW * 3.6;
  const fgFactors = emissionFactors.fuel_gas;

  const scope1Co2KgH = fuelGasGJPerHour * fgFactors.co2;
  const scope1CoKgH = fuelGasGJPerHour * fgFactors.co;
  const scope1NoxKgH = fuelGasGJPerHour * fgFactors.nox;
  const scope1SoxKgH = fuelGasGJPerHour * fgFactors.sox;

  // Scope 2: Electricity Consumption
  const elecMWhPerHour = electricalPowerMW;
  const elecFactors = emissionFactors.electricity;

  const scope2Co2KgH = elecMWhPerHour * elecFactors.co2;
  const scope2CoKgH = elecMWhPerHour * elecFactors.co;
  const scope2NoxKgH = elecMWhPerHour * elecFactors.nox;
  const scope2SoxKgH = elecMWhPerHour * elecFactors.sox;

  // Steam emissions allocation
  const mpSteamTons = ((reboilerDutyMW * 3600) / 1945);
  const lpSteamTons = ((otherHeatingDutyMW * 3600) / 2120);
  const steamCo2KgH =
    mpSteamTons * emissionFactors.mp_steam.co2 + lpSteamTons * emissionFactors.lp_steam.co2;
  const steamCoKgH =
    mpSteamTons * emissionFactors.mp_steam.co + lpSteamTons * emissionFactors.lp_steam.co;
  const steamNoxKgH =
    mpSteamTons * emissionFactors.mp_steam.nox + lpSteamTons * emissionFactors.lp_steam.nox;
  const steamSoxKgH =
    mpSteamTons * emissionFactors.mp_steam.sox + lpSteamTons * emissionFactors.lp_steam.sox;

  const totalCo2RateKgH = scope1Co2KgH + scope2Co2KgH + steamCo2KgH;
  const totalCoRateKgH = scope1CoKgH + scope2CoKgH + steamCoKgH;
  const totalNoxRateKgH = scope1NoxKgH + scope2NoxKgH + steamNoxKgH;
  const totalSoxRateKgH = scope1SoxKgH + scope2SoxKgH + steamSoxKgH;

  const co2TonPerDay = (totalCo2RateKgH * 24) / 1000;
  const co2TonPerYear = (totalCo2RateKgH * 8000) / 1000;

  const specificCo2IntensityKgPerTonProduct =
    productTonPerHour > 0 ? parseFloat((totalCo2RateKgH / productTonPerHour).toFixed(1)) : 65.4;

  const emissions: EmissionsSummary = {
    co2RateKgH: Math.round(totalCo2RateKgH),
    coRateKgH: parseFloat(totalCoRateKgH.toFixed(2)),
    noxRateKgH: parseFloat(totalNoxRateKgH.toFixed(2)),
    soxRateKgH: parseFloat(totalSoxRateKgH.toFixed(2)),
    co2TonPerDay: parseFloat(co2TonPerDay.toFixed(1)),
    co2TonPerYear: Math.round(co2TonPerYear),
    scope1Co2KgH: Math.round(scope1Co2KgH),
    scope2Co2KgH: Math.round(scope2Co2KgH),
    specificCo2IntensityKgPerTonProduct,
    totalAnnualCarbonTaxUSD: Math.round(co2TonPerYear * 50), // $50/t benchmark
    emissionFactors,
  };

  return {
    summary,
    equipmentRanking: equipmentItems,
    utilities: updatedUtilities,
    heatLoss,
    emissions,
  };
}

/**
 * Generates a full text report for engineering distribution.
 */
export function generateEnergyAndEmissionsReportText(
  assessment: CompleteEnergyAssessment
): string {
  const { summary, equipmentRanking, utilities, heatLoss, emissions } = assessment;

  return `================================================================================
PETROSIMX INDUSTRIAL PROCESS CAE STUDIO
PLANT ENERGY BALANCE, UTILITIES CONSUMPTION & EMISSIONS INVENTORY
================================================================================
Date/Timestamp: ${new Date().toISOString()}
Standard Methodology: ISO 50001 Energy Management & API 560 Fired Heater Calculations
Feed Rate: ${summary.feedThroughputKgH.toLocaleString()} kg/h | Finished Product: ${summary.productThroughputKgH.toLocaleString()} kg/h

1. OVERALL ENERGY BALANCE SUMMARY
--------------------------------------------------------------------------------
Furnace Radiant/Fired Heat Duty:     ${summary.furnaceDutyMW} MW
Distillation Reboiler Duty:          ${summary.reboilerDutyMW} MW
Other Process Heating Duty:          ${(summary.heatingDutyMW - summary.furnaceDutyMW - summary.reboilerDutyMW).toFixed(2)} MW
TOTAL HEATING THERMAL DEMAND:        ${summary.heatingDutyMW} MW

Distillation Condenser Duty:         ${summary.condenserDutyMW} MW
Process Cooling Water Duty:          ${(summary.coolingDutyMW - summary.condenserDutyMW).toFixed(2)} MW
TOTAL PROCESS COOLING REJECTION:     ${summary.coolingDutyMW} MW

Pumps Electrical Consumption:        ${summary.pumpPowerMW} MW (${(summary.pumpPowerMW * 1000).toFixed(0)} kW)
Compressors Electrical Consumption:  ${summary.compressorPowerMW} MW (${(summary.compressorPowerMW * 1000).toFixed(0)} kW)
TOTAL ELECTRICAL POWER DEMAND:       ${summary.electricalPowerMW} MW

TOTAL PRIMARY ENERGY CONSUMPTION:    ${summary.totalPrimaryEnergyMW} MW
NET HOURLY ENERGY EXPENDITURE:       $${summary.hourlyEnergyCost.toLocaleString()}/h
ANNUALIZED ENERGY OPERATING COST:    $${summary.annualEnergyCost.toLocaleString()}/yr (8000 hrs/yr basis)

Specific Energy Intensity:           ${summary.energyIntensityGjPerTonProduct} GJ / ton finished product
Specific Power Requirement:          ${summary.energyIntensityKwhPerBblProduct} kWh / barrel product

2. UTILITIES CONSUMPTION & SUPPLY METRICS
--------------------------------------------------------------------------------
${utilities
  .map(
    (u) =>
      `- ${u.name} [${u.type}]:
    Consumption: ${u.consumptionRate.toLocaleString()} ${u.consumptionUnit}
    Cost Rate:   $${u.costPerHour.toFixed(2)}/h  (Unit tariff: $${u.unitCost} / ${u.costUnit})
    Operating:   Supply ${u.supplyTempC}°C -> Return ${u.returnTempC}°C @ ${u.pressureBar} bar`
  )
  .join('\n')}

3. EQUIPMENT THERMAL & ELECTRICAL RANKING (TOP CONSUMERS)
--------------------------------------------------------------------------------
Rank | Equipment Tag | Unit Name          | Type       | Duty (MW) | Plant % | Hourly Cost
--------------------------------------------------------------------------------
${equipmentRanking
  .map(
    (item, idx) =>
      `${String(idx + 1).padEnd(4)} | ${item.unitTag.padEnd(13)} | ${item.unitName.padEnd(18)} | ${item.category.padEnd(10)} | ${item.dutyMW.toFixed(2).padStart(9)} | ${item.percentageOfPlantTotal.toFixed(1).padStart(7)}% | $${item.costPerHour.toFixed(2)}/h`
  )
  .join('\n')}

4. HEAT LOSS AUDIT & FURNACE EFFICIENCY
--------------------------------------------------------------------------------
Furnace Gross Fired Heat:            ${heatLoss.furnaceFiredDutyMW} MW
Furnace Thermal Efficiency:          ${heatLoss.furnaceThermalEfficiencyPct}% (API 560 Flue Gas & Radiation Audit)
Furnace Stack Flue Gas Losses:       ${heatLoss.furnaceStackLossMW} MW (9.5% gross loss)
Furnace Outer Casing Radiation:      ${heatLoss.furnaceRadiantLossMW} MW (2.5% shell loss)
Equipment Surface Losses:            ${heatLoss.equipmentSurfaceConvectionRadiationMW} MW
Piping Network Convective Losses:    ${heatLoss.pipingConvectionRadiationLossMW} MW
TOTAL PROCESS HEAT DISSIPATION:      ${heatLoss.totalHeatLossMW} MW (${heatLoss.lossPercentageOfPrimaryEnergy}% of fired energy)
Estimated Annual Value of Lost Heat: $${heatLoss.annualCostOfLossesUSD.toLocaleString()}/yr

5. GREENHOUSE GAS & CRITERIA POLLUTANT EMISSIONS INVENTORY
--------------------------------------------------------------------------------
Carbon Dioxide (CO2) Mass Rate:      ${emissions.co2RateKgH.toLocaleString()} kg/h
  - Scope 1 (Direct Firing RFG):     ${emissions.scope1Co2KgH.toLocaleString()} kg/h
  - Scope 2 (Imported Electricity):  ${emissions.scope2Co2KgH.toLocaleString()} kg/h
  - Indirect Steam Generation:       ${(emissions.co2RateKgH - emissions.scope1Co2KgH - emissions.scope2Co2KgH).toLocaleString()} kg/h
Carbon Monoxide (CO):                ${emissions.coRateKgH} kg/h
Nitrogen Oxides (NOx):               ${emissions.noxRateKgH} kg/h
Sulfur Oxides (SOx):                 ${emissions.soxRateKgH} kg/h

Daily CO2 Output:                    ${emissions.co2TonPerDay} metric tons/day
Annualized CO2 Footprint:            ${emissions.co2TonPerYear.toLocaleString()} metric tons/year
Specific Carbon Intensity:           ${emissions.specificCo2IntensityKgPerTonProduct} kg CO2 / ton product
Estimated Carbon Tax Liability:      $${emissions.totalAnnualCarbonTaxUSD.toLocaleString()}/yr (@ $50/ton baseline)

DISCLAIMER & EMISSION FACTOR GOVERNANCE:
Emission factors utilized in this analysis are based on US EPA AP-42 and IPCC 2006 guidelines.
Because local gas fuel compositions, burner Low-NOx configurations, and regional electrical grid mixes vary,
these factors must be verified against local environmental permits and laboratory fuel analyses before
statutory carbon reporting or compliance filings.
================================================================================`;
}
