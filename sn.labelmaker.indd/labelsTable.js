const OPTIONAL_COLUMN_KEYS = {
  approval: "approval",
  layoutStyle: "layoutStyle",
  section: "section",
  subSection: "subSection",
  labelId: "labelId",
};

function renderLabelsTable(tableHead, tableBody, labels, parentSpreadNames = [], visibleColumns = {}) {
  if (!tableHead || !tableBody) {
    return;
  }

  const columns = getColumnDefinitions(parentSpreadNames, visibleColumns);
  renderTableHeader(tableHead, columns);

  if (!Array.isArray(labels) || labels.length === 0) {
    renderEmptyLabelsTable(tableBody, "No labels loaded.", columns.length);
    return;
  }

  const parentSpreadNameSet = new Set(parentSpreadNames);

  const rowsHtml = labels.map((label) => {
    const cellsHtml = columns.map((column) => renderCell(column, label, parentSpreadNameSet, parentSpreadNames)).join("");
    return `<tr>${cellsHtml}</tr>`;
  }).join("");

  tableBody.innerHTML = rowsHtml;
}

function renderTableHeader(tableHead, columns) {
  if (!tableHead) {
    return;
  }

  const headersHtml = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  tableHead.innerHTML = `<tr>${headersHtml}</tr>`;
}

function renderEmptyLabelsTable(tableBody, message, columnCount = 12) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `<tr><td class="emptyState" colspan="${columnCount}">${escapeHtml(message)}</td></tr>`;
}

function getColumnDefinitions(parentSpreadNames, visibleColumns) {
  const columns = [];

  if (isColumnVisible(visibleColumns, OPTIONAL_COLUMN_KEYS.section)) {
    columns.push({ key: "section", label: "Section" });
  }

  if (isColumnVisible(visibleColumns, OPTIONAL_COLUMN_KEYS.subSection)) {
    columns.push({ key: "subSection", label: "Subsection" });
  }

  if (isColumnVisible(visibleColumns, OPTIONAL_COLUMN_KEYS.labelId)) {
    columns.push({ key: "labelId", label: "ID" });
  }

  columns.push({ key: "name", label: "Name" });

  if (isColumnVisible(visibleColumns, OPTIONAL_COLUMN_KEYS.approval)) {
    columns.push({ key: "approval", label: "Approval" });
  }

  columns.push(
    { key: "status", label: "Status" },
    { key: "created", label: "Created" },
    { key: "updated", label: "Updated" }
  );

  if (isColumnVisible(visibleColumns, OPTIONAL_COLUMN_KEYS.layoutStyle)) {
    columns.push({
      key: "layoutStyle",
      label: "Layout Style",
      classNameFor: (label, parentSpreadNameSet) => parentSpreadNameSet.has(label.layoutStyle) ? "layoutStyleMatch" : "",
    });
  }

  columns.push(
    {
      key: "masterSpread",
      label: "Master Spread",
      render: (label) => renderMasterSpreadSelect(label, parentSpreadNames),
    },
    {
      key: "create",
      label: "Create",
      render: (label) => renderCreateButton(label),
    },
    {
      key: "refresh",
      label: "Refresh",
      render: (label) => renderRefreshButton(label),
    },
    {
      key: "find",
      label: "Find",
      render: (label) => renderFindButton(label),
    },
    { key: "currentSpread", label: "#" },
    {
      key: "delete",
      label: "Delete",
      render: (label) => renderDeleteButton(label),
    }
  );

  return columns;
}

function renderCell(column, label, parentSpreadNameSet, parentSpreadNames) {
  const className = typeof column.classNameFor === "function"
    ? column.classNameFor(label, parentSpreadNameSet, parentSpreadNames)
    : "";
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";

  if (typeof column.render === "function") {
    return `<td${classAttribute}>${column.render(label, parentSpreadNames)}</td>`;
  }

  return `<td${classAttribute}>${escapeHtml(getColumnValue(column.key, label))}</td>`;
}

function getColumnValue(columnKey, label) {
  switch (columnKey) {
    case "name":
      return label.labelName;
    case "labelId":
      return label.labelId;
    case "approval":
      return label.productionStatus;
    case "status":
      return label.changeStatus;
    case "created":
      return formatTimestamp(label.createdAt);
    case "updated":
      return formatTimestamp(label.updatedAt);
    case "layoutStyle":
      return label.layoutStyle;
    case "section":
      return label.section || "";
    case "subSection":
      return label.subSection || "";
    case "currentSpread":
      return label.currentSpread || "";
    default:
      return "";
  }
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

function isColumnVisible(visibleColumns, columnKey) {
  return visibleColumns && visibleColumns[columnKey] === true;
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
  OPTIONAL_COLUMN_KEYS,
  renderLabelsTable,
  renderEmptyLabelsTable,
};
