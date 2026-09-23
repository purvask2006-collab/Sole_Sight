
### Decision Logic

- Compute **LCR = Loss : Cost**
- If **LCR > 3:1** → Trigger cleaning
- If **LCR ≤ 3:1** → Wait & monitor; check rain/wind forecast before action

---

## 🏗️ System Architecture

**SOLESIGHT AI — Intelligent Solar Panel Soiling Detection & Autonomous Cleaning Management**

### 1. Perception Layer — Data Ingestion

- **Edge AI Camera:** Computer vision estimates soiling ratio (SR) on 1 panel per 100
- **Sentinel-2 Satellite API:** Free 10m imagery tracks regional dust deposition
- **Weather Station / IoT Sensors:** Wind, humidity, rainfall, temperature, dust index
- **Inverter / SCADA Data:** Real-time power output, voltage, string-level performance

### 2. Decision Layer — AI & Digital Twin Engine

- **Soiling Estimation Module:** Fuses camera + satellite + sensor data to calculate soiling % per block
- **Digital Twin Simulator:** Simulates clean-now vs. wait scenarios; calculates Loss-to-Cost Ratio (LCR)
- **Prescriptive Scheduler:** Applies weather forecasts, grid tariffs, water availability for optimal schedule
- **Decision:** `LCR > 3:1?` → Yes: Trigger Cleaning (Crew / Robot / Inverter) → No: Wait → Monitor

### 3. Action Layer — Execution & Feedback

- **Option A: Crew Dispatch** — Optimized route, priority blocks
- **Option B: Autonomous Robot** — Waterless cleaning on high-value soiling strings
- **Option C: Inverter Reallocation** — Temporary load shift to cleaner strings

### 4. Feedback Loop & Continuous Learning

- Post-Cleaning Performance Data (SR, power, weather, cleaning log)
- Model Retraining (improved accuracy & LCR prediction)
- Improved Detection Accuracy (higher ROI & energy yield)

### Cloud & Analytics Platform

- **Cloud Database (Time-Series):** Images, sensor data, power data, weather
- **Dashboard & Visualization:** Real-time monitoring & analytics
- **Alert & Notification Service:** Soiling alerts, cleaning status, maintenance reminders

---

## ✨ Key Features

- **AI-Powered**
- **Predictive**
- **Cost-Saving**
- **Higher Yield**
- **Scalable**
- **Water-Efficient**

---

## 📈 Impacts and Benefits

### Technical Edge

- Fingerprint AI learns each site’s baseline
- Works with affordable sensors/cameras
- Functions in low-connectivity rural farms

### Business Edge

- Cleaning becomes a financial decision
- Prevents revenue leakage from delayed cleaning
- Reduces water and labor costs

### Scale Edge

- Retrofittable to existing installations
- Works rooftop to utility-scale
- No sensor needed on every single panel

---

## 🧰 Tech Stack / Components

- **Hardware:** Raspberry Pi 3, Raspberry Pi Camera Module 12 MP, Ethernet, Cloud storage
- **Edge AI:** Computer vision for soiling estimation
- **Satellite Data:** Sentinel-2 API
- **IoT / Weather:** Weather station, IoT sensors
- **Plant Data:** Inverter / SCADA
- **Decision Engine:** AI + Digital Twin + LCR calculator
- **Dashboard:** Web-based visualization (Vercel deployment)
- **Cloud:** Time-series database, alerts, analytics

---

## 🚀 Prototype & Links

- **Live Prototype:** [https://sole-sight.vercel.app/](https://sole-sight.vercel.app/)
- **Dashboard:** [https://sole-sight.vercel.app/](https://sole-sight.vercel.app/)
- **GitHub Repository:** [https://github.com/purvask2006-collab/Sole_Sight.git](https://github.com/purvask2006-collab/Sole_Sight.git)

---

## 🖥️ Dashboard Snapshot

> Add dashboard screenshot here: `assets/dashboard.png`

**Dashboard Link:** [https://sole-sight.vercel.app/](https://sole-sight.vercel.app/)

---

## 📚 References

1. **SoilingEdge: PV Soiling Power Loss Estimation at the Edge Using Surveillance Cameras**, IEEE Trans. Sustainable Energy, 2023.  
   DOI: [10.1109/TSTE.2023.3320690](https://doi.org/10.1109/TSTE.2023.3320690)  
   *Proves standard edge cameras can estimate soiling loss in real time without expensive per-panel sensors. Justifies our low-cost, scalable visual detection layer for MW-scale plants.*

2. **Techno-Economic Assessment of Soiling Losses and Mitigation Strategies for Solar Power Generation**, Joule, 2019.  
   DOI: [10.1016/j.joule.2019.08.019](https://doi.org/10.1016/j.joule.2019.08.019)  
   *Reframes soiling as an economic optimization problem, not just a maintenance task. Provides foundation for our Loss-to-Cost Ratio (LCR) trigger.*

3. **Optimize photovoltaic panels cleaning scheduling framework based on variations of hourly-based active electricity pricing in the market**, Solar Energy, 2024.  
   DOI: [10.1016/j.solener.2024.112633](https://doi.org/10.1016/j.solener.2024.112633)  
   *Demonstrates cleaning must align with peak electricity prices to maximize revenue recovery. Validates our weather-fusion + grid-price API approach.*

---

## 👥 Team: GARUN

- Purva Khanapurkar
- Bhumika Tiwari
- Arya Salunkhe
- Sai Patil

---

## 📦 Getting Started

Clone the repository:

```bash
git clone https://github.com/purvask2006-collab/Sole_Sight.git
cd Sole_Sight
