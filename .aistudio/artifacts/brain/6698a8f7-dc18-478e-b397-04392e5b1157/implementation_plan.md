# Revised Implementation Plan: Drama ID-Powered Extraction for KilaManbo Locked Episodes

## Core Discovery & User Insights
As discovered, KilaManbo's architecture stores the complete drama catalog and episode metadata inside:
`https://www.kilamanbo.world/web_manbo/dramaDetail?dramaId=<dramaId>`

### Critical Findings:
1. **Subtitles are 100% Unlocked in `dramaDetail`**:
   For every episode—including locked VIP episodes (`payType: 1` like Episode 6 and Episode 8 in Drama `2235647356781461610`)—the `dramaDetail` API publicly provides the full official script file in `setLrcUrl` (hosted on `https://img.kilamanbo.com/h5/...lrc`).
   This file contains complete dialogue lines, character/speaker names (`周其琛:`, `郎峰:`, `飞行:`, `空乘:`), stage directions, and timestamps.
2. **Why Previous Subtitle Extraction Failed**:
   Previously, when selecting an episode, if `dramaSetDetail` returned `code: 105` (unauthorized), the UI disabled the audio player and did not always load or populate the Subtitle Table with the `setLrcUrl` already present in `dramaDetail`.
3. **Why `authToken` by Itself Failed on `dramaSetDetail`**:
   KilaManbo's `dramaSetDetail` endpoint requires matching session parameters:
   - Full Cookie bundle (including `token`, `authToken`, `userId`, `deviceId`, and session cookies) rather than just an isolated `authToken` header.
   - Also, passing user credentials directly to `web_manbo/dramaDetail?dramaId=...` allows KilaManbo to populate purchased episodes in `setRespList`.
4. **Multi-Format Extraction Requirement**:
   The user requested audio and subtitles extraction in various supported file types:
   - **Subtitles**: SRT, LRC, VTT, TXT, JSON, Bilingual parallel (Chinese + Vietnamese / Chinese + English).
   - **Audio**: Original M4A/AAC, MP3, uncompressed WAV.

---

## Architecture & Workaround Strategy

```
                                [KilaManbo Input]
              (Encrypted _specific_parameter OR direct dramaId)
                                      │
                                      ▼
             [Direct Drama ID Anchor: web_manbo/dramaDetail]
                (Fast, open endpoint - HTTP 200, no code 105)
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         ▼                                                         ▼
[SUBTITLES PIPELINE]                                      [AUDIO PIPELINE]
- Read setLrcUrl from dramaDetail                         1. Forward full credentials
- Parse dialogue, roles & timestamps                         (Cookie + token + userId)
- Populate Subtitle Table immediately                        to dramaDetail & dramaSetDetail
- Enable AI Translation                                   2. If locked, provide Direct Media
- Multi-format Export:                                       Workaround (Paste stream/file)
  * SRT (.srt)                                            3. Multi-format Audio Export:
  * LRC (.lrc)                                               * Native M4A / AAC
  * VTT (.vtt)                                               * MP3 audio
  * Dialogue TXT (.txt)                                      * Client-side WAV (Web Audio API)
  * Structured JSON (.json)
  * Bilingual Parallel
```

---

## Detailed Implementation Steps

### 1. Backend Drama ID & Episode Engine (`server.ts`)
- **Direct Drama ID & URL Ingestion**:
  - Accept raw `dramaId` (e.g. `2235647356781461610`), `web_manbo/dramaDetail?dramaId=...` URLs, or encrypted `_specific_parameter` links.
  - Automatically resolve to the authoritative `dramaId`.
- **Guaranteed Subtitle Extraction**:
  - In `/api/manbo/subtitles`: Automatically prioritize `setLrcUrl` from `manboDramaSetCache` or re-fetch `dramaDetail` directly with the `dramaId`.
  - Fetch and parse the official `.lrc` file from `img.kilamanbo.com` with robust headers, returning complete subtitle objects even if `dramaSetDetail` returns `code: 105`.
- **Advanced Authentication Pass-Through**:
  - Upgrade `buildManboHeaders`: parse and forward `authToken`, `token`, `userId`, `deviceId`, and all Cookie pairs.
  - When querying `dramaDetail`, include user credentials so KilaManbo returns purchased set audio payloads if available.
- **Audio Stream & Multi-Format Proxy**:
  - Enhance `/api/manbo/audio-proxy` to deliver audio with appropriate content headers for M4A, MP4, and MP3.

### 2. Direct Media & Audio Workaround Console (`src/components/KilaManboWorkspace.tsx`)
- **Subtitles Table Always Active**:
  - When a locked episode is selected, immediately display the full extracted official subtitles, speaker roles, timestamps, and translation banner.
  - Remove blocking restrictions so users can search, filter, edit, and translate the locked episode script immediately.
- **Direct Audio Stream & File Ingestion**:
  - Add an inline **"Audio Stream Workaround" (Cứu cánh Luồng Âm Thanh)** toggle:
    - **Option A - Paste Audio URL / Network JSON**: Users playing the episode in DevTools on `kilamanbo.world` can paste the direct CDN `.m4a`/`.mp4` URL or response JSON. The app immediately validates, decrypts if needed, and loads the player.
    - **Option B - Local Audio Drop (.m4a, .mp3, .mp4, .wav)**: Drop or select any recorded or cached audio file to attach it to the current episode, enabling synchronized playback with the extracted subtitles.
- **Multi-Format Audio Download Hub**:
  - Provide a format picker for downloading episode audio:
    - **M4A / AAC**: Original pristine stream.
    - **MP3**: Universal compatibility.
    - **WAV**: Client-side uncompressed WAV encoder using `AudioContext.decodeAudioData`.

### 3. Multi-Format Subtitle Exporter Hub
- Integrate direct multi-format export buttons in the KilaManbo workspace:
  - **SRT (.srt)**: Standard SubRip with millisecond precision and speaker names.
  - **LRC (.lrc)**: Standard LRC lyrics with `[mm:ss.xx]` tags.
  - **VTT (.vtt)**: WebVTT cues for video subtitle players.
  - **TXT (.txt)**: Clean script dialogue transcript.
  - **JSON (.json)**: Full structured timeline objects.
  - **Bilingual Parallel Subtitles**: Merged original Chinese + translated language cues.

### 4. Interactive DevTools Helper in Cookie Modal (`src/components/CookieModal.tsx`)
- Add a 1-click **DevTools Console Snippet** button:
  `copy(document.cookie + '; authToken=' + (localStorage.getItem('authToken') || '') + '; userId=' + (localStorage.getItem('userId') || ''))`
- Provides clear visual instructions for users who purchased the episode on `kilamanbo.world` to copy their active session in 5 seconds.

---

## Verification Plan

1. **Subtitle Extraction Test**:
   - Query locked Episode 6 (`2243780444292120696`) and Episode 8 (`2253488985936494695`) from Drama `2235647356781461610`.
   - Verify that all subtitle cues (lines, speakers like `周其琛`, `郎峰`, timestamps) load into the Subtitle Table without error.
2. **Export Format Verification**:
   - Verify download of SRT, LRC, VTT, TXT, JSON, and Bilingual subtitles.
3. **Audio Workaround Test**:
   - Test Direct Stream URL paste and local audio file drop to confirm playback and WAV/M4A/MP3 export.
4. **Build & Compilation**:
   - Run `compile_applet` to ensure zero TypeScript and build errors.
