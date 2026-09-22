# Trading Research Lab — Obsidian Plugin Shell

This is the desktop-only Obsidian interface. It owns presentation, Obsidian view
lifecycle, and generated Markdown writes. It is not a calculation authority.

## M0 setup after prerequisites are installed

1. Install Obsidian Desktop and create/open `../dev-vault` as its dedicated
   development vault. Do not use a personal vault for plugin development.
2. Install system Node.js with `npm` and Python 3.14.7.
3. In this directory, run `npm install` and `npm run build`.
4. Copy `main.js`, `manifest.json`, and `styles.css` (when present) to
   `../dev-vault/.obsidian/plugins/trading-research-lab/`.
5. In Obsidian, enable Community Plugins and then enable **Trading Research Lab**.
6. Open **Trading Research Lab: Open research view** from the command palette.
7. In plugin settings, set the absolute path to the Python 3.14.7 virtual-env
   executable containing `trading-research-core`.

The build/reload/deployment mechanics will become an automated, explicit M0
tool only after this manual first load succeeds.
