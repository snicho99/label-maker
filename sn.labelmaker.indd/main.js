const { entrypoints } = require("uxp");
const { app } = require("indesign");
const fileManager = require("./fileManager");
const labelsTable = require("./labelsTable");
let currentPanelNode = null;

entrypoints.setup({

  commands: {
    showAlert: () => showAlert()
  },
  panels: {
    showPanel: {
      async show({node} = {}) {
        console.log("Panel shown, node:", node);
        currentPanelNode = node || document;
        initializeUi(currentPanelNode);
        await updateStatus(currentPanelNode);
      }
    }
  }
});

function showAlert() {
    const dialog = app.dialogs.add();
    const col = dialog.dialogColumns.add();
    const colText = col.staticTexts.add();
    colText.staticLabel = "Congratulations! You just executed your first command.";
    dialog.canCancel = false;
    dialog.show();
    dialog.destroy();
    return;
}

function initializeUi(rootNode) {
    initializeTabs(rootNode);

    const chooseButton = rootNode.querySelector("#chooseJson");
    if (chooseButton) {
        chooseButton.onclick = () => {
            handleChooseJsonClick(rootNode).catch((error) => {
                console.error("Choose JSON click handler failed:", error);
            });
        };
    } else {
        console.warn("Choose JSON button not found during UI init");
    }

    const reloadButton = rootNode.querySelector("#reloadJson");
    if (reloadButton) {
        reloadButton.onclick = () => {
            handleReloadJsonClick(rootNode).catch((error) => {
                console.error("Reload JSON click handler failed:", error);
            });
        };
    } else {
        console.warn("Reload JSON button not found during UI init");
    }

    const applyLoadedChangesButton = rootNode.querySelector("#applyLoadedChanges");
    if (applyLoadedChangesButton) {
        applyLoadedChangesButton.onclick = () => {
            handleApplyLoadedChangesClick(rootNode).catch((error) => {
                console.error("Apply Loaded Changes click handler failed:", error);
            });
        };
    } else {
        console.warn("Apply Loaded Changes button not found during UI init");
    }
}

function initializeTabs(rootNode) {
    const tabButtons = rootNode.querySelectorAll("[data-tab-target]");
    tabButtons.forEach((button) => {
        button.onclick = () => {
            const target = button.getAttribute("data-tab-target");
            activateTab(rootNode, target);
        };
    });

    activateTab(rootNode, "manageTab");
}

function activateTab(rootNode, targetId) {
    const tabButtons = rootNode.querySelectorAll("[data-tab-target]");
    const tabPanels = rootNode.querySelectorAll("[data-tab-panel]");

    tabButtons.forEach((button) => {
        const isActive = button.getAttribute("data-tab-target") === targetId;
        button.classList.toggle("active", isActive);
    });

    tabPanels.forEach((panel) => {
        const isActive = panel.id === targetId;
        panel.style.display = isActive ? "block" : "none";
    });
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
        await updateStatus(rootNode);
    }
}

async function handleReloadJsonClick(rootNode) {
    try {
        await fileManager.reloadJson();
    } catch (err) {
        console.error("Reload JSON error:", err);
    } finally {
        await updateStatus(rootNode);
    }
}

async function handleApplyLoadedChangesClick(rootNode) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: applying loaded changes...";
    }

    try {
        const result = await fileManager.applyLoadedChanges();
        if (actionStatusEl) {
            actionStatusEl.textContent = `Action: ${result.createdCount} created, ${result.updatedCount} updated, ${result.unchangedCount} unchanged`;
        }
    } catch (err) {
        console.error("Apply Loaded Changes error:", err);
        if (actionStatusEl) {
            actionStatusEl.textContent = `Action: error (${err.message})`;
        }
    } finally {
        await updateStatus(rootNode);
    }
}

async function updateStatus(rootNode = currentPanelNode || document) {
    const statusEl = getElement(rootNode, "#jsonStatus");
    const datasetStatusEl = getElement(rootNode, "#datasetStatus");
    const datasetSummaryEl = getElement(rootNode, "#datasetSummary");
    const documentStateSummaryEl = getElement(rootNode, "#documentStateSummary");
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelsTableBody = getElement(rootNode, "#labelsTableBody");
    const reloadButton = getElement(rootNode, "#reloadJson");
    const applyLoadedChangesButton = getElement(rootNode, "#applyLoadedChanges");

    if (!statusEl) {
        console.warn("Status element not found");
        return;
    }

    try {
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
        labelsTable.renderLabelsTable(labelsTableBody, fileManager.getDisplayLabels());
        const token = fileManager.getLinkedJsonToken();
        const parsedDataset = fileManager.getParsedDataset();

        if (reloadButton) {
            reloadButton.style.display = token ? "inline-block" : "none";
        }
        if (applyLoadedChangesButton) {
            applyLoadedChangesButton.style.display = parsedDataset ? "inline-block" : "none";
        }
    } catch (e) {
        console.error("updateStatus failed:", e);
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
        labelsTable.renderEmptyLabelsTable(labelsTableBody, "Unable to display labels.");
        if (reloadButton) {
            reloadButton.style.display = "inline-block";
        }
        if (applyLoadedChangesButton) {
            applyLoadedChangesButton.style.display = "none";
        }
    }
}
