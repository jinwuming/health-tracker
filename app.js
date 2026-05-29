const STORAGE_KEY = "health-tracker-records-v1";
const WELCOME_STORAGE_KEY = "health-tracker-welcome-date";

const form = document.querySelector("#entryForm");
const dateInput = document.querySelector("#dateInput");
const heightInput = document.querySelector("#heightInput");
const weightInput = document.querySelector("#weightInput");
const exerciseSelect = document.querySelector("#exerciseSelect");
const customExerciseInput = document.querySelector("#customExerciseInput");
const addCustomExerciseButton = document.querySelector("#addCustomExerciseButton");
const selectedExercises = document.querySelector("#selectedExercises");
const exerciseEmpty = document.querySelector("#exerciseEmpty");
const noteInput = document.querySelector("#noteInput");
const recordsBody = document.querySelector("#recordsBody");
const emptyState = document.querySelector("#emptyState");
const chart = document.querySelector("#chart");
const clearButton = document.querySelector("#clearButton");
const latestWeight = document.querySelector("#latestWeight");
const bmiValue = document.querySelector("#bmiValue");
const bmiStatus = document.querySelector("#bmiStatus");
const bmiNote = document.querySelector("#bmiNote");
const todayExercise = document.querySelector("#todayExercise");
const todayLabel = document.querySelector("#todayLabel");
const welcomeOverlay = document.querySelector("#welcomeOverlay");
const welcomeCloseButton = document.querySelector("#welcomeCloseButton");
const segments = document.querySelectorAll(".segment");
const appTabs = document.querySelectorAll(".app-tab");
const viewPanels = document.querySelectorAll(".view-panel");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

let activeChart = "weight";
let records = loadRecords();

const today = new Date();
const todayKey = formatDateKey(today);
dateInput.value = todayKey;
todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(today);
heightInput.value = getLatestHeight(records) || "";
showDailyWelcome();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    date: dateInput.value,
    height: toNumber(heightInput.value),
    weight: toNumber(weightInput.value),
    exercises: getExerciseEntries(),
    note: noteInput.value.trim(),
  };
  record.exercise = getExerciseTotal(record.exercises);

  if (!record.height && !record.weight && !record.exercise && !record.note) {
    return;
  }

  records = upsertRecord(records, record);
  saveRecords(records);
  form.reset();
  clearSelectedExercises();
  dateInput.value = todayKey;
  heightInput.value = getLatestHeight(records) || "";
  render();
});

exerciseSelect.addEventListener("change", () => {
  addExerciseRow(exerciseSelect.value);
  exerciseSelect.value = "";
});

addCustomExerciseButton.addEventListener("click", () => {
  const type = customExerciseInput.value.trim();
  addExerciseRow(type);
  customExerciseInput.value = "";
});

clearButton.addEventListener("click", () => {
  if (!records.length) {
    return;
  }

  const confirmed = window.confirm("确定清空全部记录吗？");
  if (!confirmed) {
    return;
  }

  records = [];
  saveRecords(records);
  heightInput.value = "";
  render();
});

segments.forEach((button) => {
  button.addEventListener("click", () => {
    activeChart = button.dataset.chart;
    segments.forEach((item) => item.classList.toggle("active", item === button));
    renderChart(records);
  });
});

appTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.view;
    appTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    viewPanels.forEach((panel) => {
      const active = panel.id === targetId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  });
});

welcomeCloseButton.addEventListener("click", closeDailyWelcome);

welcomeOverlay.addEventListener("click", (event) => {
  if (event.target === welcomeOverlay) {
    closeDailyWelcome();
  }
});

render();

function showDailyWelcome() {
  if (localStorage.getItem(WELCOME_STORAGE_KEY) === todayKey) {
    return;
  }

  welcomeOverlay.hidden = false;
  welcomeCloseButton.focus();
}

function closeDailyWelcome() {
  localStorage.setItem(WELCOME_STORAGE_KEY, todayKey);
  welcomeOverlay.hidden = true;
  dateInput.focus();
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(nextRecords) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
}

function upsertRecord(existing, record) {
  const filtered = existing.filter((item) => item.date !== record.date);
  return [...filtered, record].sort((a, b) => b.date.localeCompare(a.date));
}

function render() {
  renderSummary(records);
  renderTable(records);
  renderChart(records);
}

function renderSummary(source) {
  const newestWeight = source.find((item) => item.weight);
  const latestHeight = getLatestHeight(source);
  const todayRecord = source.find((item) => item.date === todayKey);
  const bmi = newestWeight && latestHeight ? calculateBmi(newestWeight.weight, latestHeight) : null;
  const status = bmi ? getBmiStatus(bmi) : null;

  latestWeight.textContent = newestWeight ? newestWeight.weight.toFixed(1) : "--";
  bmiValue.textContent = bmi ? bmi.toFixed(1) : "--";
  bmiStatus.textContent = status ? status.label : "待录入";
  bmiNote.textContent = status
    ? `按中国成人 BMI 标准：${status.label}。身高 ${latestHeight} cm 的标准体重约 ${getStandardWeightRange(latestHeight)} kg。`
    : "录入身高和体重后，会按 BMI 判断体重是否标准。";
  todayExercise.textContent = todayRecord?.exercise ? String(todayRecord.exercise) : "0";
}

function renderTable(source) {
  recordsBody.innerHTML = "";
  emptyState.classList.toggle("show", source.length === 0);

  source.forEach((record) => {
    const row = document.createElement("tr");
    const bmi = record.weight && record.height ? calculateBmi(record.weight, record.height) : null;
    const exercises = normalizeExercises(record);
    row.innerHTML = `
      <td data-label="日期">${formatDisplayDate(record.date)}</td>
      <td data-label="身高">${record.height ? `${record.height.toFixed(1)} cm` : "--"}</td>
      <td data-label="体重">${record.weight ? `${record.weight.toFixed(1)} kg` : "--"}</td>
      <td data-label="BMI">${bmi ? `${bmi.toFixed(1)} ${getBmiStatus(bmi).label}` : "--"}</td>
      <td data-label="运动">${renderExerciseBox(exercises, record.exercise)}</td>
      <td data-label="备注">${escapeHtml(record.note) || "--"}</td>
    `;
    recordsBody.append(row);
  });
}

function renderChart(source) {
  chart.innerHTML = "";
  const data = source
    .slice()
    .reverse()
    .filter((item) => item[activeChart])
    .slice(-10);

  if (!data.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state show";
    empty.textContent = "暂无可显示的数据。";
    chart.append(empty);
    return;
  }

  const values = data.map((item) => item[activeChart]);
  const min = activeChart === "weight" ? Math.min(...values) : 0;
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const width = 320;
  const height = 150;
  const padding = { top: 18, right: 14, bottom: 26, left: 14 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const color = activeChart === "exercise" ? "#bd5542" : "#2f7d4a";
  const points = data.map((record, index) => {
    const x = padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const ratio = activeChart === "weight" ? (record[activeChart] - min) / range : record[activeChart] / max;
    const y = padding.top + plotHeight - Math.max(0, Math.min(1, ratio)) * plotHeight;
    return { x, y, record, value: record[activeChart] };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");

  chart.innerHTML = `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势折线图">
      <polyline class="line-chart-path" points="${pointString}" fill="none" stroke="${color}" />
      ${points.map((point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"></circle>
          <text class="line-value" x="${point.x}" y="${point.y - 8}" text-anchor="middle">${formatChartValue(point.value)}</text>
          <text class="line-date" x="${point.x}" y="${height - 7}" text-anchor="middle">${point.record.date.slice(5)}</text>
        </g>
      `).join("")}
    </svg>
  `;
}

function getExerciseEntries() {
  return Array.from(selectedExercises.querySelectorAll('input[name="exerciseMinutes"]'))
    .map((input) => ({
      type: input.dataset.type,
      minutes: toNumber(input.value),
    }))
    .filter((item) => item.minutes);
}

function addExerciseRow(type) {
  if (!type || hasExerciseRow(type)) {
    return;
  }

  exerciseEmpty.hidden = true;

  const row = document.createElement("div");
  row.className = "selected-exercise-row";
  row.dataset.type = type;

  const name = document.createElement("span");
  name.textContent = type;

  const minutes = document.createElement("input");
  minutes.type = "number";
  minutes.name = "exerciseMinutes";
  minutes.dataset.type = type;
  minutes.min = "0";
  minutes.max = "1440";
  minutes.step = "1";
  minutes.placeholder = "分钟";
  minutes.setAttribute("aria-label", `${type} 分钟`);

  const remove = document.createElement("button");
  remove.className = "mini-icon-button";
  remove.type = "button";
  remove.title = `移除${type}`;
  remove.setAttribute("aria-label", `移除${type}`);
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    row.remove();
    syncExerciseEmpty();
  });

  row.append(name, minutes, remove);
  selectedExercises.append(row);
  minutes.focus();
}

function hasExerciseRow(type) {
  return Array.from(selectedExercises.querySelectorAll(".selected-exercise-row"))
    .some((row) => row.dataset.type === type);
}

function clearSelectedExercises() {
  selectedExercises.querySelectorAll(".selected-exercise-row").forEach((row) => row.remove());
  exerciseSelect.value = "";
  syncExerciseEmpty();
}

function syncExerciseEmpty() {
  exerciseEmpty.hidden = Boolean(selectedExercises.querySelector(".selected-exercise-row"));
}

function normalizeExercises(record) {
  if (Array.isArray(record.exercises)) {
    return record.exercises.filter((item) => item.type && item.minutes);
  }
  if (Array.isArray(record.exerciseTypes)) {
    return record.exerciseTypes.map((type) => ({ type, minutes: null }));
  }
  if (record.exerciseType) {
    return [{ type: record.exerciseType, minutes: record.exercise || null }];
  }
  return [];
}

function getExerciseTotal(exercises) {
  return exercises.reduce((sum, item) => sum + item.minutes, 0) || null;
}

function renderExerciseBox(exercises, fallbackTotal) {
  const total = getExerciseTotal(exercises) || fallbackTotal;
  if (!exercises.length && !total) {
    return "--";
  }

  const lines = exercises.map((item) => {
    const minutes = item.minutes ? `${item.minutes}分钟` : "已记录";
    return `<span>${escapeHtml(item.type)} ${minutes}</span>`;
  });
  lines.push(`<strong>总时长 ${total}分钟</strong>`);
  return `<div class="exercise-box">${lines.join("")}</div>`;
}

function calculateBmi(weight, heightCm) {
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
}

function getBmiStatus(bmi) {
  if (bmi < 18.5) {
    return { label: "偏瘦" };
  }
  if (bmi < 24) {
    return { label: "标准" };
  }
  if (bmi < 28) {
    return { label: "超重" };
  }
  return { label: "肥胖" };
}

function getStandardWeightRange(heightCm) {
  const heightM = heightCm / 100;
  const low = 18.5 * heightM * heightM;
  const high = 23.9 * heightM * heightM;
  return `${low.toFixed(1)}-${high.toFixed(1)}`;
}

function getLatestHeight(source) {
  return source.find((item) => item.height)?.height || null;
}

function formatChartValue(value) {
  if (activeChart === "weight") {
    return value.toFixed(1);
  }
  return String(value);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
