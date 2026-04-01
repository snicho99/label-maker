function renderLabelsTable(tableBody, dataset) {
  if (!tableBody) {
    return;
  }

  if (!dataset || !Array.isArray(dataset.labels) || dataset.labels.length === 0) {
    renderEmptyLabelsTable(tableBody, "No labels loaded.");
    return;
  }

  const rowsHtml = dataset.labels.map((label) => {
    const name = escapeHtml(label.meta.labelName);
    const layoutStyle = escapeHtml(label.meta.layoutStyle);
    const productionStatus = escapeHtml(label.meta.productionStatus);

    return `<tr><td>${name}</td><td>${layoutStyle}</td><td>${productionStatus}</td></tr>`;
  }).join("");

  tableBody.innerHTML = rowsHtml;
}

function renderEmptyLabelsTable(tableBody, message) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `<tr><td class="emptyState" colspan="3">${escapeHtml(message)}</td></tr>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  renderLabelsTable,
  renderEmptyLabelsTable,
};
