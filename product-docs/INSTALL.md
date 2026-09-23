# Installing Trading Research Lab

Trading Research Lab (TRL) is an Obsidian **desktop** plugin with a local
Python research engine. Everything runs on your computer. There are no
accounts, no telemetry, and no network calls while you use it.

## What you need

- Obsidian desktop 1.8 or later. TRL is tested on Windows; macOS and Linux
  are expected to work but are not yet verified.
- Python **3.14** (3.14.x). The engine does all calculations.
- The release folder `trading-research-lab-<version>`, which contains:
  - `trading-research-lab/`: the Obsidian plugin (`manifest.json`,
    `main.js`, and `styles.css`)
  - `research-core/`: the Python engine
  - `docs/`: this help
  - `RELEASE_MANIFEST.json`: the SHA-256 of every file, so you can confirm
    nothing was changed

## 1. Install the engine

Open a terminal in the release folder and create a private Python
environment for the engine:

```bash
python -m venv research-core/.venv
```

Then install the engine and its two libraries (openpyxl for Excel reports and
pyarrow for data tables). This is the only step that downloads anything.

```bash
research-core/.venv/Scripts/python -m pip install ./research-core
```

On macOS or Linux, use `research-core/.venv/bin/python` instead of
`research-core/.venv/Scripts/python`.

## 2. Install the plugin

1. Copy the `trading-research-lab` folder into your vault's
   `.obsidian/plugins/` folder.
2. In Obsidian, open **Settings → Community plugins**, then enable
   **Trading Research Lab**.
3. In the plugin's settings, set **Python 3.14 virtual-environment
   executable** to the full path of the environment's Python, for example
   `D:\TRL\research-core\.venv\Scripts\python.exe`.

## 3. Check it works

Open the Trading Research Lab view and import one MT5 Strategy Tester report
(`.xlsx`). If the engine cannot start, the view shows the reason, which is
usually a wrong Python path or a Python version other than 3.14.

## Where your data goes

Imported reports are copied, unchanged, into a hidden `.trl-data` folder at
the root of your vault, together with TRL's derived tables and saved setups.
TRL never modifies your original files. If you sync or back up your vault,
`.trl-data` goes with it; it can hold copies of every report you imported. Research notes you
create are ordinary Markdown in your vault.

See [MT5_EXPORT_GUIDE.md](MT5_EXPORT_GUIDE.md) for exporting from MetaTrader 5
in the formats TRL reads.
