# Multi-Platform Audio Drama Suite: MissEvan & KilaManbo (漫播)

A split-workspace audio drama extraction, subtitle processing, media playback, and translation suite with two dedicated, isolated tabs for **MissEvan (猫耳FM)** and **KilaManbo (漫播 - kilamanbo.world)**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural plan has been revised per your exact feedback:

- **Confirmed Decision 1 (Strictly Separated Dedicated Tabs)**: Rather than merging inputs or using an automatic platform detector, the app is split into two distinct, dedicated platform tabs in the top navigation:
  - **Tab 1: MissEvan (猫耳FM)** — Exclusively handles MissEvan sound IDs, drama links, episode lists, danmaku XML/JSON, and MissEvan cookies.
  - **Tab 2: KilaManbo (漫播)** — Exclusively handles KilaManbo drama URLs (`_specific_parameter` or direct IDs), AES-128 audio stream decryption, danmaku timelines, and KilaManbo `authToken` credentials.
- **Confirmed Decision 2 (Zero State Cross-Contamination)**: Each platform has its own completely independent state machine, active drama, episode selector, and input field. Switching tabs preserves the active session of both platforms without collision or error risk.
- **Confirmed Decision 3 (Unified Feature Parity & Identical UI/UX Theme)**: Both tabs share the identical layout structure, high-density table grid, audio player, high-res cover downloader, and prominent Subtitle Translation Command Center (Vietnamese, English, Spanish) for seamless navigation.

---

## 1. Overview & Core Concept

### What It Does
Provides two dedicated, side-by-side platform extractors within a single cohesive web application:

1. **MissEvan Workspace (Tab 1)**:
   - Dedicated MissEvan URL/ID search bar.
   - Episode series browser, danmaku/official subtitle fetcher, and Bilibili DRM / CDN audio streaming.
   - Subtitle Translation Command Center with Vietnamese, English, and Spanish translation.
   - Multi-format subtitle exports (SRT, LRC, VTT, TXT) and high-res cover gallery.
   - MissEvan VIP token & cookie manager.

2. **KilaManbo Workspace (Tab 2)**:
   - Dedicated KilaManbo URL search bar accepting drama links (`/manbo/pc/detail?_specific_parameter=...`, `?id=...&collectId=...`) and episode IDs.
   - Server-side cryptographic unpacker for `_specific_parameter` via `uxinSecurityUrlCrypto`.
   - Real-time catalog browser showing episode list, voice actor cast (CV), duration, and status.
   - AES-128-CBC audio decryptor (`nxm0v5l8f2rnn98b` / `n8z4eqx05s397glk`) yielding direct playable and downloadable MP4/M4A streams.
   - Full danmaku extraction (`/web_manbo/danmakuList`) converting timeline comments and official lines into standard subtitle items.
   - Full Subtitle Translation Command Center (Vietnamese, English, Spanish) with bilingual display and multi-format exports.
   - High-res KilaManbo poster and episode artwork downloader.
   - KilaManbo VIP credentials manager (`authToken` / Cookie).

---

## 2. User Experience & Visual Design

### Navigation & Top Bar Contract
Adhering to the **Universal Frontend Design Constitution** and **SaaS Dashboard Guidelines**:
- **Zone 1 (Brand)**: `Audio Drama Suite` (with subtle platform indicator).
- **Zone 2 (Tabs & Nav)**:
  - Clean segmented platform selector:
    - `[ 猫耳FM MissEvan ]` (Cyan accent active state)
    - `[ 漫播 KilaManbo ]` (Rose/Coral accent active state)
  - Navigation links: `Cookie / VIP Settings`, `Help & Manual`.
- **Zone 3 (Actions)**:
  - Language toggle (`VI` / `EN`) and active platform status.

### Visual Layout Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Audio Drama Suite]    [🐱 MissEvan]  [📻 KilaManbo 漫播]   [⚙️ VIP]   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│     MissEvan Workspace (Tab 1)    │ │    KilaManbo Workspace (Tab 2)    │
│                                   │ │                                   │
│ · MissEvan URL/ID input           │ │ · KilaManbo Drama URL input       │
│ · MissEvan Drama & Episodes       │ │ · KilaManbo Drama & Episodes      │
│ · MissEvan Danmaku & Subtitles    │ │ · KilaManbo Decrypted Danmaku     │
│ · MissEvan Audio Player           │ │ · KilaManbo Decrypted Audio (AES) │
│ · Subtitle Translation Center     │ │ · Subtitle Translation Center     │
│   (VI 🇻🇳 / EN 🇺🇸 / ES 🇪🇸)         │ │   (VI 🇻🇳 / EN 🇺🇸 / ES 🇪🇸)         │
│ · Export Panel (SRT/LRC/VTT/TXT)  │ │ · Export Panel (SRT/LRC/VTT/TXT)  │
│ · Cover Artwork Gallery           │ │ · Cover Artwork Gallery           │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Two-Tab Separation Instead of Unified Auto-Detection**
  - *Chosen Approach*: Two explicit, independent views (`MissEvanView` and `KilaManboView`) toggled via the primary header tab bar.
  - *Why*: Eliminates ambiguity, prevents regex or URL sniffing mistakes, and keeps each platform's API state and error reporting crystal clear.
- **Decision 2: Isolated State per Workspace**
  - *Chosen Approach*: Keep independent state hooks/stores for MissEvan (`missevanSoundInfo`, `missevanSubtitles`, etc.) and KilaManbo (`manboDramaData`, `manboSubtitles`, etc.).
  - *Why*: Switching between tabs does not wipe or reset in-progress translations or loaded episodes from the other platform.
- **Decision 3: Server-Side Cryptographic Decryption for KilaManbo**
  - *Chosen Approach*:
    1. Parse encrypted `_specific_parameter` using `uxinSecurityUrlCrypto` on the server.
    2. Decrypt AES-128-CBC `audioUrl` on the server before passing the direct stream URL to the audio player and download pipeline.
  - *Why*: Client browsers avoid CORS restrictions, hotlink referrer protections, and heavy cryptographic bundling.

---

## 4. Technical Architecture & Data Strategy

### Technical Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React Application (App.tsx)                   │
│                                                                        │
│  State: activePlatform: 'missevan' | 'kilamanbo'                       │
│                                                                        │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐ │
│  │      <MissEvanWorkspace>      │   │     <KilaManboWorkspace>      │ │
│  │  · MissEvan Input & State     │   │  · KilaManbo Input & State    │ │
│  │  · SoundHeaderBanner          │   │  · ManboDramaHeaderBanner     │ │
│  │  · DramaSeriesSection         │   │  · ManboEpisodeSelector       │ │
│  │  · SubtitleTranslationBanner  │   │  · SubtitleTranslationBanner  │ │
│  │  · SubtitleTable              │   │  · SubtitleTable              │ │
│  │  · ExportPanel                │   │  · ExportPanel                │ │
│  │  · CoverGalleryModal          │   │  · CoverGalleryModal          │ │
│  └──────────────┬────────────────┘   └───────────────┬───────────────┘ │
└─────────────────┼────────────────────────────────────┼─────────────────┘
                  │                                    │
                  │ /api/missevan/*                    │ /api/manbo/*
                  ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend (server.ts)                     │
│                                                                        │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐  │
│  │ MissEvan Handlers           │      │ KilaManbo Handlers          │  │
│  │ · /api/missevan/sound       │      │ · /api/manbo/resolve        │  │
│  │ · /api/missevan/drama       │      │ · /api/manbo/dramaDetail    │  │
│  │ · /api/missevan/danmaku     │      │ · /api/manbo/dramaSetDetail │  │
│  │ · /api/missevan/audio-proxy │      │ · /api/manbo/danmakuList    │  │
│  │ · /api/missevan/cookie      │      │ · /api/manbo/audio-proxy    │  │
│  └─────────────────────────────┘      │ · /api/manbo/cookie         │  │
│                                       └──────────────┬──────────────┘  │
│                                                      │                 │
│                                       ┌──────────────▼──────────────┐  │
│                                       │ KilaManbo Crypto Engine     │  │
│                                       │ · uxin URL decrypt          │  │
│                                       │ · AES-128-CBC audio decrypt │  │
│                                       └─────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Shared Translation Service (Gemini 3.8 Flash + Resilient Fallback│  │
│  │ · POST /api/subtitles/translate (vi / en / es)                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### New & Updated File Manifest
1. `src/types/kilamanbo.ts`: Dedicated KilaManbo interfaces (`KilaManboDramaInfo`, `KilaManboEpisode`, `KilaManboDanmakuItem`).
2. `src/server/kilamanboCrypto.ts`:
   - URL decryptor (handles `_specific_parameter` -> `{ id, collectId }`).
   - AES-128-CBC audio stream decryptor (key: `nxm0v5l8f2rnn98b`, iv: `n8z4eqx05s397glk`).
3. `server.ts` API routes:
   - `/api/manbo/resolve`: Takes any KilaManbo link/parameter and returns drama details & episode list.
   - `/api/manbo/episode`: Returns episode audio stream info (decrypted) and subtitle data.
   - `/api/manbo/danmaku`: Pulls danmaku timeline and normalizes it to subtitle items.
   - `/api/manbo/audio-proxy`: Streams audio bytes with range support and proper file naming.
   - `/api/manbo/cookie`: Reads and saves KilaManbo VIP `authToken`.
4. `src/components/Header.tsx`:
   - Adds clean segmented platform tabs: `[ MissEvan 猫耳FM ]` and `[ KilaManbo 漫播 ]`.
5. `src/components/CookieModal.tsx`:
   - Split tabs for MissEvan VIP (Token/Cookie) and KilaManbo VIP (`authToken`/Cookie).
6. `src/components/KilaManboWorkspace.tsx`:
   - Dedicated workspace component for KilaManbo featuring identical UI patterns (banner, episode picker, audio player, high-visibility translation banner, subtitle table, export panel, cover gallery).
7. `src/i18n/translations.ts`:
   - Full Vietnamese & English translations for all KilaManbo UI terms, tabs, error messages, and guide steps.

---

## 5. Verification Plan

1. **Platform Tab Switching**: Verify smooth switching between MissEvan and KilaManbo tabs with zero state loss or visual jumps.
2. **KilaManbo URL Decryption**: Test user's URL (`https://www.kilamanbo.world/manbo/pc/detail?_specific_parameter=...`) and ensure drama *尾钩* loads with all 8+ episodes.
3. **KilaManbo Audio Decryption**: Verify that audio plays directly in-browser and downloads as an MP4/M4A file.
4. **KilaManbo Subtitle & Danmaku Extraction**: Verify that danmaku JSON timelines load into the table with clean timestamps.
5. **Translation Parity**: Verify that the Subtitle Translation Command Center translates KilaManbo lines into Vietnamese, English, and Spanish.
6. **Compilation Check**: Run `compile_applet` to verify clean build.
