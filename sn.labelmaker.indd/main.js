const { entrypoints } = require("uxp");
const { app } = require("indesign");
const fileManager = require("./fileManager");
const labelsTable = require("./labelsTable");
const spreadCreation = require("./spreadCreation");
let currentPanelNode = null;
let activeDocumentPollInterval = null;
let lastActiveDocumentSignature = "no-document";

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
        startActiveDocumentWatcher();
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

}

function startActiveDocumentWatcher() {
    if (activeDocumentPollInterval) {
        return;
    }

    lastActiveDocumentSignature = spreadCreation.getActiveDocumentSignature();
    activeDocumentPollInterval = setInterval(() => {
        const nextSignature = spreadCreation.getActiveDocumentSignature();
        if (nextSignature === lastActiveDocumentSignature) {
            return;
        }

        lastActiveDocumentSignature = nextSignature;
        updateStatus(currentPanelNode).catch((error) => {
            console.error("Active document refresh failed:", error);
        });
    }, 1000);
}

function initializeTabs(rootNode) {
    const tabButtons = rootNode.querySelectorAll("[data-tab-target]");
    tabButtons.forEach((button) => {
        button.onclick = () => {
            const target = button.getAttribute("data-tab-target");
            activateTab(rootNode, target);
            if (target === "labelsTab") {
                updateStatus(rootNode).catch((error) => {
                    console.error("Labels tab refresh failed:", error);
                });
            }
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

async function updateStatus(rootNode = currentPanelNode || document) {
    const statusEl = getElement(rootNode, "#jsonStatus");
    const datasetStatusEl = getElement(rootNode, "#datasetStatus");
    const datasetSummaryEl = getElement(rootNode, "#datasetSummary");
    const documentStateSummaryEl = getElement(rootNode, "#documentStateSummary");
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelsTableBody = getElement(rootNode, "#labelsTableBody");
    const reloadButton = getElement(rootNode, "#reloadJson");

    if (!statusEl) {
        console.warn("Status element not found");
        return;
    }

    try {
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
        const parentSpreadNames = spreadCreation.listParentSpreadNames();
        fileManager.reconcileMasterSpreads(parentSpreadNames);
        labelsTable.renderLabelsTable(labelsTableBody, fileManager.getDisplayLabels(), parentSpreadNames);
        bindMasterSpreadSelectHandlers(rootNode, parentSpreadNames);
        bindCreateLabelHandlers(rootNode);
        bindRefreshLabelHandlers(rootNode);
        bindDeleteLabelHandlers(rootNode);
        bindFindLabelHandlers(rootNode);
        const token = fileManager.getLinkedJsonToken();

        if (reloadButton) {
            reloadButton.style.display = token ? "inline-block" : "none";
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
    }
}

function bindMasterSpreadSelectHandlers(rootNode, parentSpreadNames) {
    if (!rootNode || !rootNode.querySelectorAll) {
        return;
    }

    const selects = rootNode.querySelectorAll(".masterSpreadSelect");
    selects.forEach((selectEl) => {
        selectEl.onchange = () => {
            handleMasterSpreadChange(rootNode, selectEl, parentSpreadNames).catch((error) => {
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
            handleCreateLabelClick(rootNode, buttonEl).catch((error) => {
                console.error("Create label click failed:", error);
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
            handleDeleteLabelClick(rootNode, buttonEl).catch((error) => {
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
            handleFindLabelClick(rootNode, buttonEl).catch((error) => {
                console.error("Find label click failed:", error);
            });
        };
    });
}

async function handleCreateLabelClick(rootNode, buttonEl) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";

    if (!labelId) {
        throw new Error("Missing label id for create action.");
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: creating label...";
    }

    const result = fileManager.createLabel(labelId);

    if (actionStatusEl) {
        actionStatusEl.textContent = `Action: created label on spread ${result.currentSpread} using ${result.masterSpread} and populated ${result.populatedFrameCount} text frame(s)`;
    }

    await updateStatus(rootNode);
}

function bindRefreshLabelHandlers(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) {
        return;
    }

    const buttons = rootNode.querySelectorAll(".refreshLabelButton");
    buttons.forEach((buttonEl) => {
        buttonEl.onclick = () => {
            handleRefreshLabelClick(rootNode, buttonEl).catch((error) => {
                console.error("Refresh label click failed:", error);
            });
        };
    });
}

async function handleDeleteLabelClick(rootNode, buttonEl) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";

    if (!labelId) {
        throw new Error("Missing label id for delete action.");
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: deleting label spread...";
    }

    const result = fileManager.deleteLabel(labelId);

    if (actionStatusEl) {
        actionStatusEl.textContent = `Action: deleted spread ${result.deletedSpreadReference}`;
    }

    await updateStatus(rootNode);
}

async function handleRefreshLabelClick(rootNode, buttonEl) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";

    if (!labelId) {
        throw new Error("Missing label id for refresh action.");
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: refreshing bound text frames...";
    }

    const result = fileManager.refreshLabel(labelId);

    if (actionStatusEl) {
        actionStatusEl.textContent = `Action: refreshed ${result.refreshedFrameCount} bound text frame(s) on spread ${result.currentSpread}`;
    }

    await updateStatus(rootNode);
}

async function handleFindLabelClick(rootNode, buttonEl) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelId = buttonEl ? buttonEl.getAttribute("data-label-id") : "";

    if (!labelId) {
        throw new Error("Missing label id for find action.");
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: locating label spread...";
    }

    const result = fileManager.findLabel(labelId);

    if (actionStatusEl) {
        actionStatusEl.textContent = `Action: focused spread ${result.spreadReference}`;
    }

    await updateStatus(rootNode);
}

async function handleMasterSpreadChange(rootNode, selectEl, parentSpreadNames) {
    const actionStatusEl = getElement(rootNode, "#actionStatus");
    const labelId = selectEl ? selectEl.getAttribute("data-label-id") : "";
    const selectedValue = selectEl ? selectEl.value : "";

    if (!labelId) {
        throw new Error("Missing label id for master spread change.");
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = "Action: saving master spread...";
    }

    const availableNames = Array.isArray(parentSpreadNames) ? parentSpreadNames : [];
    const persistedValue = availableNames.includes(selectedValue) ? selectedValue : null;
    const savedValue = fileManager.setLabelMasterSpread(labelId, persistedValue);

    if (selectEl) {
        selectEl.value = savedValue || "";
    }

    if (actionStatusEl) {
        actionStatusEl.textContent = savedValue
            ? `Action: saved master spread ${savedValue}`
            : "Action: cleared master spread";
    }

    await updateStatus(rootNode);
}
