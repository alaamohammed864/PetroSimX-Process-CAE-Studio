# PETROSIMX — Process Simulation & Reactor Engineering Suite
## Technical Engineering Reference & Architecture Manual

---

### 1. Executive Summary & Engineering Scope

**PETROSIMX** is a high-fidelity, browser-native Process Simulation & Catalytic Reactor Engineering Suite developed for Process Engineers, Chemical Engineers, Refinery Engineers, Energy & Sustainability Consultants, Process Design Engineers, and University Chemical Engineering students.

The suite integrates rigorous thermodynamic equations of state (EOS), multi-phase vapor-liquid equilibria (VLE), multi-bed catalytic reactor modeling with axial 1D differential equation integration (RK4), separation column hydraulic rating, pinch analysis energy optimization, Scope 1/2 greenhouse gas emission accounting, and offline persistence via browser IndexedDB.

---

### 2. End-to-End Simulation Workflow

PETROSIMX supports the complete process engineering design and operations lifecycle:

```
Create Project
  ↓
Select Components & Hydrocarbon Fractions
  ↓
Select Thermodynamic Package (PR, SRK, Boston-Mathias)
  ↓
Create & Characterize Material Streams
  ↓
Build Flowsheet (P&ID schematic, CAD snapping, stream routing)
  ↓
Configure Equipment Specifications (Pumps, Exchangers, Furnaces, Separators)
  ↓
Configure Chemical Reactions (Kinetic parameters, activation energy, equilibrium)
  ↓
Configure Reactor Geometry & Catalyst Bed (Bed length, void fraction, catalyst density)
  ↓
Validate Model Topology & Degrees of Freedom
  ↓
Run Simulation (Steady-State or WebWorker background solver)
  ↓
Check Convergence (Tear stream residuals, Wegstein acceleration logs)
  ↓
Analyze Results (Heat & Material Balance stream matrix, phase envelopes)
  ↓
Run Sensitivity Studies (Parametric sweep curves: T, P, LHSV, H2/Oil ratio)
  ↓
Optimize Process (Multi-variable Nelder-Mead simplex / SQP objective functions)
  ↓
Analyze Energy (Composite curves, Pinch point, minimum heating/cooling utilities)
  ↓
Analyze Emissions (CO2 equivalent Scope 1 direct, Scope 2 indirect, flaring)
  ↓
Generate Formal Engineering Report (Executive summary, stream tables, equipment datasheets)
  ↓
Save & Export Project (JSON session archive, CSV data matrix, print/PDF report)
```

---

### 3. Thermodynamic Engine & Physical Properties

#### 3.1 Equations of State (EOS)
The core thermodynamic engine implements cubic equations of state with Boston-Mathias high-temperature alpha modifications suitable for refining and petrochemical systems:

- **Peng-Robinson (PR 1978):**
  $$P = \frac{RT}{v - b} - \frac{a(T)}{v(v + b) + b(v - b)}$$
  $$a(T) = 0.45724 \frac{R^2 T_c^2}{P_c} \alpha(T_r, \omega)$$
  $$b = 0.07780 \frac{R T_c}{P_c}$$

- **Soave-Redlich-Kwong (SRK):**
  $$P = \frac{RT}{v - b} - \frac{a(T)}{v(v + b)}$$

- **Boston-Mathias Formulation:**
  Extends alpha function above supercritical temperatures ($T_r > 1.0$) to avoid non-physical density inversions in high-temperature hydrogen processing.

#### 3.2 Vapor-Liquid Equilibria (VLE)
- **Rachford-Rice Solver:**
  $$\sum_i \frac{z_i (K_i - 1)}{1 + \psi (K_i - 1)} = 0$$
  Solved via bounded Newton-Raphson iteration with bisection fallback when derivative singularities occur near bubble or dew points.
- **Enthalpy Departures:** Lee-Kesler generalized enthalpy departure correlations with ideal gas heat capacity integration:
  $$H(T, P) = H^{id}(T) + (H - H^{id})_{departure}^{EOS}$$
- **Liquid Densities:** Modified Rackett equation for compressed liquid mixtures.

---

### 4. Catalytic Reactor Engineering & Numerical Integration

#### 4.1 Reactor Classification & Geometry
- Multitubular and adiabatic fixed-bed reactors (e.g., diesel/naphtha hydrotreaters, steam methane reformers, catalytic crackers).
- Packed catalyst bed geometry: Tube diameter, tube count, axial length, catalyst particle diameter ($d_p$), bed voidage ($\varepsilon_b$), catalyst bulk density ($\rho_{bulk}$).

#### 4.2 Axial Differential Conservation Equations (1D PFR)
The axial profile is integrated along the coordinate $z \in [0, L]$ using a 4th-order Runge-Kutta (RK4) algorithm with adaptive axial discretization:

1. **Species Material Balance:**
   $$\frac{d F_i}{d z} = A_{cross} \cdot \rho_{bulk} \cdot \sum_j \nu_{i,j} \cdot r_j \cdot \eta_j$$
   where $\eta_j$ is the internal catalyst effectiveness factor derived from the Thiele modulus $\phi$:
   $$\eta = \frac{3}{\phi} \left( \frac{1}{\tanh \phi} - \frac{1}{\phi} \right), \quad \phi = \frac{d_p}{6} \sqrt{\frac{k \rho_p}{D_{eff}}}$$

2. **Energy Conservation:**
   $$\frac{d T}{d z} = \frac{A_{cross} \left( \rho_{bulk} \sum_j (-\Delta H_{rxn, j}) r_j \eta_j - \frac{4 U}{D_{tube}} (T - T_{coolant}) \right)}{\sum_i F_i C_{p,i}}$$

3. **Axial Pressure Drop (Ergun Equation):**
   $$-\frac{d P}{d z} = 150 \frac{(1 - \varepsilon_b)^2}{\varepsilon_b^3} \frac{\mu v_s}{d_p^2} + 1.75 \frac{1 - \varepsilon_b}{\varepsilon_b^3} \frac{\rho_g v_s^2}{d_p}$$

4. **Catalyst Deactivation & Coking Kinetics:**
   Exponential deactivation rate dependent on local polyaromatic coke deposition:
   $$\frac{d a_{cat}}{d t} = -k_d \cdot C_{heavy} \cdot a_{cat}^m$$

---

### 5. Separation Column Hydraulics & Rating

- **Shortcut Fenske-Underwood-Gilliland:**
  - Minimum stages $N_{min}$ via Fenske equation.
  - Minimum reflux ratio $R_{min}$ via Underwood roots.
  - Actual stages $N_{act}$ and feed stage placement via Gilliland and Kirkbride correlations.
- **Rigorous Tray Hydraulics:**
  - Downcomer backup and liquid height over weir (Francis weir formula).
  - Tray weeping limit and jet flooding velocity via Fair's correlation:
    $$u_f = C_{sb} \left( \frac{\sigma}{20} \right)^{0.2} \sqrt{\frac{\rho_L - \rho_V}{\rho_V}}$$
- **Packed Bed Rating:**
  - Generalized Pressure Drop Correlation (GPDC) for random (Pall rings, Raschig) and structured packings (Mellapak).

---

### 6. Flowsheet Recycle Tearing & Numerical Convergence

- **Tear Stream Identification:** Directed graph cycle detection finding minimal tear streams.
- **Recycle Solvers:**
  - *Direct Substitution:* Successive substitution with damping factor $\theta \in (0, 1]$.
  - *Wegstein Acceleration:* Dynamic extrapolation parameter $q = \frac{s}{s - 1}$ with bounded limits $[-5, 0]$ to prevent oscillatory divergence.
  - *Quasi-Newton Broyden Method:* Low-rank Jacobian update for tightly coupled chemical loops.
- **Convergence Criteria:**
  - Temperature tolerance: $|\Delta T| < 10^{-4}\text{ K}$
  - Pressure tolerance: $|\Delta P| < 10^{-3}\text{ bar}$
  - Enthalpy closure: $|\Delta H| / H_{total} < 10^{-5}$
  - Component mole fraction RMS: $\sqrt{\frac{1}{N_c} \sum (x_{i}^{(k)} - x_{i}^{(k-1)})^2} < 10^{-6}$

---

### 7. Process Optimization & Sensitivity Engine

- **Nelder-Mead Downhill Simplex Algorithm:** Multi-variable derivative-free optimizer for objective functions combining product margin, catalyst utility, and fuel gas consumption.
- **Constraints Handling:** Exterior penalty functions for hydraulic limits (flooding < 85%, reactor peak temperature < metallurgical limit, compressor head constraints).
- **Parametric Sensitivity Sweeps:** Fast parametric sweeps across multi-core systems exploring temperature vs. yield, pressure vs. conversion, and hydrogen-to-oil ratio vs. catalyst cycle life.

---

### 8. Pinch Analysis & Energy Integration

- **Composite Curves:** Extraction of thermal streams into Hot Composite Curve (HCC) and Cold Composite Curve (CCC).
- **Pinch Temperature:** Identification of minimum temperature approach $\Delta T_{min}$ separating the flowsheet into heat donor (above pinch) and heat acceptor (below pinch) zones.
- **Minimum Utility Targets:** Exact calculation of $Q_{H,min}$ (external fuel gas/steam required) and $Q_{C,min}$ (cooling water/air required) to prevent non-pinch cross-heat transfers.

---

### 9. Environmental Emissions & Decarbonization

- **Scope 1 (Direct Combustion):** Fuel gas burned in fired heaters $H-101$, calculated via stoichiometric flue gas composition ($CO_2, H_2O, SO_x, NO_x$) based on fuel lower heating value (LHV).
- **Scope 2 (Indirect Electrical):** Electrical energy consumed by pump $P-101$, compressor $K-101$, and air cooler fans, multiplied by grid emission factors ($kg CO_2e / kWh$).
- **Carbon Tax Analysis:** Financial impact evaluation across international carbon border adjustment mechanisms (CBAM) and emission trading systems (ETS).

---

### 10. Software Architecture & Offline Resilience

- **Language & Runtime:** TypeScript, React 18, Vite.
- **PWA Capabilities:** Service Worker registration (`sw.js`), full asset caching, offline manifest (`manifest.webmanifest`), and installability.
- **Local Database (IndexedDB):** Zero cloud lock-in. Full flowsheet schemas, cases, stream tables, and convergence snapshots saved locally in IndexedDB (`petrosimx_db_v1`).
- **Crash Recovery:** Dynamic session snapshotting every 30 seconds with automatic recovery prompt upon unexpected browser exit.
- **Security Posture:** Zero hardcoded API keys or external secrets; client-side self-contained simulation runtime.
- **Internationalization (i18n):** Bilingual English / Arabic with native Right-to-Left (RTL) styling and engineering terminology alignment.
- **Theme Support:** Dark CAD mode and high-contrast Light Engineering mode.

---

### 11. Known Engineering Assumptions & Boundaries

1. **Phase Homogeneity:** Fixed-bed reactor kinetic model assumes pseudo-homogeneous fluid phase or empirical two-phase trickle-bed holdup correlations.
2. **Radial Gradients:** 1D axial model assumes negligible radial temperature and concentration gradients ($D_{tube} / d_p > 8$).
3. **Ideal Gas Cp:** Component heat capacities use DIPPR/NIST polynomial coefficients valid up to $1500\text{ K}$.
4. **Hydraulic Rating:** Flash drum sizing uses Souders-Brown vapor velocity equation with standard wire mesh de-entrainment factors ($K = 0.107\text{ m/s}$).

---
*PETROSIMX — Developed for rigorous, accessible chemical process simulation.*
