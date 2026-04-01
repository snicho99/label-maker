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

- persist a durable association to a chosen JSON file
- validate and parse linked JSON on reload
- improve panel status reporting
- fix plugin metadata and icon wiring
- document installation and baseline behavior clearly

### Phase 2: schema-aware loading

- introduce a formal label JSON schema
- hold parsed dataset state in memory while the panel is open
- surface invalid JSON, missing file, and schema errors in the panel
- show basic dataset information such as label count and source

### Phase 3: first sync workflow

- create a one-way "create missing labels from JSON" action
- define stable label identity mapping between JSON and InDesign objects
- reserve full update/delete behavior for a later milestone once layout and identity rules are locked

## Repository workflow

- Default branch: `main`
- Remote: `origin`
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
