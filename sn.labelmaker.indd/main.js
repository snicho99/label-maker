const { entrypoints } = require("uxp");
const fileManager = require("./fileManager");
const labelsTable = require("./labelsTable");
const spreadCreation = require("./spreadCreation");

let configPanelNode = null;
let labelTablePanelNode = null;
let activeDocumentPollInterval = null;
let lastActiveDocumentSignature = "no-document";
const columnVisibility = {
  approval: true,
  layoutStyle: true,
  section: false,
  subSection: false,
  labelId: false,
};

console.log("[labelmaker] main.js loaded");

entrypoints.setup({
  panels: {
    labelTable: {
      async show(rootNode) {
        console.log("[labelmaker] labelTable.show invoked", describePanelArg(rootNode));
        labelTablePanelNode = resolvePanelRoot(rootNode);
        console.log("[labelmaker] labelTable root resolved", describeNode(labelTablePanelNode));
        ensurePanelContent(labelTablePanelNode, "labelTable");
        startActiveDocumentWatcher();
        await updateLabelTablePanel(labelTablePanelNode);
        console.log("[labelmaker] labelTable.show completed");
      },
    },
    config: {
      async show(rootNode) {
        console.log("[labelmaker] config.show invoked", describePanelArg(rootNode));
        configPanelNode = resolvePanelRoot(rootNode);
        console.log("[labelmaker] config root resolved", describeNode(configPanelNode));
        ensurePanelContent(configPanelNode, "config");
        initializeConfigPanel(configPanelNode);
        startActiveDocumentWatcher();
        await updateConfigPanel(configPanelNode);
        console.log("[labelmaker] config.show completed");
      },
    },
  },
});

function resolvePanelRoot(panelArg) {
  console.log("[labelmaker] resolvePanelRoot called", describePanelArg(panelArg));
  if (panelArg && typeof panelArg.querySelector === "function" && typeof panelArg.appendChild === "function") {
    return panelArg;
  }

  if (panelArg && panelArg.node && typeof panelArg.node.querySelector === "function" && typeof panelArg.node.appendChild === "function") {
    return panelArg.node;
  }

  throw new Error("UXP panel root node was not provided.");
}

function ensurePanelContent(rootNode, panelId) {
  if (!rootNode) {
    console.warn("[labelmaker] ensurePanelContent skipped because rootNode was missing", panelId);
    return;
  }

  if (rootNode.getAttribute("data-panel-template") === panelId && rootNode.firstElementChild) {
    console.log("[labelmaker] panel content already present", panelId);
    return;
  }

  const contentNode = panelId === "config"
    ? createConfigPanelContent()
    : createLabelTablePanelContent();

  console.log("[labelmaker] mounting panel content", {
    panelId,
    root: describeNode(rootNode),
    contentTagName: contentNode.tagName,
  });

  while (rootNode.firstChild) {
    rootNode.removeChild(rootNode.firstChild);
  }

  rootNode.appendChild(contentNode);
  rootNode.setAttribute("data-panel-template", panelId);
  console.log("[labelmaker] panel content mounted", {
    panelId,
    childCount: rootNode.childElementCount,
  });
}

function initializeConfigPanel(rootNode) {
  if (!rootNode || rootNode.getAttribute("data-config-initialized") === "true") {
    if (rootNode) {
      console.log("[labelmaker] config panel already initialized");
    }
    return;
  }

  const chooseButton = rootNode.querySelector("#chooseJson");
  if (chooseButton) {
    chooseButton.onclick = () => {
      handleChooseJsonClick(rootNode).catch((error) => {
        console.error("Choose JSON click handler failed:", error);
      });
    };
  }

  const reloadButton = rootNode.querySelector("#reloadJson");
  if (reloadButton) {
    reloadButton.onclick = () => {
      handleReloadJsonClick().catch((error) => {
        console.error("Reload JSON click handler failed:", error);
      });
    };
  }

  bindColumnVisibilityHandlers(rootNode);

  rootNode.setAttribute("data-config-initialized", "true");
  console.log("[labelmaker] config panel initialized");
}

function startActiveDocumentWatcher() {
  if (activeDocumentPollInterval) {
    console.log("[labelmaker] active document watcher already running");
    return;
  }

  lastActiveDocumentSignature = spreadCreation.getActiveDocumentSignature();
  console.log("[labelmaker] starting active document watcher", {
    signature: lastActiveDocumentSignature,
  });
  activeDocumentPollInterval = setInterval(() => {
    const nextSignature = spreadCreation.getActiveDocumentSignature();
    if (nextSignature === lastActiveDocumentSignature) {
      return;
    }

    lastActiveDocumentSignature = nextSignature;
    refreshVisiblePanels().catch((error) => {
      console.error("Active document refresh failed:", error);
    });
  }, 1000);
}

async function refreshVisiblePanels() {
  console.log("[labelmaker] refreshing visible panels", {
    hasConfigPanel: Boolean(configPanelNode),
    hasLabelTablePanel: Boolean(labelTablePanelNode),
  });
  if (configPanelNode) {
    await updateConfigPanel(configPanelNode);
  }

  if (labelTablePanelNode) {
    await updateLabelTablePanel(labelTablePanelNode);
  }
}

function getElement(rootNode, selector) {
  if (!rootNode || !rootNode.querySelector) {
    return null;
  }

  return rootNode.querySelector(selector);
}

async function handleChooseJsonClick(rootNode) {
  const statusEl = getElement(rootNode, "#jsonStatus");
  const datasetStatusEl = getElement(rootNode, "#datasetStatus");
  const datasetSummaryEl = getElement(rootNode, "#datasetSummary");

  if (statusEl) {
    statusEl.textContent = "Status: choosing JSON file...";
  }
  if (datasetStatusEl) {
    datasetStatusEl.textContent = "Dataset: waiting for file selection";
  }
  if (datasetSummaryEl) {
    datasetSummaryEl.textContent = "Summary: waiting for file selection";
  }

  try {
    await fileManager.chooseJsonFile();
  } catch (err) {
    console.error("Choose JSON error:", err);
    if (statusEl) {
      statusEl.textContent = "Status: choose failed";
    }
    if (datasetStatusEl) {
      datasetStatusEl.textContent = `Dataset: error (${err.message})`;
    }
    if (datasetSummaryEl) {
      datasetSummaryEl.textContent = "Summary: load failed";
    }
  } finally {
    await refreshVisiblePanels();
  }
}

async function handleReloadJsonClick() {
  try {
    await fileManager.reloadJson();
  } catch (err) {
    console.error("Reload JSON error:", err);
  } finally {
    await refreshVisiblePanels();
  }
}

async function updateConfigPanel(rootNode) {
  const statusEl = getElement(rootNode, "#jsonStatus");
  const datasetStatusEl = getElement(rootNode, "#datasetStatus");
  const datasetSummaryEl = getElement(rootNode, "#datasetSummary");
  const documentStateSummaryEl = getElement(rootNode, "#documentStateSummary");
  const actionStatusEl = getElement(rootNode, "#actionStatus");
  const reloadButton = getElement(rootNode, "#reloadJson");

  if (!statusEl) {
    console.warn("[labelmaker] updateConfigPanel aborted because #jsonStatus was not found", describeNode(rootNode));
    return;
  }

  try {
    console.log("[labelmaker] updateConfigPanel running");
    lastActiveDocumentSignature = spreadCreation.getActiveDocumentSignature();
    statusEl.textContent = fileManager.getStatusString();
    if (datasetStatusEl) {
      datasetStatusEl.textContent = fileManager.getDatasetStatusString();
    }
    if (datasetSummaryEl) {
      datasetSummaryEl.textContent = fileManager.getDatasetSummaryString();
    }
    if (documentStateSummaryEl) {
      documentStateSummaryEl.textContent = fileManager.getDocumentStateSummaryString();
    }
    if (actionStatusEl && actionStatusEl.textContent.trim() === "") {
      actionStatusEl.textContent = "Action: none";
    }
    syncColumnVisibilityCheckboxes(rootNode);

    const token = fileManager.getLinkedJsonToken();
    if (reloadButton) {
      reloadButton.style.display = token ? "inline-block" : "none";
    }
  } catch (error) {
    console.error("updateConfigPanel failed:", error);
    statusEl.textContent = "Status: error";
    if (datasetStatusEl) {
      datasetStatusEl.textContent = "Dataset: unavailable";
    }
    if (datasetSummaryEl) {
      datasetSummaryEl.textContent = "Summary: unavailable";
    }
    if (documentStateSummaryEl) {
      documentStateSummaryEl.textContent = "Document state: unavailable";
    }
    if (actionStatusEl && actionStatusEl.textContent.trim() === "") {
      actionStatusEl.textContent = "Action: unavailable";
    }
    if (reloadButton) {
      reloadButton.style.display = "inline-block";
    }
  }
}

async function updateLabelTablePanel(rootNode) {
  const labelsTableHead = getElement(rootNode, "#labelsTableHead");
  const labelsTableBody = getElement(rootNode, "#labelsTableBody");
  if (!labelsTableHead || !labelsTableBody) {
    console.warn("[labelmaker] updateLabelTablePanel aborted because table head/body was not found", describeNode(rootNode));
    return;
  }

  try {
    console.log("[labelmaker] updateLabelTablePanel running");
    lastActiveDocumentSignature = spreadCreation.getActiveDocumentSignature();
    const parentSpreadNames = spreadCreation.listParentSpreadNames();
    console.log("[labelmaker] parent spreads enumerated", {
      count: parentSpreadNames.length,
      names: parentSpreadNames,
    });
    fileManager.reconcileMasterSpreads(parentSpreadNames);
    const displayLabels = fileManager.getDisplayLabels();
    console.log("[labelmaker] rendering labels table", {
      labelCount: displayLabels.length,
    });
    labelsTable.renderLabelsTable(labelsTableHead, labelsTableBody, displayLabels, parentSpreadNames, columnVisibility);
    bindMasterSpreadSelectHandlers(rootNode, parentSpreadNames);
    bindCreateLabelHandlers(rootNode);
    bindRefreshLabelHandlers(rootNode);
    bindDeleteLabelHandlers(rootNode);
    bindFindLabelHandlers(rootNode);
  } catch (error) {
    console.error("updateLabelTablePanel failed:", error);
    labelsTable.renderEmptyLabelsTable(labelsTableBody, "Unable to display labels.");
  }
}

function bindColumnVisibilityHandlers(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const checkboxes = rootNode.querySelectorAll(".columnVisibilityToggle");
  checkboxes.forEach((checkboxEl) => {
    checkboxEl.onchange = () => {
      handleColumnVisibilityChange(checkboxEl).catch((error) => {
        console.error("Column visibility change failed:", error);
      });
    };
  });
}

function bindMasterSpreadSelectHandlers(rootNode, parentSpreadNames) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const selects = rootNode.querySelectorAll(".masterSpreadSelect");
  selects.forEach((selectEl) => {
    selectEl.onchange = () => {
      handleMasterSpreadChange(selectEl, parentSpreadNames).catch((error) => {
        console.error("Master spread change failed:", error);
      });
    };
  });
}

function bindCreateLabelHandlers(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const buttons = rootNode.querySelectorAll(".createLabelButton");
  buttons.forEach((buttonEl) => {
    buttonEl.onclick = () => {
      handleCreateLabelClick(buttonEl).catch((error) => {
        console.error("Create label click failed:", error);
      });
    };
  });
}

function bindRefreshLabelHandlers(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const buttons = rootNode.querySelectorAll(".refreshLabelButton");
  buttons.forEach((buttonEl) => {
    buttonEl.onclick = () => {
      handleRefreshLabelClick(buttonEl).catch((error) => {
        console.error("Refresh label click failed:", error);
      });
    };
  });
}

function bindDeleteLabelHandlers(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const buttons = rootNode.querySelectorAll(".deleteLabelButton");
  buttons.forEach((buttonEl) => {
    buttonEl.onclick = () => {
      handleDeleteLabelClick(buttonEl).catch((error) => {
        console.error("Delete label click failed:", error);
      });
    };
  });
}

function bindFindLabelHandlers(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const buttons = rootNode.querySelectorAll(".findLabelButton");
  buttons.forEach((buttonEl) => {
    buttonEl.onclick = () => {
      handleFindLabelClick(buttonEl).catch((error) => {
        console.error("Find label click failed:", error);
      });
    };
  });
}

async function handleCreateLabelClick(buttonEl) {
  const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";
  if (!labelId) {
    throw new Error("Missing label id for create action.");
  }

  setConfigActionStatus("Action: creating label...");
  const result = fileManager.createLabel(labelId);
  setConfigActionStatus(`Action: created label on spread ${result.currentSpread} using ${result.masterSpread} and populated ${result.populatedFrameCount} text frame(s)`);
  await refreshVisiblePanels();
}

async function handleRefreshLabelClick(buttonEl) {
  const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";
  if (!labelId) {
    throw new Error("Missing label id for refresh action.");
  }

  setConfigActionStatus("Action: refreshing bound text frames...");
  const result = fileManager.refreshLabel(labelId);
  setConfigActionStatus(`Action: refreshed ${result.refreshedFrameCount} bound text frame(s) on spread ${result.currentSpread}`);
  await refreshVisiblePanels();
}

async function handleDeleteLabelClick(buttonEl) {
  const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";
  if (!labelId) {
    throw new Error("Missing label id for delete action.");
  }

  setConfigActionStatus("Action: deleting label spread...");
  const result = fileManager.deleteLabel(labelId);
  setConfigActionStatus(`Action: deleted spread ${result.deletedSpreadReference}`);
  await refreshVisiblePanels();
}

async function handleFindLabelClick(buttonEl) {
  const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";
  if (!labelId) {
    throw new Error("Missing label id for find action.");
  }

  setConfigActionStatus("Action: locating label spread...");
  const result = fileManager.findLabel(labelId);
  setConfigActionStatus(`Action: focused spread ${result.spreadReference}`);
  await refreshVisiblePanels();
}

async function handleMasterSpreadChange(selectEl, parentSpreadNames) {
  const labelId = selectEl ? selectEl.getAttribute("data-label-id") : "";
  const selectedValue = selectEl ? selectEl.value : "";

  if (!labelId) {
    throw new Error("Missing label id for master spread change.");
  }

  setConfigActionStatus("Action: saving master spread...");
  const availableNames = Array.isArray(parentSpreadNames) ? parentSpreadNames : [];
  const persistedValue = availableNames.includes(selectedValue) ? selectedValue : null;
  const savedValue = fileManager.setLabelMasterSpread(labelId, persistedValue);

  if (selectEl) {
    selectEl.value = savedValue || "";
  }

  setConfigActionStatus(savedValue
    ? `Action: saved master spread ${savedValue}`
    : "Action: cleared master spread");
  await refreshVisiblePanels();
}

async function handleColumnVisibilityChange(checkboxEl) {
  const columnKey = checkboxEl ? checkboxEl.getAttribute("data-column-key") : "";
  if (!columnKey || !Object.prototype.hasOwnProperty.call(columnVisibility, columnKey)) {
    throw new Error("Missing or invalid column key for visibility change.");
  }

  columnVisibility[columnKey] = Boolean(checkboxEl.checked);
  await refreshVisiblePanels();
}

function setConfigActionStatus(message) {
  const actionStatusEl = getElement(configPanelNode, "#actionStatus");
  if (actionStatusEl) {
    actionStatusEl.textContent = message;
  }
}

function createConfigPanelContent() {
  const panel = document.createElement("div");
  panel.className = "panelRoot";
  panel.innerHTML = `
    <div class="manageActions">
      <button id="chooseJson">Choose JSON File</button>
      <button id="reloadJson" style="display:none;">Reload JSON</button>
    </div>
    <div class="columnVisibilityGroup">
      <p>Visible columns</p>
      <label><input type="checkbox" class="columnVisibilityToggle" data-column-key="approval" checked="checked"> Approval</label>
      <label><input type="checkbox" class="columnVisibilityToggle" data-column-key="layoutStyle" checked="checked"> Layout Style</label>
      <label><input type="checkbox" class="columnVisibilityToggle" data-column-key="section"> Section</label>
      <label><input type="checkbox" class="columnVisibilityToggle" data-column-key="subSection"> Subsection</label>
      <label><input type="checkbox" class="columnVisibilityToggle" data-column-key="labelId"> Label ID</label>
    </div>
    <p id="jsonStatus">Status: unlinked</p>
    <p id="datasetStatus">Dataset: not loaded</p>
    <p id="datasetSummary">Summary: none</p>
    <p id="documentStateSummary">Document state: none</p>
    <p id="actionStatus">Action: none</p>
  `;
  return panel;
}

function createLabelTablePanelContent() {
  const panel = document.createElement("div");
  panel.className = "panelRoot labelsPanel";
  panel.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead id="labelsTableHead"></thead>
        <tbody id="labelsTableBody">
          <tr>
            <td class="emptyState" colspan="12">No labels loaded.</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  return panel;
}

function syncColumnVisibilityCheckboxes(rootNode) {
  if (!rootNode || !rootNode.querySelectorAll) {
    return;
  }

  const checkboxes = rootNode.querySelectorAll(".columnVisibilityToggle");
  checkboxes.forEach((checkboxEl) => {
    const columnKey = checkboxEl.getAttribute("data-column-key");
    if (columnKey && Object.prototype.hasOwnProperty.call(columnVisibility, columnKey)) {
      checkboxEl.checked = Boolean(columnVisibility[columnKey]);
    }
  });
}

function describePanelArg(panelArg) {
  if (!panelArg) {
    return { kind: "missing" };
  }

  return {
    kind: typeof panelArg,
    hasNodeProperty: Boolean(panelArg.node),
    tagName: panelArg.tagName || null,
    nodeTagName: panelArg.node && panelArg.node.tagName ? panelArg.node.tagName : null,
    hasAppendChild: typeof panelArg.appendChild === "function",
    hasQuerySelector: typeof panelArg.querySelector === "function",
  };
}

function describeNode(node) {
  if (!node) {
    return { kind: "missing" };
  }

  return {
    tagName: node.tagName || null,
    childElementCount: typeof node.childElementCount === "number" ? node.childElementCount : null,
    templateMarker: typeof node.getAttribute === "function" ? node.getAttribute("data-panel-template") : null,
  };
}
