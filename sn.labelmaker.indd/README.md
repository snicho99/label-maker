# Label Maker InDesign Plugin

This plugin is the current baseline for the InDesign half of Label Maker. It links an InDesign document to an external JSON source, stores that association in the document, and can reload and validate the linked data.

## Current capabilities

- Choose and associate a JSON file with the active document.
- Persist the association using the InDesign document label key `jsonDataSource`.
- Reload the linked JSON file and parse it.
- Surface linked, loaded, invalid, and missing-file states in the panel.
- Refresh status when the panel opens and when the active document changes.

This is still a prototype / linkage baseline. It does not yet create or update label frames in InDesign.

## Compatibility

- InDesign with UXP plugin support
- UXP local filesystem access enabled through the manifest

## Installation

1. Open Adobe UXP Developer Tool.
2. Add this plugin by pointing it at `sn.labelmaker.indd/manifest.json`.
3. Load the plugin into InDesign.
4. Open the panel from the InDesign Plugins UI.

## Usage

1. Open or create an InDesign document.
2. Open the Label Maker panel.
3. Click `Choose JSON File` and select a `.json` file.
4. Confirm the panel shows a linked source and load status.
5. Click `Reload JSON` to re-read and validate the linked file.
6. Switch active documents to confirm the panel refreshes its status.

## Expected JSON shape

The plugin currently performs baseline validation only. It expects the top-level JSON to be an object.

The next milestone is a formal schema centered on:

- a `labels` collection
- a stable identifier per label
- the text/content fields required for museum labels

## Files

- `index.html` - panel UI
- `main.js` - panel wiring and status updates
- `fileManager.js` - document linkage, JSON load, and validation logic
- `manifest.json` - plugin metadata and entry points
- `package.json` - package metadata

