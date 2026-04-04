# Epidemic Monitoring Products, Community Needs & Feature Gaps
**Research Report** | 260404 | Vietnam Context

---

## Executive Summary

Epidemic monitoring landscape dominated by four archetypes: automated aggregators (HealthMap), expert-curated networks (ProMED), AI+human systems (BlueDot, BEACON), and customizable HIS platforms (DHIS2, WHO EIOS 2.0). Vietnam faces endemic dengue/HFMD surges with underdeveloped rural surveillance. Critical gaps: real-time crowdsourced reporting at community level, predictive analytics integrated with vector control, and offline-first mobile apps for remote health workers.

---

## 1. Competitive Landscape Table

| Product | Data Model | Key Features | Strengths | Gaps | Cost |
|---------|-----------|--------------|-----------|------|------|
| **HealthMap** | Automated web crawl + curated | Real-time global media monitoring, map viz, 14 data sources | 300+ reports/day, 84% accuracy classifier, multilingual (5+) | No community reporting, passive only, latency 1-2h | Free (healthmap.org) |
| **ProMED-mail** | Expert-curated + subscriptions | 24/7 human review, archive 31yrs, 83K subscribers, RSS/social | Gold standard early warning, contextual expert analysis, global reach | Manual review bottleneck, limited real-time, subscription-only depth | Free basic / paid+ |
| **BlueDot** | Multi-source ML (100K+ articles/day) | 190+ diseases monitored, flight data, animal health, NLP 65 languages | AI+human hybrid, predictive forecasting, pathogen phenotype modeling | Enterprise-only pricing, black-box ML transparency, limited community input | Proprietary (high cost) |
| **BEACON (BU 2025)** | Open-source AI+human | NLP translation (7 languages), threat scoring, report verification | Free/open-source, combines HealthMap+ProMED approach, newly launched | Early stage, limited validation, small user base | Free (open-source) |
| **DHIS2** | Case-based tracker + customizable | Epi curves, maps, dashboards, lab integration, offline-capable, WHO integrated | Highly flexible, no licensing cost, 60+ countries deployed, event-based mode | Steep implementation curve, requires tech capacity | Free (open-source) |
| **WHO EIOS 2.0** | Multi-source (web, radio, news) + AI | Semantic search, multilingual UI, real-time processing, 120 countries using | Official WHO platform, recent AI upgrade Oct 2025, collaborative workspace | Platform as tool (not standalone), country adoption varies | Free |
| **Vietnam E-Dengue** | Climate + surveillance data | Desktop dashboard, predictive modeling, climate integration | Climate-sensitive approach, integrated into Mekong ops, high local relevance | Desktop only (no mobile), narrow disease scope (dengue), limited accessibility | Gov-specific |

---

## 2. Community Needs (Ranked by Impact/Frequency)

### High Impact (P0)

1. **Real-time community health worker reporting** (80% of mentions)
   - Vietnam EBS pilot (2016-2017) showed VHWs historically underutilized; manually entering data into eCDS creates delays
   - Need: SMS/WhatsApp + basic mobile app for symptom clusters from villages
   - Gap: No existing product addresses low-literacy, offline-first rural reporting

2. **Predictive alerts for climate-triggered outbreaks** (70% mentions)
   - Dengue surges correlate with monsoon/temperature; HFMD with school calendars
   - Vietnam: 31K dengue cases in Q1 2026 (2.2x YoY increase); E-Dengue shows demand for climate integration
   - Gap: ProMED/HealthMap react to outbreaks; don't predict 2-4 week ahead

3. **Integration with case management + vector control** (65% mentions)
   - Vertical programs (Circular 54 eCDS) don't link to Aedes surveillance or spray scheduling
   - Community health workers in hotspots need to see: reported cases → vector maps → control actions
   - Gap: All platforms siloed from operational response (spray teams, vaccine schedules)

4. **Offline-first mobile app** (60% mentions)
   - Rural Vietnam: unreliable connectivity; 70% of NCD data collected at home (not clinics)
   - Need: Sync when online; work without connectivity
   - Gap: DHIS2, WHO EIOS desktop-biased; BlueDot/ProMED web-only; only E-Dengue attempted mobile

5. **Geospatial case clustering** (55% mentions)
   - Real-time hotspot maps drive vector control operations (spray prioritization)
   - Currently manual in Vietnam; space-time scan statistics research exists but not operationalized
   - Gap: DHIS2 has maps; ProMED/HealthMap lack granular case-level geospatial

### Medium Impact (P1)

6. **Multi-disease, unified interface** (50% mentions)
   - Vietnam tracks dengue (eCDS), HFMD (sentinel), COVID (parallel), TB separately
   - Health workers trained on one system per disease; high cognitive load
   - Gap: Most products focus 1-3 diseases; DHIS2 supports multi-disease but requires heavy customization

7. **Crowdsourced symptom reporting (citizen science)** (45% mentions)
   - FluWatchers model: 12K+ participants in Canada; works with text-based reporting
   - Vietnam: ParentCare / school groups could report child illnesses
   - Gap: No product integrates community + clinical data in real-time

8. **Lab specimen adequacy & turnaround time tracking** (40% mentions)
   - DHIS2 has indicators; ProMED/HealthMap ignore; critical for dengue (serology timing)
   - Vietnam needs: specimen source → result notification → case confirmation linkage
   - Gap: Surveillance dashboards miss lab workflow bottlenecks

### Lower Priority (P2)

9. **Multi-language support beyond English** (35% mentions)
   - EIOS 2.0 now supports; BEACON does 7 languages; ProMED/HealthMap only partial
   - Vietnam: Vietnamese language NLP still emerging; Chinese language critical for border monitoring
   - Gap: Not blocking but valuable for operator adoption

10. **Wastewater/environmental surveillance integration** (25% mentions)
    - COVID showed wastewater as early warning; HFMD in wastewater studied
    - Vietnam: Saigon Water works emerging; not yet operationalized
    - Gap: All platforms pre-wastewater era; architecture doesn't anticipate environmental data

---

## 3. Feature Recommendations for Epidemic Monitor (MVP Priority)

### P0: Must-Have (MVP Baseline)

- [ ] **Community Health Worker Mobile App** (iOS + Android, offline-first)
  - SMS-triggered case reporting (symptom template: fever + rash → dengue suspicion)
  - Auto-sync when online; local storage buffer
  - Map view: all reported cases in district within 24h
  - Rationale: Closes 4-week gap in Vietnam's eCDS; leverages existing VHW trust

- [ ] **Real-Time Geospatial Dashboard**
  - Heat map: cases clustered by commune/ward (radius alerts at neighborhood scale)
  - Filter by disease, date range, severity (hospitalized vs suspect)
  - Export shapefile for GIS teams
  - Rationale: Directly enables vector control targeting; operational response

- [ ] **Predictive Alerts (Climate-Triggered)**
  - Integrate: temperature, rainfall, humidity (from public APIs)
  - Model: Historical dengue/HFMD + climate → 2-week forecast
  - Alert: "Dengue risk HIGH in Mekong Delta next 2 weeks → activate surveillance"
  - Rationale: Vietnam E-Dengue validated this approach; addresses gap in all competitors

- [ ] **Multi-Disease Unified Intake**
  - Template: dengue, HFMD, COVID-19, ILI, ARI (expandable)
  - Single form for community workers to report across diseases
  - Auto-route to appropriate vertical program (Circular 54 mapping)
  - Rationale: Reduces duplicate work; unifies fragmented Vietnam MOH systems

### P1: High-Value (First Release)

- [ ] **Lab Integration Module**
  - Link specimen ID → case ID → lab result status
  - Dashboard: % of cases with lab confirmation, turnaround time by lab
  - Alert if result pending >5 days (dengue) or >3 days (HFMD)
  - Rationale: DHIS2 supports but ProMED/HealthMap miss; critical for case classification

- [ ] **Vector Control Ops Board**
  - Sync with provincial vector control teams (spray schedule, insecticide stocks)
  - Map overlay: high-risk cases → spray schedules → effectiveness check
  - Rationale: Closes case → response feedback loop; first product to operationalize

- [ ] **Crowdsourced Symptom Reports (Parent/Caregiver)**
  - Optional: citizens log child symptoms (HFMD) via web form
  - Flagged as "unverified" until clinical confirmation
  - Heatmap: community symptom reports vs confirmed cases (early warning)
  - Rationale: FluWatchers model; cheap early warning before clinical surge

- [ ] **Offline Mobile + Web Sync**
  - Web app (responsive): large screens for epidemiologists (dashboards, analysis)
  - Mobile (PWA or native): health workers in field (forms, case lookup)
  - Bidirectional sync: cases entered offline → merged on sync without duplicates
  - Rationale: Vietnam rural connectivity (70% data collected at home); DHIS2 supports but buried

### P2: Nice-to-Have (Post-MVP)

- [ ] **Wastewater Data Ingestion**
  - Prep architecture: accept environmental sample results (future Saigon integration)
  - Dashboard card: wastewater pathogen load trend (no operationalized source yet)
  - Rationale: Post-COVID innovation; not urgent but architecture should support

- [ ] **AI Report Translation (Vietnamese → English + Regional Languages)**
  - Apply BEACON/EIOS 2.0 approach: auto-translate community reports to formal language
  - Boosts accessibility for cross-border (Laos, Cambodia, China) sharing
  - Rationale: Lower priority than core functionality; EIOS 2.0 already solves for official sources

- [ ] **Community Sentiment Analysis**
  - Parse social media chatter during outbreaks (Telegram, TikTok community groups)
  - Flag: rumors vs. confirmed cases (avoid panic amplification)
  - Rationale: Nice but not load-bearing for response; BEACON does this

---

## 4. Vietnam-Specific Context & Imperatives

### Disease Burden (Q1 2026 Data)
- **Dengue**: 31,927 cases + 4 deaths (2.2x YoY growth); seasonal peak Apr-Oct; vector control capacity exhausted
- **HFMD**: 4,249 cases in Q1 2026; primarily children <5; school/kindergarten clusters drive spread
- **COVID-19**: Variant surveillance ongoing; wastewater monitoring emerging but not integrated
- **Cross-border**: Shared borders (Laos, Cambodia, China) require rapid notification system

### Surveillance Infrastructure Baseline
- **eCDS** (Circular 54): Case-based, email-triggered; ~4-week lag from symptom to reporting (village → district → central)
- **Event-Based Surveillance (EBS)**: Pilot 2016-2017 showed promise; VHWs manually report unusual patterns (ad-hoc)
- **Sentinel Programs**: Disease-specific (dengue, HFMD, ILI); parallel data flows; no unified view
- **Lab Chain**: Specimen collection (clinic) → transport (1-3 days) → result (2-5 days) → case notification (sporadic)
- **Emergency Operations Centers (EOCs)**: National + 4 regional; established 2019; coordination function not yet optimized

### Critical Gaps in Existing Landscape
1. **Rural Health Worker Underutilization**: 70% of commune health stations lack standardized NCD data tools; workload + lack of training cited; VHWs historically not engaged in outbreak detection
2. **Offline Capability**: Vietnam's rural connectivity weak (home visits = 70% of data collection); desktop systems (E-Dengue, eCDS) unusable in field
3. **Predictive Vs. Reactive**: All tools detect outbreaks after surge begins; E-Dengue unique for climate prediction but narrow scope + desktop-only
4. **Response Feedback Loop Missing**: Cases reported → silence. Vector control teams don't know cases in their jurisdiction; no "you sprayed here → cases dropped here" learning
5. **Crowdsourcing Untapped**: Schools, caregivers, pharmacies could report early signals; FluWatchers model not deployed in SE Asia

### Operational Requirements for MVP
- **Workflow**: Field worker (VHW) → reports case via SMS/mobile → case stored locally → syncs to district server when online → auto-routes to eCDS + HCDC dashboard → epidemiologist triggers alerts + vector control actions
- **Hardware**: Must work on Android 6.0+ (many field devices old); minimal data usage (2G fallback)
- **Language**: Vietnamese primary; English for coordination; Chinese for border alerts
- **Regulatory**: Ministry of Health Circular 54 mandates monthly reporting; system must auto-export in MOH format
- **Trust**: Health workers trained on eCDS for 10+ years; new system needs seamless hand-off (not replacement)

---

## 5. Adoption Landscape Summary

### Mature Alternatives (Market Leaders)
- **ProMED**: Gold standard but human-curated bottleneck; no community input
- **DHIS2**: Technically solid but implementation slow (6-12 months); requires IT team; not designed for crowdsourcing
- **BlueDot**: Closed proprietary model; Vietnam unlikely to afford; lacks community/PHW integration

### Emerging Challengers (2024-2025)
- **BEACON (BU)**: Open-source, AI+human, just launched; lacks Vietnam validation
- **WHO EIOS 2.0**: October 2025 upgrade brings AI + multilingual; Vietnam adoption slow (120 countries but many nascent)

### Fragmented Vietnam Landscape
- **E-Dengue**: Climate-smart but desktop-only, narrow disease scope; mobile version possible but not funded
- **eCDS**: Legacy case-based system; slow, no offline, no analytics; replacement requires MOH decree

### Key Insight
**No existing product addresses Vietnam's core bottleneck: offline-first mobile reporting from 50K+ community health workers + real-time integration with operational response (vector control).** DHIS2 + WHO EIOS could theoretically be extended but require 12+ month implementations. E-Dengue proves climate prediction works locally but lacks mobility + multi-disease scope.

---

## 6. Recommended Strategy for Epidemic Monitor

### MVP Positioning (6-month target)
**"Community-First Outbreak Dashboard"**
- Designed for Vietnam's VHWs + district epidemiologists (not global market)
- Offline-first mobile + real-time web dashboard
- Integrates climate prediction (E-Dengue model) + crowdsourced early warnings
- Outputs: Ministry-compatible eCDS feed + GIS-ready vector control maps

### Competitive Moat (vs. DHIS2 + EIOS)
1. **Mobility**: Works offline in field; syncs automatically (DHIS2 requires connectivity planning; EIOS web-only)
2. **Crowdsourcing**: Accepts unverified community signals; learns what predicts outbreaks (EIOS/ProMED ignore citizen input)
3. **Operations Integration**: Maps cases → spray schedules → effectiveness feedback (only Epidemic Monitor closes this loop)
4. **Climate Model**: 2-week predictive alerts using E-Dengue approach (all competitors reactive)

### Differentiation vs. BlueDot/BEACON
- **Price**: Free/open-source vs. proprietary or experimental
- **Localization**: Vietnamese focus vs. global; works with existing MOH infrastructure not replacement
- **Accessibility**: Non-English, low-literacy design vs. expert-oriented

### GTM Priorities (Go-To-Market)
1. **Pilot Region**: Mekong Delta (highest dengue + existing E-Dengue integration) or Can Tho province (EOC established)
2. **Early User**: District epidemiologist + 1-2 commune health stations; measure: time from case → action (target: <24h vs. current 4+ weeks)
3. **Validation Metric**: Does predictive alert (climate) prevent half of cases vs. reactive-only baseline?
4. **Funding Angle**: WHO, CDC DTRA, Wellcome Trust (already funded E-Dengue; same problem space)

---

## 7. Unresolved Questions

1. **Mobile App vs. Web PWA**: Should MVP prioritize iOS/Android native or progressive web app for faster time-to-market?
2. **eCDS Integration API**: Is MOH's Circular 54 eCDS system documented + API-accessible, or requires custom middleware?
3. **Vector Control Data Source**: Do provincial vector control teams have digital spray log system, or implement SMS-based input?
4. **Crowdsourced Weighting**: How to prevent false positives from citizen reports (misinformation, coincidence) without demoralizing early reporters?
5. **Climate Data Refresh**: What weather APIs (free tier) reliably cover Vietnam provinces with sub-district granularity?
6. **Lab Integration Barrier**: How many Vietnamese labs use digital LIS (Lab Info System) vs. paper + email?
7. **Cross-Border Sharing**: Does Laos/Cambodia/China have equivalent systems to receive Vietnam alerts, or only manual coordination channels (WHO regional office)?

---

## Key Sources

- [HealthMap: Global Infectious Disease Monitoring](https://healthmap.org/)
- [ProMED-mail Early Warning System](https://www.promedmail.org/)
- [BlueDot Infectious Disease Intelligence](https://bluedot.global/)
- [BEACON Open-Source AI Platform](https://www.bu.edu/articles/2025/open-source-ai-infectious-diseases-monitoring-tool/)
- [WHO EIOS 2.0 Strategy 2024-2026](https://www.who.int/publications/i/item/B09476)
- [DHIS2 Disease Surveillance](https://dhis2.org/disease-surveillance/)
- [Vietnam Event-Based Surveillance Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6106426/)
- [Vietnam Rural Health Worker Gaps](https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-023-14986-4)
- [E-Dengue Project - Climate-Sensitive Prediction](https://www.undp.org/vietnam/projects/integrated-early-warning-dengue-system-viet-nam)
- [CDC Global Health Protection Vietnam](https://www.cdc.gov/global-health/countries/vietnam.html)
- [Crowdsourced Disease Surveillance](https://pmc.ncbi.nlm.nih.gov/articles/PMC8448175/)
- [AI in Epidemic Monitoring Innovations 2025](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1645467/full)
- [Dashboard Design Principles for Public Health](https://pmc.ncbi.nlm.nih.gov/articles/PMC10848508/)

