const { app } = require("indesign");
const fs = require("uxp").storage.localFileSystem;

const JSON_DATA_SOURCE_KEY = "jsonDataSource";
const JSON_DATA_SOURCE_NAME_KEY = "jsonDataSourceName";
const JSON_DATA_SOURCE_PATH_KEY = "jsonDataSourcePath";

const datasetState = {
  state: "not_loaded",
  message: "Dataset: not loaded",
  labelCount: null,
  sourceToken: "",
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

  const token = getLinkedJsonToken();
  if (!token) {
    _setDatasetState("not_loaded", "Dataset: not loaded");
    return "Status: unlinked";
  }

  if (datasetState.sourceToken && datasetState.sourceToken !== token) {
    _setDatasetState("linked", "Dataset: linked, not loaded yet", null, token);
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

function _setDatasetState(state, message, labelCount = null, sourceToken = "") {
  datasetState.state = state;
  datasetState.message = message;
  datasetState.labelCount = labelCount;
  datasetState.sourceToken = sourceToken;
}

function _validateJsonData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Top-level JSON must be an object.");
  }

  if (Object.prototype.hasOwnProperty.call(data, "labels")) {
    if (!Array.isArray(data.labels)) {
      throw new Error("If present, `labels` must be an array.");
    }

    return {
      labelCount: data.labels.length,
    };
  }

  return {
    labelCount: null,
  };
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
  const datasetMessage = validation.labelCount === null
    ? "Dataset: loaded (no `labels` collection yet)"
    : `Dataset: loaded (${validation.labelCount} labels)`;

  _setDatasetState(
    "loaded",
    datasetMessage,
    validation.labelCount,
    getLinkedJsonToken(),
  );

  return {
    file,
    data: parsed,
    labelCount: validation.labelCount,
  };
}

/**
 * Invoked when user clicks Choose JSON button.
 */
async function chooseJsonFile() {
  const file = await fs.getFileForOpening({ types: ["json"] });
  if (!file) {
    throw new Error("No file selected.");
  }

  await linkJsonFile(file);
  await _loadAndValidateLinkedJson();
  return getLinkedJsonToken();
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

module.exports = {
  getStatusString,
  getDatasetStatusString,
  getLinkedJsonToken,
  chooseJsonFile,
  reloadJson,
};
