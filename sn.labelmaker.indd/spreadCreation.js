const { app } = require("indesign");

function createSpreadFromParent(parentName) {
  const doc = getActiveDocument();
  const parentSpread = getParentSpread(doc, parentName);
  const spread = doc.spreads.add();
  spread.appliedMaster = parentSpread;
  console.log("[spreadCreation] Created spread:", spread);

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

module.exports = {
  createSpreadFromParent,
  deleteSpreadByReference,
  focusSpreadByReference,
  getActiveDocumentSignature,
  getSpreadDisplayLabelByReference,
  listParentSpreadNames,
};
