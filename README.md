# SPL Stats Exporter

Browser extension that captures match data from the SPL Torneopal API and exports per-player statistics to Excel.

## How It Works

When you browse a match page on the Palloliitto tulospalvelu (or any page on `*.torneopal.net` / `*.palloliitto.fi`), the page makes API calls to `spl.torneopal.net/taso/rest/getMatch`. This extension silently intercepts those responses and makes the data available for export.

1. **Browse** — Visit a match page that triggers a `getMatch` API call
2. **Capture** — The extension badge turns green with `!` when match data is captured
3. **Export** — Click the extension icon and hit "Download Excel"

No data is sent anywhere. Everything runs locally in your browser.

## Installation

### Chrome / Brave / Edge

1. Go to `chrome://extensions` (or `brave://extensions` / `edge://extensions`)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** and select the `spl-stats-plugin` folder

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from the `spl-stats-plugin` folder

## Excel Output

The exported `.xlsx` file contains one row per player with the following columns:

| Column | Description |
|--------|-------------|
| Player Name | First name Last name |
| Player ID | Torneopal player ID |
| Position | English position name (goalkeeper, defender, midfielder, forward) |
| Pos | Finnish abbreviation: **V** (goalkeeper), **P** (defender), **KK** (midfielder), **H** (forward) |
| Team | Team name |
| Match Round | Round number |
| Minutes Played | Minutes on pitch |
| Goals Scored | Goals (all types including penalties) |
| Assists | Assists |
| Yellow Cards | Yellow cards |
| Red Cards | Red cards / send-offs |
| Saves | Goalkeeper saves |
| Conceded Goals | Goals conceded while the player was on the pitch (applies to all players, not just GK) |
| Own Goals | Own goals (detected from score changes in match events) |
| Penalties Missed | Missed penalties (shot off target or saved, with `rp` marker in events) |
| Total Points | Computed fantasy-style score (see below) |

## Scoring Formula

Total points are calculated per player in `excel.js` → `totalPointsFormula()`. The formula uses position-dependent factors:

| Component | V (GK) | P (Def) | KK (Mid) | H (Fwd) |
|-----------|--------|---------|----------|---------|
| Goal | ×6 | ×6 | ×5 | ×4 |
| Clean sheet (60+ min, 0 conceded) | +4 | +4 | +1 | +0 |
| Save | ×⅓ (floored) | ×0 | ×0 | ×0 |

Plus position-independent components:

| Component | Points |
|-----------|--------|
| 60+ minutes played | +2 |
| 30–59 minutes played | +1 |
| Assist | +3 |
| Yellow card | −1 |
| Red card | −3 (replaces yellow penalty) |
| Own goal | −2 each |
| Penalty missed | −2 each |
| Every 2 goals conceded | −1 |

To modify the formula, edit the `totalPointsFormula()` function in `excel.js`.

## File Structure

```
spl-stats-plugin/
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Service worker — receives captured data
├── content.js         # Content script — bridges page to extension
├── interceptor.js     # Injected into page — intercepts XHR/fetch responses
├── stats.js           # Extracts per-player stats from API response
├── excel.js           # Builds .xlsx workbook (scoring formula lives here)
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── lib/
│   └── xlsx.full.min.js  # SheetJS library (Excel generation)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Data Source

The extension reads responses from:

```
https://spl.torneopal.net/taso/rest/getMatch?match_id=<id>
```

Key data used from the response:
- `match.lineups[]` — pre-computed player stats (goals, assists, saves, warnings, etc.)
- `match.events[]` — match events used to derive own goals, penalties missed, and per-player conceded goals
- `match.team_A_name`, `match.team_B_name`, `match.round_id` — match metadata