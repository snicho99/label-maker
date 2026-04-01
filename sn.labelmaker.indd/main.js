const { entrypoints } = require("uxp");
const { app } = require("indesign");
const fileManager = require("./fileManager");
let panelInitialized = false;
let afterActivateRegistered = false;

entrypoints.setup({

  commands: {
    showAlert: () => showAlert()
  },
  panels: {
    showPanel: {
      async show({node} = {}) {
        console.log("Panel shown, node:", node);
        if (!panelInitialized) {
          const chooseButton = document.querySelector("#chooseJson");
          if (chooseButton) {
            chooseButton.addEventListener("click", async () => {
              try {
                await fileManager.chooseJsonFile();
              } catch (err) {
                console.error("Choose JSON error:", err);
              } finally {
                await updateStatus();
              }
            });
          }

          const reloadButton = document.querySelector("#reloadJson");
          if (reloadButton) {
            reloadButton.addEventListener("click", async () => {
              try {
                await fileManager.reloadJson();
              } catch (err) {
                console.error("Reload JSON error:", err);
              } finally {
                await updateStatus();
              }
            });
          }

          panelInitialized = true;
        }

        if (!afterActivateRegistered && app && app.eventListeners) {
          try {
            app.eventListeners.add("afterActivate", async () => {
              console.log("Document activated, refreshing status");
              await updateStatus();
            });
            afterActivateRegistered = true;
          } catch (e) {
            console.warn("Unable to add afterActivate listener:", e);
          }
        }

        await updateStatus();
      }
    }
  }
});

showAlert = () => {
    const dialog = app.dialogs.add();
    const col = dialog.dialogColumns.add();
    const colText = col.staticTexts.add();
    colText.staticLabel = "Congratulations! You just executed your first command.";
    console.log("first text");  
    dialog.canCancel = false;
    dialog.show();
    dialog.destroy();
    return;
}



async function updateStatus() {
    const statusEl = document.querySelector("#jsonStatus");
    const datasetStatusEl = document.querySelector("#datasetStatus");
    const reloadButton = document.querySelector("#reloadJson");

    if (!statusEl) {
        console.warn("Status element not found");
        return;
    }

    try {
        statusEl.textContent = fileManager.getStatusString();
        if (datasetStatusEl) {
            datasetStatusEl.textContent = fileManager.getDatasetStatusString();
        }
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
        if (reloadButton) {
            reloadButton.style.display = "inline-block";
        }
    }
}

async function reloadJson() {
    try {
        await fileManager.reloadJson();
        await updateStatus();
    } catch (e) {
        console.error("reloadJson failed:", e);
        const statusEl = document.querySelector("#jsonStatus");
        const datasetStatusEl = document.querySelector("#datasetStatus");
        if (statusEl) {
            statusEl.textContent = "Status: error";
        }
        if (datasetStatusEl) {
            datasetStatusEl.textContent = "Dataset: unavailable";
        }
    }
}
