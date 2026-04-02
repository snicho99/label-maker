# Label Maker

Label Maker is a museum label production project built around a single workflow:

1. Curators and registrars author label content in Microsoft Word using a `.dotx` template.
2. A parser converts that Word content into a machine-readable JSON label model.
3. An Adobe InDesign plugin links an InDesign document to that JSON and uses it to create and later manage labels.

This repository is the foundation snapshot for that workflow. The InDesign plugin exists today as a working prototype for document-to-JSON linkage, and the Word parser and shared JSON schema are the next major milestones.

## Current status

- The InDesign plugin prototype lives in `sn.labelmaker.indd/`.
- It can associate the active InDesign document with a chosen JSON file and persist that association in the document using the `jsonDataSource` label key.
- It can reload the linked JSON file, parse it, and surface basic status in the panel.
- Reload immediately updates the plugin's internal label model, while laid-out spread content remains unchanged until a label is created or refreshed.
- It can persist per-label internal state in the InDesign document, including chosen master spreads and created spread references.
- It can persist per-text-frame template bindings on created spreads so text can be regenerated after moustache placeholders are replaced.
- It can also copy replaced text-box template content into the persisted per-label internal state for inspection and reuse.
- It now includes a labels table with per-row create, delete, and find actions for spread-linked labels.
- The broader parser, schema, and full CRUD sync flow are planned but not implemented yet.

Treat this commit as a baseline scaffold, not a finished release.

## Planned architecture

The project will remain plugin-centric for now, while growing into a small monorepo over time.

- `sn.labelmaker.indd/`
  InDesign UXP plugin for linking, validating, loading, and eventually syncing labels from JSON.
- `word-parser/`
  Planned parser for converting `.dotx`-based Word documents into normalized JSON.
- `schema/`
  Planned shared documentation and validation assets for the label JSON model.
- `docs/`
  Planned product and workflow documentation if the project grows beyond README-level guidance.

## External contract: label JSON

The JSON file is the main interface between the two halves of the system. The canonical schema now lives at `schema/label-schema.json`, with a representative sample dataset at `schema/examples/labels.sample.json`.

Plugin-only persisted state is documented separately at `schema/label-schema-internal.json`.

The v1 dataset shape is:

- `schemaVersion`
- `sourceWordFile`
- `builtAt`
- `labels`

Each label contains:

- `meta.labelId`
- `meta.layoutStyle`
- `meta.labelName`
- `meta.productionStatus`
- `labelContent.header`
- `labelContent.metaText`
- `labelContent.body`

The InDesign plugin will continue to use the `jsonDataSource` document label key as the persisted association mechanism unless a compatibility issue forces a change.

## Plugin roadmap

### Phase 1: prototype hardening

- [x] persist a durable association to a chosen JSON file
- [x] validate and parse linked JSON on reload
- [x] improve panel status reporting
- [x] fix plugin metadata and icon wiring
- [x] document installation and baseline behavior clearly

### Phase 2: schema-aware loading

- [x] introduce a formal label JSON schema
- [x] hold parsed dataset state in memory while the panel is open
- [x] surface invalid JSON, missing file, and schema errors in the panel
- [x] show basic dataset information such as label count and source
- [x] add a labels table view in the plugin UI
- [x] split configuration controls and the labels table into separate panels
- [~] stabilize the InDesign file picker / JSON linking flow

### Phase 3: first sync workflow

- [x] create a one-way "create missing labels from JSON" action
- [x] define stable label identity mapping between JSON and InDesign objects
- [x] persist plugin-managed label state inside the InDesign document
- [x] track per-label plugin metadata such as `createdAt` and `updatedAt` inside document state only
- [x] compare reloaded JSON against persisted document state to surface changes since last load
- [x] update persisted plugin-managed label state immediately when JSON is reloaded
- [x] display persisted plugin timestamps in a human-readable "time ago" format in the labels table
- [x] document the internal persisted InDesign label state schema
- [x] allow per-label master spread selection from available document master spreads
- [x] clear invalid persisted master spread selections when the active document changes
- [x] create a spread from a selected master spread and persist the created spread reference
- [x] populate created spread text frames from moustache-style label data placeholders
- [x] persist text-frame template bindings so populated spreads can be refreshed
- [x] store replaced text-box template content on the persisted label state
- [x] refresh a created spread's bound text frames from stored templates and the current label snapshot
- [x] keep loaded JSON state separate from laid-out spread state so change badges reflect what is actually on the page
- [x] leave unmatched moustache placeholders visible and log them for template debugging
- [x] delete a created spread and clear the persisted spread reference
- [x] locate and focus a created spread from the labels table
- [ ] reserve full content update behavior for a later milestone once layout and identity rules are locked

## Roadmap tracking

Use these markers in this README as work progresses:

- `[x]` complete
- `[~]` in progress / partially working
- `[ ]` planned

When significant work is requested that is not already represented on the roadmap, add it here before or alongside implementation so the README stays aligned with the real project.

Roadmap decisions currently locked in:

- plugin-only state such as `createdAt` and `updatedAt` stays internal to the saved InDesign document
- the public Word/parser JSON schema remains source-data only and does not include plugin-managed lifecycle fields

## Repository workflow

- Default branch: `main`
- Remote: `origin`
- InDesign document files (`*.indd`) are tracked with Git LFS
- Initial baseline commit message: `Initial scaffold for museum label maker`

After the initial baseline push, follow-on work should branch by milestone:

- schema definition
- Word parser prototype
- plugin JSON loading and validation
- first sync workflow

## Baseline verification

The current baseline should be manually verified in UXP Developer Tool against InDesign by checking:

- the plugin panel loads successfully
- choosing a JSON file links it to the active document
- reopening or switching documents refreshes the status correctly
- reloading a valid JSON file reports a successful load
- malformed JSON and missing linked files show clear status output
- plugin icons resolve correctly from the manifest
