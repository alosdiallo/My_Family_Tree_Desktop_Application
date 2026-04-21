# Family Tree

A desktop genealogy application built with Electron for macOS. Designed as a personal, maintainable replacement for commercial genealogy software.

![Family Tree App](screenshot.png)

## Features

### Tree Management
- **Multiple family trees** — Manage separate trees for different family lines (e.g. paternal and maternal)
- **GEDCOM import/export** — Standard genealogy file format compatible with other software
- **Auto-backup system** — Automatic backups on launch, every 30 minutes, and before any destructive action
- **Soft delete with trash** — Deleted people and trees are recoverable for 30 days

### Person Records
- **Flexible date entry** — Type dates naturally: "january 5 1892", "about 1670", "between 1860 and 1870", "~1750". The app interprets and normalizes them automatically
- **Comprehensive fields** — Name (with title and suffix), sex, birth/death dates, burial location, cause of death, occupation, religion, address, country, adoption status
- **Photos** — Attach a profile photo to each person (copied into the app's managed storage)
- **File attachments** — Attach documents, certificates, scanned records (PDFs, images, text files)
- **Notes** — Free-text notes with a full-page editor for family stories and research context
- **Life events timeline** — Record immigration, naturalization, military service, education, elected office, residence changes, court cases, religious events, and more — each with date, place, and description

### Family Relationships
- **Full relationship support** — Parents, children, siblings, spouses
- **Marriage details** — Marriage date, place, and married/divorced status
- **Sibling parent selection** — Choose which parent family a sibling belongs to (for blended families)
- **Adopted children** — Flag children as adopted
- **Relationship calculator** — Select any two people to see how they're related (cousin degrees, in-laws, etc.)

### Views
- **Pedigree** — Ancestor-focused horizontal tree showing grandparents → parents → selected person → children, with spouse cards and sibling sections. Navigable by clicking any card
- **Descendants** — Recursive top-down tree showing all descendants of the selected person with spouse indicators
- **Family Group Sheet** — Tabular view showing each nuclear family unit with roles, dates, and locations
- **Map** — SVG world map with pins on countries where family members are from. Click a pin to see who's there

### Output
- **Family Report** — Generate a formatted PDF/HTML report with a table of contents and detailed sections for every person including family connections, events, and notes
- **Save as PDF** — Export the current view as a PDF
- **Print** — Send directly to a printer
- **GEDCOM export** — Export data in standard genealogy format for use in other software

### Search
- **Quick search** — Filter people by name, date, address, or country from the search bar

### Navigation
- **Breadcrumb navigation** — Always see where you are in the tree with quick-jump buttons to parents and the starting person
- **Children show spouses** — Spouse cards appear alongside children for easy navigation across family lines

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Electron](https://www.electronjs.org/) |
| Database | [sql.js](https://github.com/sql-js/sql.js/) (SQLite compiled to WebAssembly) |
| Map | [Simple World Map SVG](https://github.com/flekschas/simple-world-map) (CC BY-SA 3.0) |
| Fonts | [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans), [Inter](https://fonts.google.com/specimen/Inter), [Material Symbols](https://fonts.google.com/icons) |
| Styling | Hand-written CSS (no framework dependencies) |

**No native compilation required.** The app uses sql.js (WebAssembly) instead of native SQLite bindings, so there are no `node-gyp`, C++ compiler, or platform-specific build steps.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or later)
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/yourusername/family-tree.git
cd family-tree
npm install
```

### Running

```bash
npm start
```

### First Use

1. The app opens to a home screen
2. Click **"Import GEDCOM as New Tree"** to import an existing genealogy file, or **"New Family Tree"** to start from scratch
3. If starting fresh, click **"Add Person"** in the sidebar to add your first family member
4. Use **"Add Relative"** to build out the tree with parents, children, siblings, and spouses

## Project Structure

```
family-tree/
├── main.js            # Electron main process — database, IPC handlers, file dialogs
├── preload.js         # Context bridge — exposes API to renderer
├── renderer.js        # UI logic — views, sidebar, forms, event handling
├── index.html         # App shell — layout, header, tabs
├── styles.css         # All styles — no CSS framework
├── date-parser.js     # Flexible genealogy date interpreter
├── country-data.js    # Country/city name → coordinates mapping
├── world-map.svg      # SVG world map (CC BY-SA 3.0)
├── logo.png           # App logo
├── package.json       # Dependencies and scripts
└── sample.ged         # Sample GEDCOM file for testing
```

### Data Storage

All data is stored locally on the user's machine:

```
~/Library/Application Support/family-tree/
├── family-tree.sqlite    # SQLite database
├── photos/               # Copied profile photos
├── documents/            # Attached files organized by tree and person
│   └── tree-{id}/
│       └── person-{id}/
└── backups/              # Automatic and manual backups
```

## Database Schema

The app uses a relational SQLite schema:

- **trees** — Named family tree containers
- **people** — Individual person records with all biographical fields
- **families** — Marriage/partnership records linking two people
- **family_children** — Junction table linking children to families
- **events** — Life events (immigration, military service, etc.)
- **sources** — Source citations (schema ready, UI in progress)
- **citations** — Links sources to specific facts (schema ready, UI in progress)
- **attachments** — File attachment metadata

## GEDCOM Support

The app includes a built-in GEDCOM parser (no external dependency) that handles:
- Individual records (INDI) with NAME, SEX, BIRT, DEAT, PLAC
- Family records (FAM) with HUSB, WIFE, CHIL, MARR, DIV
- Birth place extraction into address and country fields
- Flexible date formats including ABT, BEF, AFT, BET

Export produces standard GEDCOM 5.5.1 files with proper FAMS/FAMC cross-references.

## Backup System

The app protects against data loss with three layers:

1. **Soft delete** — Deleted records stay recoverable for 30 days in a "Recently Deleted" section
2. **Automatic backups** — Database snapshots on launch, every 30 minutes, on shutdown, and before any destructive action
3. **Pre-destructive backups** — Labeled backups created before deleting trees, importing data, or restoring from backup

The 20 most recent backups are retained; older ones are automatically pruned.

## Roadmap

- [ ] Sources UI — Attach source citations to any fact (database schema in place)
- [ ] Packaging as .app / .dmg for distribution
- [ ] Auto-update mechanism via GitHub Releases
- [ ] Statistics dashboard on home screen
- [ ] Duplicate person detection and merge
- [ ] Dark mode

## License

This project is for personal/family use. The world map SVG is licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) by Al MacDonald / Fritz Lekschas.

## Acknowledgments

- Built with guidance and collaboration using [Claude](https://claude.ai) by Anthropic
- World map from [flekschas/simple-world-map](https://github.com/flekschas/simple-world-map)
- Inspired by the genealogy work of family historians everywhere