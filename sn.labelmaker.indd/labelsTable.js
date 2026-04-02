function renderLabelsTable(tableBody, labels, parentSpreadNames = []) {
  if (!tableBody) {
    return;
  }

  if (!Array.isArray(labels) || labels.length === 0) {
    renderEmptyLabelsTable(tableBody, "No labels loaded.");
    return;
  }

  const parentSpreadNameSet = new Set(parentSpreadNames);

  const rowsHtml = labels.map((label) => {
    const name = escapeHtml(label.labelName);
    const layoutStyle = escapeHtml(label.layoutStyle);
    const productionStatus = escapeHtml(label.productionStatus);
    const changeStatus = escapeHtml(label.changeStatus);
    const createdAt = escapeHtml(formatTimestamp(label.createdAt));
    const updatedAt = escapeHtml(formatTimestamp(label.updatedAt));
    const currentSpread = escapeHtml(label.currentSpread || "");
    const layoutStyleClass = parentSpreadNameSet.has(label.layoutStyle)
      ? "layoutStyleMatch"
      : "";
    const masterSpreadSelect = renderMasterSpreadSelect(label, parentSpreadNames);
    const createButton = renderCreateButton(label);
    const refreshButton = renderRefreshButton(label);
    const deleteButton = renderDeleteButton(label);
    const findButton = renderFindButton(label);

    return `<tr><td>${name}</td><td class="${layoutStyleClass}">${layoutStyle}</td><td>${productionStatus}</td><td>${changeStatus}</td><td>${createdAt}</td><td>${updatedAt}</td><td>${currentSpread}</td><td>${masterSpreadSelect}</td><td>${createButton}</td><td>${refreshButton}</td><td>${deleteButton}</td><td>${findButton}</td></tr>`;
  }).join("");

  tableBody.innerHTML = rowsHtml;
}

function renderCreateButton(label) {
  const hasMasterSpread = typeof label.masterSpread === "string" && label.masterSpread.trim() !== "";
  if (!hasMasterSpread) {
    return "";
  }

  return `<button class="createLabelButton" data-label-id="${escapeHtml(label.labelId)}">Create</button>`;
}

function renderDeleteButton(label) {
  const hasCurrentSpread = typeof label.currentSpread === "string" && label.currentSpread.trim() !== "";
  if (!hasCurrentSpread) {
    return "";
  }

  return `<button class="deleteLabelButton" data-label-id="${escapeHtml(label.labelId)}">Delete</button>`;
}

function renderRefreshButton(label) {
  const hasCurrentSpread = typeof label.currentSpread === "string" && label.currentSpread.trim() !== "";
  if (!hasCurrentSpread) {
    return "";
  }

  return `<button class="refreshLabelButton" data-label-id="${escapeHtml(label.labelId)}">Refresh</button>`;
}

function renderFindButton(label) {
  const hasCurrentSpread = typeof label.currentSpread === "string" && label.currentSpread.trim() !== "";
  if (!hasCurrentSpread) {
    return "";
  }

  return `<button class="findLabelButton" data-label-id="${escapeHtml(label.labelId)}">Find</button>`;
}

function renderMasterSpreadSelect(label, parentSpreadNames) {
  const selectedValue = typeof label.masterSpread === "string" ? label.masterSpread : "";
  const options = ['<option value="">None</option>']
    .concat(parentSpreadNames.map((name) => {
      const isSelected = name === selectedValue ? ' selected="selected"' : "";
      return `<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`;
    }))
    .join("");

  return `<select class="masterSpreadSelect" data-label-id="${escapeHtml(label.labelId)}">${options}</select>`;
}

function renderEmptyLabelsTable(tableBody, message) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `<tr><td class="emptyState" colspan="12">${escapeHtml(message)}</td></tr>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestamp(value) {
  if (!value) {
    return "Not created";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Invalid date";
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 10) {
    return "just now";
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} sec ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return `${diffWeeks} wk ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} mo ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} yr ago`;
}

module.exports = {
  renderLabelsTable,
  renderEmptyLabelsTable,
};
