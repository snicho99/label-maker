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
  summary: "Summary: none",
  parsedData: null,
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

function getDatasetSummaryString() {
  if (!app || !app.activeDocument) {
    return "Summary: no active document";
  }

  return datasetState.summary;
}

function getParsedDataset() {
  return datasetState.parsedData;
}

function _setDatasetState(state, message, labelCount = null, sourceToken = "") {
  datasetState.state = state;
  datasetState.message = message;
  datasetState.labelCount = labelCount;
  datasetState.sourceToken = sourceToken;
  datasetState.summary = "Summary: none";
  datasetState.parsedData = null;
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
  const summary = _buildDatasetSummary(parsed, validation);
  const datasetMessage = `Dataset: loaded (${validation.labelCount} labels)`;

  _setDatasetState(
    "loaded",
    datasetMessage,
    validation.labelCount,
    getLinkedJsonToken(),
  );
  datasetState.summary = summary;
  datasetState.parsedData = parsed;

  return {
    file,
    data: parsed,
    labelCount: validation.labelCount,
    sections: validation.sections,
    productionStatuses: validation.productionStatuses,
  };
}

function _buildDatasetSummary(data, validation) {
  const sectionCount = validation.sections.length;
  const statuses = validation.productionStatuses.join(", ");
  const builtAt = data.builtAt;

  return `Summary: ${data.sourceWordFile} | ${sectionCount} sections | statuses: ${statuses} | built ${builtAt}`;
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
  getLinkedJsonToken,
  chooseJsonFile,
  linkExistingJsonFile,
  reloadJson,
};
