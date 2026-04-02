const { app } = require("indesign");
const FRAME_BINDING_KEY = "labelMakerTextBinding";
const FRAME_BINDING_VERSION = "1.0.0";

function createSpreadFromParent(parentName) {
  const doc = getActiveDocument();
  const parentSpread = getParentSpread(doc, parentName);
  const spread = doc.spreads.add();
  spread.appliedMaster = parentSpread;
  overrideMasterTextFramesOnSpread(spread, parentSpread);

  return {
    parentName,
    pageCount: spread.pages.length,
    spreadReference: getSpreadReference(spread),
  };
}

function deleteSpreadByReference(spreadReference) {
  const doc = getActiveDocument();
  const spread = resolveSpreadReference(doc, spreadReference);
  spread.remove();
}

function focusSpreadByReference(spreadReference) {
  const doc = getActiveDocument();
  const spread = resolveSpreadReference(doc, spreadReference);
  const layoutWindow = getActiveLayoutWindow();

  layoutWindow.activeSpread = spread;
  layoutWindow.bringToFront();

  return {
    spreadReference: getSpreadReference(spread),
  };
}

function populateSpreadFromLabel(spreadReference, labelData, labelId = "") {
  const doc = getActiveDocument();
  const spread = resolveSpreadReference(doc, spreadReference);
  const textFrames = collectSpreadTextFrames(spread);
  let replacedFrameCount = 0;
  const frameBindings = [];
  const previousEnableRedraw = getEnableRedrawPreference();

  setEnableRedrawPreference(true);

  try {
    textFrames.forEach((textFrame) => {
      const originalContents = typeof textFrame.contents === "string" ? textFrame.contents : "";
      if (!originalContents || !originalContents.includes("{{")) {
        return;
      }

      const populatedContents = replaceMustacheTokens(originalContents, labelData);
      if (populatedContents === originalContents) {
        return;
      }

      const bindingData = {
        labelId,
        templateText: originalContents,
        lastRenderedText: populatedContents,
        sourcePaths: extractMustachePaths(originalContents),
        schemaVersion: FRAME_BINDING_VERSION,
        frameReference: getTextFrameReference(textFrame),
      };
      writeTextFrameBinding(textFrame, bindingData);
      textFrame.contents = populatedContents;
      recomposeTextFrameStory(textFrame);
      frameBindings.push(bindingData);
      replacedFrameCount += 1;
    });
  } finally {
    setEnableRedrawPreference(previousEnableRedraw);
  }

  return {
    replacedFrameCount,
    frameBindings,
  };
}

function refreshSpreadBindings(spreadReference, labelData, labelId = "") {
  const doc = getActiveDocument();
  const spread = resolveSpreadReference(doc, spreadReference);
  const textFrames = collectSpreadTextFrames(spread);
  let refreshedFrameCount = 0;
  const frameBindings = [];
  const previousEnableRedraw = getEnableRedrawPreference();

  setEnableRedrawPreference(true);

  try {
    textFrames.forEach((textFrame) => {
      const binding = readTextFrameBinding(textFrame);
      if (!binding) {
        return;
      }

      if (labelId && binding.labelId && binding.labelId !== labelId) {
        return;
      }

      const templateText = typeof binding.templateText === "string" ? binding.templateText : "";
      if (!templateText || !templateText.includes("{{")) {
        return;
      }

      const renderedText = replaceMustacheTokens(templateText, labelData);
      const nextBinding = {
        ...binding,
        labelId: labelId || binding.labelId || "",
        lastRenderedText: renderedText,
        sourcePaths: extractMustachePaths(templateText),
        schemaVersion: FRAME_BINDING_VERSION,
        frameReference: binding.frameReference || getTextFrameReference(textFrame),
      };
      writeTextFrameBinding(textFrame, nextBinding);
      textFrame.contents = renderedText;
      recomposeTextFrameStory(textFrame);
      frameBindings.push(nextBinding);
      refreshedFrameCount += 1;
    });
  } finally {
    setEnableRedrawPreference(previousEnableRedraw);
  }

  return {
    refreshedFrameCount,
    frameBindings,
  };
}

function getSpreadDisplayLabelByReference(spreadReference) {
  const doc = getActiveDocument();
  const spread = resolveSpreadReference(doc, spreadReference);
  const firstPage = spread.pages && spread.pages.length > 0 ? spread.pages.item(0) : null;

  if (!firstPage) {
    return spreadReference;
  }

  if (typeof firstPage.name === "string" && firstPage.name.trim() !== "") {
    return firstPage.name;
  }

  if (typeof firstPage.documentOffset === "number") {
    return String(firstPage.documentOffset + 1);
  }

  return spreadReference;
}

function overrideMasterTextFramesOnSpread(spread, parentSpread) {
  if (!spread || !parentSpread || !spread.pages || !parentSpread.pages) {
    return;
  }

  const pageCount = Math.min(spread.pages.length, parentSpread.pages.length);
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const spreadPage = spread.pages.item(pageIndex);
    const masterPage = parentSpread.pages.item(pageIndex);
    const masterTextFrames = getCollectionItems(masterPage.textFrames);

    masterTextFrames.forEach((masterTextFrame) => {
      try {
        masterTextFrame.override(spreadPage);
      } catch (error) {
        console.warn("[spreadCreation] Failed to override master text frame:", error);
      }
    });
  }
}

function listParentSpreadNames() {
  const doc = getActiveDocument();
  const names = [];
  for (let index = 0; index < doc.masterSpreads.length; index += 1) {
    const masterSpread = doc.masterSpreads.item(index);

    if (masterSpread && masterSpread.name) {
      names.push(masterSpread.name);
    }
  }

  return names;
}

function getActiveDocumentSignature() {
  if (!app || !app.activeDocument) {
    return "no-document";
  }

  const doc = app.activeDocument;
  const idPart = typeof doc.id !== "undefined" ? String(doc.id) : "unknown-id";
  const namePart = typeof doc.name === "string" ? doc.name : "unnamed-document";

  return `${idPart}:${namePart}`;
}

function getActiveDocument() {
  if (!app || !app.activeDocument) {
    throw new Error("No active InDesign document.");
  }

  return app.activeDocument;
}

function getActiveLayoutWindow() {
  if (!app || !app.activeWindow) {
    throw new Error("No active InDesign layout window.");
  }

  return app.activeWindow;
}

function getEnableRedrawPreference() {
  try {
    return app && app.scriptPreferences
      ? app.scriptPreferences.enableRedraw
      : undefined;
  } catch (error) {
    return undefined;
  }
}

function setEnableRedrawPreference(value) {
  try {
    if (app && app.scriptPreferences && typeof value !== "undefined") {
      app.scriptPreferences.enableRedraw = value;
    }
  } catch (error) {
    console.warn("[spreadCreation] Unable to update enableRedraw:", error);
  }
}

function getParentSpread(doc, parentName) {
  const parentSpread = doc.masterSpreads.itemByName(parentName);

  if (!parentSpread || !parentSpread.name) {
    throw new Error(`Parent spread \`${parentName}\` was not found.`);
  }

  return parentSpread;
}

function getSpreadReference(spread) {
  if (!spread || typeof spread !== "object") {
    throw new Error("Unable to resolve created spread.");
  }

  if (typeof spread.id !== "undefined" && spread.id !== null) {
    return String(spread.id);
  }

  if (typeof spread.index === "number") {
    return `index:${spread.index}`;
  }

  if (typeof spread.name === "string" && spread.name.trim() !== "") {
    return spread.name;
  }

  throw new Error("Unable to resolve a stable spread reference.");
}

function resolveSpreadReference(doc, spreadReference) {
  if (typeof spreadReference !== "string" || spreadReference.trim() === "") {
    throw new Error("A valid spread reference is required.");
  }

  const normalizedReference = spreadReference.trim();

  if (/^\d+$/.test(normalizedReference)) {
    return doc.spreads.itemByID(Number(normalizedReference));
  }

  if (normalizedReference.startsWith("index:")) {
    const index = Number(normalizedReference.slice("index:".length));
    if (Number.isNaN(index)) {
      throw new Error(`Spread reference \`${spreadReference}\` is invalid.`);
    }

    return doc.spreads.item(index);
  }

  return doc.spreads.itemByName(normalizedReference);
}

function collectSpreadTextFrames(spread) {
  const framesById = new Map();
  const spreadPages = getCollectionItems(spread.pages);

  spreadPages.forEach((page) => {
    const pageTextFrames = getCollectionItems(page.textFrames);
    pageTextFrames.forEach((textFrame) => {
      const frameKey = typeof textFrame.id !== "undefined" ? String(textFrame.id) : `${framesById.size}`;
      if (!framesById.has(frameKey)) {
        framesById.set(frameKey, textFrame);
      }
    });
  });
  return Array.from(framesById.values());
}

function getCollectionItems(collection) {
  if (!collection || typeof collection.length !== "number") {
    return [];
  }

  const items = [];
  for (let index = 0; index < collection.length; index += 1) {
    items.push(collection.item(index));
  }

  return items;
}

function recomposeTextFrameStory(textFrame) {
  try {
    if (textFrame && textFrame.parentStory && typeof textFrame.parentStory.recompose === "function") {
      textFrame.parentStory.recompose();
    }
  } catch (error) {
    console.warn("[spreadCreation] Unable to recompose text frame story:", error);
  }
}

function replaceMustacheTokens(contents, labelData) {
  const tokenMatches = Array.from(contents.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g));
  if (tokenMatches.length === 0) {
    return contents;
  }

  let populatedContents = contents;
  tokenMatches.forEach((match) => {
    const matchedToken = match[0];
    const pathExpression = match[1];
    const resolution = resolveLabelDataPath(labelData, pathExpression);
    if (!resolution.found) {
      console.error(`[spreadCreation] No matching label property found for moustache path: ${String(pathExpression).trim()}`);
      return;
    }

    const replacementValue = resolution.value === null
      ? ""
      : String(resolution.value);

    populatedContents = populatedContents.split(matchedToken).join(replacementValue);
  });

  return populatedContents;
}

function extractMustachePaths(contents) {
  return Array.from(
    new Set(
      Array.from(contents.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))
        .map((match) => String(match[1]).trim())
        .filter((value) => value !== ""),
    ),
  );
}

function resolveLabelDataPath(rootValue, pathExpression) {
  if (!rootValue || typeof rootValue !== "object") {
    return {
      found: false,
      value: undefined,
    };
  }

  const pathSegments = String(pathExpression)
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");

  let currentValue = rootValue;
  for (const segment of pathSegments) {
    if (!currentValue || typeof currentValue !== "object" || !(segment in currentValue)) {
      return {
        found: false,
        value: undefined,
      };
    }

    currentValue = currentValue[segment];
  }

  return {
    found: true,
    value: currentValue,
  };
}

function readTextFrameBinding(textFrame) {
  if (!textFrame || typeof textFrame.extractLabel !== "function") {
    return null;
  }

  const raw = textFrame.extractLabel(FRAME_BINDING_KEY) || "";
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[spreadCreation] Invalid text frame binding JSON:", error);
    return null;
  }
}

function writeTextFrameBinding(textFrame, bindingData) {
  if (!textFrame || typeof textFrame.insertLabel !== "function") {
    return;
  }

  textFrame.insertLabel(FRAME_BINDING_KEY, JSON.stringify(bindingData));
}

function getTextFrameReference(textFrame) {
  if (!textFrame || typeof textFrame !== "object") {
    return "";
  }

  if (typeof textFrame.id !== "undefined" && textFrame.id !== null) {
    return String(textFrame.id);
  }

  if (typeof textFrame.index === "number") {
    return `index:${textFrame.index}`;
  }

  return "";
}

module.exports = {
  createSpreadFromParent,
  deleteSpreadByReference,
  focusSpreadByReference,
  getActiveDocumentSignature,
  getSpreadDisplayLabelByReference,
  listParentSpreadNames,
  populateSpreadFromLabel,
  refreshSpreadBindings,
};
