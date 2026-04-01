function renderLabelsTable(tableBody, labels) {
  if (!tableBody) {
    return;
  }

  if (!Array.isArray(labels) || labels.length === 0) {
    renderEmptyLabelsTable(tableBody, "No labels loaded.");
    return;
  }

  const rowsHtml = labels.map((label) => {
    const name = escapeHtml(label.labelName);
    const layoutStyle = escapeHtml(label.layoutStyle);
    const productionStatus = escapeHtml(label.productionStatus);
    const changeStatus = escapeHtml(label.changeStatus);
    const createdAt = escapeHtml(formatTimestamp(label.createdAt));
    const updatedAt = escapeHtml(formatTimestamp(label.updatedAt));

    return `<tr><td>${name}</td><td>${layoutStyle}</td><td>${productionStatus}</td><td>${changeStatus}</td><td>${createdAt}</td><td>${updatedAt}</td></tr>`;
  }).join("");

  tableBody.innerHTML = rowsHtml;
}

function renderEmptyLabelsTable(tableBody, message) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `<tr><td class="emptyState" colspan="6">${escapeHtml(message)}</td></tr>`;
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
