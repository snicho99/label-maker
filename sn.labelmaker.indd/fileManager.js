const { app } = require("indesign");
const fs = require("uxp").storage.localFileSystem;
const spreadCreation = require("./spreadCreation");

const JSON_DATA_SOURCE_KEY = "jsonDataSource";
const JSON_DATA_SOURCE_NAME_KEY = "jsonDataSourceName";
const JSON_DATA_SOURCE_PATH_KEY = "jsonDataSourcePath";
const DOCUMENT_LABEL_STATE_KEY = "labelMakerDocumentState";
const DOCUMENT_LABEL_STATE_VERSION = "1.0.0";

const datasetState = {
  state: "not_loaded",
  message: "Dataset: not loaded",
  labelCount: null,
  sourceToken: "",
  summary: "Summary: none",
  parsedData: null,
  displayLabels: [],
  documentStateSummary: "Document state: none",
};

/**
 * Returns the currently active document or throws if none exists.
 */
function _getActiveDocument() {
  if (!app || !app.activeDocument) {
    throw new Error("No active InDesign document.");
  }
  return app.activeDocument;
}

/**
 * Return the stored JSON link value from the current document labels.
 * This is the authoritative value used by the panel status UI.
 */
function getLinkedJsonToken() {
  const doc = _getActiveDocument();
  return doc.extractLabel(JSON_DATA_SOURCE_KEY) || "";
}

function getLinkedJsonName() {
  const doc = _getActiveDocument();
  return doc.extractLabel(JSON_DATA_SOURCE_NAME_KEY) || "";
}

function getLinkedJsonPath() {
  const doc = _getActiveDocument();
  return doc.extractLabel(JSON_DATA_SOURCE_PATH_KEY) || "";
}

/**
 * Return a status message based on current document and link state.
 */
function getStatusString() {
  if (!app || !app.activeDocument) {
    return "Status: No active document";
  }

  _refreshDisplayStateFromDocument();

  const token = getLinkedJsonToken();
  if (!token) {
    datasetState.state = "not_loaded";
    datasetState.message = "Dataset: not loaded";
    datasetState.labelCount = null;
    datasetState.sourceToken = "";
    if (!datasetState.summary || datasetState.summary === "Summary: none") {
      datasetState.summary = "Summary: persisted labels only";
    }
    return "Status: unlinked";
  }

  if (datasetState.sourceToken && datasetState.sourceToken !== token) {
    _setDatasetState("linked", "Dataset: linked, not loaded yet", null, token);
    _refreshDisplayStateFromDocument();
  }

  const name = getLinkedJsonName();
  const path = getLinkedJsonPath();
  const sourceLabel = name || path || "linked JSON";

  return `Status: linked (${sourceLabel})`;
}

function getDatasetStatusString() {
  if (!app || !app.activeDocument) {
    return "Dataset: no active document";
  }

  return datasetState.message;
}

function getDatasetSummaryString() {
  if (!app || !app.activeDocument) {
    return "Summary: no active document";
  }

  return datasetState.summary;
}

function getParsedDataset() {
  return datasetState.parsedData;
}

function getDisplayLabels() {
  return datasetState.displayLabels;
}

function getDocumentStateSummaryString() {
  if (!app || !app.activeDocument) {
    return "Document state: no active document";
  }

  return datasetState.documentStateSummary;
}

function setLabelMasterSpread(labelId, masterSpreadName) {
  if (typeof labelId !== "string" || labelId.trim() === "") {
    throw new Error("A valid labelId is required.");
  }

  const documentState = _readDocumentLabelState();
  const labelState = documentState.labels[labelId];
  if (!labelState) {
    throw new Error("Persisted label state was not found.");
  }

  labelState.masterSpread = _normalizeMasterSpreadValue(masterSpreadName);
  _writeDocumentLabelState(documentState);
  _refreshDatasetDisplayState(documentState);

  return labelState.masterSpread;
}

function createLabel(labelId) {
  if (typeof labelId !== "string" || labelId.trim() === "") {
    throw new Error("A valid labelId is required.");
  }

  const documentState = _readDocumentLabelState();
  const labelState = documentState.labels[labelId];
  if (!labelState) {
    throw new Error("Persisted label state was not found.");
  }

  if (_normalizeMasterSpreadValue(labelState.masterSpread) === null) {
    throw new Error("Select a valid master spread before creating a label.");
  }

  const sourceSnapshot = _getEffectiveLabelSnapshot(labelId, labelState);
  const now = new Date().toISOString();
  const creationResult = spreadCreation.createSpreadFromParent(labelState.masterSpread);
  const populationResult = spreadCreation.populateSpreadFromLabel(
    creationResult.spreadReference,
    sourceSnapshot,
    labelId,
  );

  if (!labelState.createdAt) {
    labelState.createdAt = now;
  }
  labelState.updatedAt = now;
  labelState.currentSpread = creationResult.spreadReference;
  labelState.textFrameBindings = Array.isArray(populationResult.frameBindings)
    ? populationResult.frameBindings
    : [];
  labelState.lastSourceSnapshot = sourceSnapshot;
  labelState.lastLaidOutSnapshot = _createLabelSnapshot(sourceSnapshot);
  _writeDocumentLabelState(documentState);
  _refreshDatasetDisplayState(documentState);

  return {
    createdAt: labelState.createdAt,
    currentSpread: labelState.currentSpread,
    masterSpread: labelState.masterSpread,
    populatedFrameCount: populationResult.replacedFrameCount,
  };
}

function refreshLabel(labelId) {
  if (typeof labelId !== "string" || labelId.trim() === "") {
    throw new Error("A valid labelId is required.");
  }

  const documentState = _readDocumentLabelState();
  const labelState = documentState.labels[labelId];
  if (!labelState) {
    throw new Error("Persisted label state was not found.");
  }

  const spreadReference = typeof labelState.currentSpread === "string" ? labelState.currentSpread.trim() : "";
  if (!spreadReference) {
    throw new Error("This label does not have an associated spread.");
  }

  const sourceSnapshot = _getEffectiveLabelSnapshot(labelId, labelState);

  const refreshResult = spreadCreation.refreshSpreadBindings(
    spreadReference,
    sourceSnapshot,
    labelId,
  );
  labelState.updatedAt = new Date().toISOString();
  labelState.textFrameBindings = Array.isArray(refreshResult.frameBindings)
    ? refreshResult.frameBindings
    : Array.isArray(labelState.textFrameBindings) ? labelState.textFrameBindings : [];
  labelState.lastSourceSnapshot = sourceSnapshot;
  labelState.lastLaidOutSnapshot = _createLabelSnapshot(sourceSnapshot);
  _writeDocumentLabelState(documentState);
  _refreshDatasetDisplayState(documentState);

  return {
    refreshedFrameCount: refreshResult.refreshedFrameCount,
    currentSpread: spreadReference,
  };
}

function deleteLabel(labelId) {
  if (typeof labelId !== "string" || labelId.trim() === "") {
    throw new Error("A valid labelId is required.");
  }

  const documentState = _readDocumentLabelState();
  const labelState = documentState.labels[labelId];
  if (!labelState) {
    throw new Error("Persisted label state was not found.");
  }

  const spreadReference = typeof labelState.currentSpread === "string" ? labelState.currentSpread.trim() : "";
  if (!spreadReference) {
    throw new Error("This label does not have an associated spread.");
  }

  spreadCreation.deleteSpreadByReference(spreadReference);
  labelState.currentSpread = "";
  labelState.updatedAt = new Date().toISOString();
  labelState.lastLaidOutSnapshot = null;
  _writeDocumentLabelState(documentState);
  _refreshDatasetDisplayState(documentState);

  return {
    deletedSpreadReference: spreadReference,
  };
}

function findLabel(labelId) {
  if (typeof labelId !== "string" || labelId.trim() === "") {
    throw new Error("A valid labelId is required.");
  }

  const documentState = _readDocumentLabelState();
  const labelState = documentState.labels[labelId];
  if (!labelState) {
    throw new Error("Persisted label state was not found.");
  }

  const spreadReference = typeof labelState.currentSpread === "string" ? labelState.currentSpread.trim() : "";
  if (!spreadReference) {
    throw new Error("This label does not have an associated spread.");
  }

  return spreadCreation.focusSpreadByReference(spreadReference);
}

function reconcileMasterSpreads(availableParentSpreadNames) {
  const availableNames = Array.isArray(availableParentSpreadNames)
    ? new Set(availableParentSpreadNames.filter((name) => typeof name === "string" && name.trim() !== ""))
    : new Set();
  const documentState = _readDocumentLabelState();
  let changed = false;

  Object.values(documentState.labels).forEach((labelState) => {
    const currentValue = _normalizeMasterSpreadValue(labelState.masterSpread);
    if (currentValue === null) {
      if (labelState.masterSpread !== null) {
        labelState.masterSpread = null;
        changed = true;
      }
      return;
    }

    if (!availableNames.has(currentValue)) {
      labelState.masterSpread = null;
      changed = true;
      return;
    }

    if (labelState.masterSpread !== currentValue) {
      labelState.masterSpread = currentValue;
      changed = true;
    }
  });

  if (changed) {
    _writeDocumentLabelState(documentState);
  }

  _refreshDatasetDisplayState(documentState);
  return changed;
}

function _setDatasetState(state, message, labelCount = null, sourceToken = "") {
  datasetState.state = state;
  datasetState.message = message;
  datasetState.labelCount = labelCount;
  datasetState.sourceToken = sourceToken;
  datasetState.summary = "Summary: none";
  datasetState.parsedData = null;
  datasetState.displayLabels = [];
  datasetState.documentStateSummary = "Document state: none";
}

function _refreshDisplayStateFromDocument() {
  try {
    const documentState = _readDocumentLabelState();
    _refreshDatasetDisplayState(documentState);
  } catch (error) {
    datasetState.displayLabels = [];
    datasetState.documentStateSummary = "Document state: unavailable";
    if (!datasetState.parsedData) {
      datasetState.summary = "Summary: unavailable";
    }
  }
}

function _validateJsonData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Top-level JSON must be an object.");
  }

  if (data.schemaVersion !== "1.0.0") {
    throw new Error("`schemaVersion` must be `1.0.0`.");
  }

  if (typeof data.sourceWordFile !== "string" || data.sourceWordFile.trim() === "") {
    throw new Error("`sourceWordFile` must be a non-empty string.");
  }

  if (typeof data.builtAt !== "string" || Number.isNaN(Date.parse(data.builtAt))) {
    throw new Error("`builtAt` must be a valid ISO 8601 timestamp string.");
  }

  if (!Array.isArray(data.labels)) {
    throw new Error("`labels` must be an array.");
  }

  const sections = new Set();
  const productionStatuses = new Set();

  data.labels.forEach((label, index) => {
    _validateLabel(label, index);
    sections.add(label.meta.section);
    productionStatuses.add(label.meta.productionStatus);
  });

  return {
    labelCount: data.labels.length,
    sections: Array.from(sections).sort(),
    productionStatuses: Array.from(productionStatuses).sort(),
  };
}

function _validateLabel(label, index) {
  if (!label || typeof label !== "object" || Array.isArray(label)) {
    throw new Error(`Label ${index + 1} must be an object.`);
  }

  const { meta, labelContent } = label;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error(`Label ${index + 1} is missing a valid \`meta\` object.`);
  }

  if (!labelContent || typeof labelContent !== "object" || Array.isArray(labelContent)) {
    throw new Error(`Label ${index + 1} is missing a valid \`labelContent\` object.`);
  }

  _validateLabelMeta(meta, index);
  _validateLabelContent(labelContent, index);
}

function _validateLabelMeta(meta, index) {
  const validLayoutStyles = ["objectLabel", "roomLabel", "groupLabel"];
  const validProductionStatuses = ["draft", "edited", "final"];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (typeof meta.labelId !== "string" || !uuidPattern.test(meta.labelId)) {
    throw new Error(`Label ${index + 1} has an invalid \`meta.labelId\`.`);
  }

  if (!validLayoutStyles.includes(meta.layoutStyle)) {
    throw new Error(`Label ${index + 1} has an invalid \`meta.layoutStyle\`.`);
  }

  if (typeof meta.labelName !== "string" || meta.labelName.trim() === "") {
    throw new Error(`Label ${index + 1} must include a non-empty \`meta.labelName\`.`);
  }

  if (typeof meta.section !== "string" || meta.section.trim() === "") {
    throw new Error(`Label ${index + 1} must include a non-empty \`meta.section\`.`);
  }

  if (typeof meta.subSection !== "string" || meta.subSection.trim() === "") {
    throw new Error(`Label ${index + 1} must include a non-empty \`meta.subSection\`.`);
  }

  if (!validProductionStatuses.includes(meta.productionStatus)) {
    throw new Error(`Label ${index + 1} has an invalid \`meta.productionStatus\`.`);
  }
}

function _validateLabelContent(labelContent, index) {
  const requiredFields = ["header", "metaText", "body"];

  requiredFields.forEach((fieldName) => {
    if (typeof labelContent[fieldName] !== "string") {
      throw new Error(`Label ${index + 1} must include string field \`labelContent.${fieldName}\`.`);
    }
  });
}

/**
 * Write the chosen JSON file reference into the current document labels.
 */
async function linkJsonFile(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const doc = _getActiveDocument();
  const token = await fs.createPersistentToken(file);
  if (!token || typeof token !== "string") {
    throw new Error("Unable to create persistent reference for JSON file.");
  }

  doc.insertLabel(JSON_DATA_SOURCE_KEY, token);
  doc.insertLabel(JSON_DATA_SOURCE_NAME_KEY, file.name || "");
  doc.insertLabel(JSON_DATA_SOURCE_PATH_KEY, file.nativePath || "");

  _setDatasetState("linked", "Dataset: linked, not loaded yet", null, token);
  return token;
}

async function _getLinkedJsonFile() {
  const token = getLinkedJsonToken();
  if (!token) {
    throw new Error("No linked JSON to reload.");
  }

  try {
    return await fs.getEntryForPersistentToken(token);
  } catch (error) {
    throw new Error("Linked JSON file is missing or no longer accessible.");
  }
}

async function _loadAndValidateLinkedJson() {
  const file = await _getLinkedJsonFile();
  const raw = await file.read();
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Linked file contains invalid JSON.");
  }

  const validation = _validateJsonData(parsed);
  const documentState = _synchronizeDocumentStateWithParsedData(parsed, _readDocumentLabelState());
  const comparison = _buildLabelComparison(parsed, documentState);
  const summary = _buildDatasetSummary(parsed, validation, comparison);
  const datasetMessage = `Dataset: loaded (${validation.labelCount} labels)`;

  _setDatasetState(
    "loaded",
    datasetMessage,
    validation.labelCount,
    getLinkedJsonToken(),
  );
  datasetState.summary = summary;
  datasetState.parsedData = parsed;
  datasetState.displayLabels = comparison.displayLabels;
  datasetState.documentStateSummary = _buildDocumentStateSummary(documentState, comparison);

  return {
    file,
    data: parsed,
    labelCount: validation.labelCount,
    sections: validation.sections,
    productionStatuses: validation.productionStatuses,
    comparison,
  };
}

function _buildDatasetSummary(data, validation, comparison) {
  const sectionCount = validation.sections.length;
  const statuses = comparison.counts.changed > 0 || comparison.counts.new > 0
    ? `${comparison.counts.new} new, ${comparison.counts.changed} changed, ${comparison.counts.unchanged} unchanged`
    : validation.productionStatuses.join(", ");
  const builtAt = data.builtAt;

  return `Summary: ${data.sourceWordFile} | ${sectionCount} sections | statuses: ${statuses} | built ${builtAt}`;
}

function _buildDocumentStateSummary(documentState, comparison) {
  const persistedCount = Object.keys(documentState.labels).length;
  return `Document state: ${persistedCount} persisted | ${comparison.counts.removed} removed from current JSON`;
}

function _buildPersistedOnlyDocumentStateSummary(documentState) {
  const persistedCount = Object.keys(documentState.labels).length;
  return `Document state: ${persistedCount} persisted`;
}

function _refreshDatasetDisplayState(documentState) {
  if (datasetState.parsedData && Array.isArray(datasetState.parsedData.labels)) {
    const comparison = _buildLabelComparison(datasetState.parsedData, documentState);
    datasetState.displayLabels = comparison.displayLabels;
    datasetState.documentStateSummary = _buildDocumentStateSummary(documentState, comparison);
    return;
  }

  datasetState.displayLabels = _buildPersistedDisplayLabels(documentState);
  datasetState.documentStateSummary = _buildPersistedOnlyDocumentStateSummary(documentState);

  if (datasetState.displayLabels.length > 0) {
    datasetState.summary = "Summary: persisted labels available";
  }
}

function _readDocumentLabelState() {
  const doc = _getActiveDocument();
  const raw = doc.extractLabel(DOCUMENT_LABEL_STATE_KEY) || "";

  if (!raw) {
    return _createEmptyDocumentLabelState();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Document label state is invalid JSON.");
  }

  return _normalizeDocumentLabelState(parsed);
}

function _normalizeDocumentLabelState(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Document label state is invalid.");
  }

  const labels = data.labels && typeof data.labels === "object" && !Array.isArray(data.labels)
    ? data.labels
    : {};

  return {
    stateVersion: typeof data.stateVersion === "string" ? data.stateVersion : DOCUMENT_LABEL_STATE_VERSION,
    labels: _normalizeDocumentLabelMap(labels),
  };
}

function _createEmptyDocumentLabelState() {
  return {
    stateVersion: DOCUMENT_LABEL_STATE_VERSION,
    labels: {},
  };
}

function _writeDocumentLabelState(documentState) {
  const doc = _getActiveDocument();
  doc.insertLabel(DOCUMENT_LABEL_STATE_KEY, JSON.stringify(documentState));
}

function _buildLabelComparison(data, documentState) {
  const displayLabels = [];
  const counts = {
    new: 0,
    changed: 0,
    unchanged: 0,
    removed: 0,
  };
  const currentIds = new Set();

  data.labels.forEach((label) => {
    const labelId = label.meta.labelId;
    const snapshot = _createLabelSnapshot(label);
    const existingState = documentState.labels[labelId] || null;
    const changeStatus = _getChangeStatus(existingState, snapshot);

    counts[changeStatus] += 1;
    currentIds.add(labelId);
    displayLabels.push({
      labelId,
      labelName: label.meta.labelName,
      section: label.meta.section,
      subSection: label.meta.subSection,
      layoutStyle: label.meta.layoutStyle,
      productionStatus: label.meta.productionStatus,
      changeStatus,
      createdAt: existingState ? existingState.createdAt || "" : "",
      updatedAt: existingState ? existingState.updatedAt || "" : "",
      currentSpread: existingState ? _getCurrentSpreadDisplayValue(existingState.currentSpread) : "",
      masterSpread: existingState ? _normalizeMasterSpreadValue(existingState.masterSpread) : null,
    });
  });

  Object.keys(documentState.labels).forEach((labelId) => {
    if (!currentIds.has(labelId)) {
      counts.removed += 1;
    }
  });

  return {
    displayLabels,
    counts,
  };
}

function _buildPersistedDisplayLabels(documentState) {
  return Object.values(documentState.labels).map((labelState) => {
    const snapshot = labelState.lastSourceSnapshot || {};
    const meta = snapshot.meta || {};

    return {
      labelId: labelState.labelId || meta.labelId || "",
      labelName: meta.labelName || "Unnamed label",
      section: meta.section || "",
      subSection: meta.subSection || "",
      layoutStyle: meta.layoutStyle || "Unknown",
      productionStatus: meta.productionStatus || "Unknown",
      changeStatus: "persisted",
      createdAt: labelState.createdAt || "",
      updatedAt: labelState.updatedAt || "",
      currentSpread: _getCurrentSpreadDisplayValue(labelState.currentSpread),
      masterSpread: _normalizeMasterSpreadValue(labelState.masterSpread),
    };
  });
}

function _normalizeDocumentLabelMap(labels) {
  return Object.fromEntries(
    Object.entries(labels).map(([labelId, labelState]) => {
      const normalizedState = labelState && typeof labelState === "object" && !Array.isArray(labelState)
        ? {
            ...labelState,
            currentSpread: typeof labelState.currentSpread === "string" ? labelState.currentSpread : "",
            masterSpread: _normalizeMasterSpreadValue(labelState.masterSpread),
            textFrameBindings: Array.isArray(labelState.textFrameBindings) ? labelState.textFrameBindings : [],
            lastLaidOutSnapshot: _normalizeOptionalLabelSnapshot(labelState.lastLaidOutSnapshot),
            lastSourceSnapshot: _normalizeOptionalLabelSnapshot(labelState.lastSourceSnapshot),
          }
        : {
            labelId,
            createdAt: "",
            updatedAt: "",
            currentSpread: "",
            masterSpread: null,
            textFrameBindings: [],
            lastLaidOutSnapshot: null,
            lastSourceSnapshot: null,
          };

      return [labelId, normalizedState];
    }),
  );
}

function _normalizeMasterSpreadValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function _getCurrentSpreadDisplayValue(spreadReference) {
  if (typeof spreadReference !== "string" || spreadReference.trim() === "") {
    return "";
  }

  try {
    return spreadCreation.getSpreadDisplayLabelByReference(spreadReference);
  } catch (error) {
    return spreadReference;
  }
}

function _getChangeStatus(existingState, snapshot) {
  if (!existingState) {
    return "new";
  }

  if (!existingState.currentSpread) {
    return "new";
  }

  if (!_snapshotsEqual(existingState.lastLaidOutSnapshot, snapshot)) {
    return "changed";
  }

  return "unchanged";
}

function _normalizeOptionalLabelSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

function _getEffectiveLabelSnapshot(labelId, labelState) {
  if (labelState.lastSourceSnapshot && typeof labelState.lastSourceSnapshot === "object" && !Array.isArray(labelState.lastSourceSnapshot)) {
    return labelState.lastSourceSnapshot;
  }

  if (datasetState.parsedData && Array.isArray(datasetState.parsedData.labels)) {
    const matchingLabel = datasetState.parsedData.labels.find((label) => {
      return label
        && label.meta
        && typeof label.meta === "object"
        && label.meta.labelId === labelId;
    });

    if (matchingLabel) {
      return _createLabelSnapshot(matchingLabel);
    }
  }

  throw new Error("This label does not have a valid loaded source snapshot. Reload JSON first.");
}

function _synchronizeDocumentStateWithParsedData(parsedData, documentState) {
  const now = new Date().toISOString();

  parsedData.labels.forEach((label) => {
    const labelId = label.meta.labelId;
    const snapshot = _createLabelSnapshot(label);
    const existingState = documentState.labels[labelId];

    if (!existingState) {
      documentState.labels[labelId] = {
        labelId,
        createdAt: "",
        updatedAt: now,
        currentSpread: "",
        masterSpread: null,
        textFrameBindings: [],
        lastLaidOutSnapshot: null,
        lastSourceSnapshot: snapshot,
      };
      return;
    }

    documentState.labels[labelId] = {
      ...existingState,
      updatedAt: now,
      currentSpread: typeof existingState.currentSpread === "string" ? existingState.currentSpread : "",
      masterSpread: _normalizeMasterSpreadValue(existingState.masterSpread),
      textFrameBindings: Array.isArray(existingState.textFrameBindings) ? existingState.textFrameBindings : [],
      lastLaidOutSnapshot: _normalizeOptionalLabelSnapshot(existingState.lastLaidOutSnapshot),
      lastSourceSnapshot: snapshot,
    };
  });

  _writeDocumentLabelState(documentState);
  return documentState;
}

function _createLabelSnapshot(label) {
  return JSON.parse(JSON.stringify(label));
}

function _snapshotsEqual(left, right) {
  return _stableSerialize(left) === _stableSerialize(right);
}

function _stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => _stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${_stableSerialize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Invoked when user clicks Choose JSON button.
 */
async function chooseJsonFile() {
  const file = await fs.getFileForOpening({ types: ["json"] });
  if (!file) {
    throw new Error("No file selected.");
  }

  return linkExistingJsonFile(file);
}

/**
 * Invoked when user clicks Reload JSON button.
 */
async function reloadJson() {
  try {
    return await _loadAndValidateLinkedJson();
  } catch (error) {
    _setDatasetState("error", `Dataset: error (${error.message})`, null, getLinkedJsonToken());
    throw error;
  }
}

async function linkExistingJsonFile(file) {
  await linkJsonFile(file);
  await _loadAndValidateLinkedJson();
  return getLinkedJsonToken();
}

module.exports = {
  getStatusString,
  getDatasetStatusString,
  getDatasetSummaryString,
  getParsedDataset,
  getDisplayLabels,
  getDocumentStateSummaryString,
  getLinkedJsonToken,
  chooseJsonFile,
  linkExistingJsonFile,
  reloadJson,
  reconcileMasterSpreads,
  setLabelMasterSpread,
  createLabel,
  deleteLabel,
  findLabel,
  refreshLabel,
};
