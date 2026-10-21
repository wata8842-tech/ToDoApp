const STORAGE_KEY = "todo-app.items";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const summaryEl = document.getElementById("summary");
const template = document.getElementById("item-template");
const form = document.getElementById("new-form");
const titleInput = document.getElementById("new-title");
const dueInput = document.getElementById("new-due");
const timeInput = document.getElementById("new-time");
const periodInput = document.getElementById("new-period");
const periodEndInput = document.getElementById("new-period-end");
const periodSep = document.getElementById("period-sep");

// 種類ごとの表示設定。task 以外は日時の決まった予定として扱う
const TYPES = {
  task: { badge: "", placeholder: "やることを入力…", dueLabel: "期限" },
  event: { badge: "イベント", placeholder: "イベント名を入力…", dueLabel: "日付" },
  shift: { badge: "バイト", placeholder: "", dueLabel: "日付" },
};

// バイトは「ナビ」固定で、時限から開始時刻を決める。1コマ90分
const SHIFT_TITLE = "ナビ";
const PERIOD_START = { 1: "15:30", 2: "17:00", 3: "18:30", 4: "20:00" };
const PERIOD_MINUTES = 90;

// 時限の終わりの時刻（開始＋90分）を "HH:MM" で返す
function periodEnd(period) {
  const [h, m] = PERIOD_START[period].split(":").map(Number);
  const total = h * 60 + m + PERIOD_MINUTES;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

let todos = load();
let filter = "active";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // ストレージが使えない環境ではメモリ上のみで動作する
  }
}

// offsetDays 日後の日付を "YYYY-MM-DD" で返す
function dateFromToday(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDue(todo) {
  const range = todo.time && todo.endTime ? `${todo.time}〜${todo.endTime}` : todo.time || "";
  if (!todo.due) return range;
  const [, m, d] = todo.due.split("-");
  const date = `${Number(m)}/${Number(d)}`;
  if (!todo.type || todo.type === "task") return `期限: ${date}`;
  return range ? `${date} ${range}` : date;
}

// 予定が「過ぎた」とみなす日時。イベントは開始時刻、バイトはコマの終わり。
// 時刻がなければその日の終わり（翌日 0:00）
function scheduleEnd(todo) {
  if (!todo.due) return null;
  const [y, m, d] = todo.due.split("-").map(Number);
  if (!todo.time) return new Date(y, m - 1, d + 1);
  // 終了時刻のあるバイトはその時刻で判定する（終了が開始以前なら翌日扱い）
  if (todo.endTime) {
    const [eh, emin] = todo.endTime.split(":").map(Number);
    return new Date(y, m - 1, d + (todo.endTime <= todo.time ? 1 : 0), eh, emin);
  }
  const [h, min] = todo.time.split(":").map(Number);
  const extra = todo.type === "shift" ? PERIOD_MINUTES : 0;
  return new Date(y, m - 1, d, h, min + extra);
}

// 日時を過ぎた予定を完了にする。手動で未完了に戻したものは再度動かさない
function completePastEvents() {
  const now = new Date();
  let changed = false;
  todos = todos.map((t) => {
    if (t.type === "task" || !t.type || t.done || t.autoCompleted) return t;
    const end = scheduleEnd(t);
    if (!end || end > now) return t;
    changed = true;
    return { ...t, done: true, autoCompleted: true };
  });
  if (changed) save();
}

// 日付（イベントは時刻も）が近い順。日付のないものは追加順のまま末尾へ
function compareByDate(a, b) {
  if (!a.due || !b.due) return (a.due ? 0 : 1) - (b.due ? 0 : 1);
  const key = (t) => `${t.due} ${t.time || ""}`;
  return key(a).localeCompare(key(b));
}

function render() {
  const visible = todos
    .filter((t) => (filter === "done" ? t.done : !t.done))
    .sort(compareByDate);

  listEl.replaceChildren(...visible.map(renderItem));
  emptyEl.hidden = visible.length > 0;

  const remaining = todos.filter((t) => !t.done).length;
  summaryEl.textContent = todos.length
    ? `残り ${remaining} 件 / 全 ${todos.length} 件`
    : "タスクを追加しましょう";
}

function renderItem(todo) {
  const li = template.content.firstElementChild.cloneNode(true);
  const type = TYPES[todo.type] ? todo.type : "task";
  li.dataset.id = todo.id;
  li.classList.toggle("done", todo.done);
  li.classList.toggle("event", type === "event");
  li.classList.toggle("shift", type === "shift");
  const pendingTask = type === "task" && !todo.done && todo.due;
  li.classList.toggle("overdue", pendingTask && todo.due < dateFromToday(0));
  li.classList.toggle(
    "due-soon",
    pendingTask && todo.due >= dateFromToday(0) && todo.due <= dateFromToday(1)
  );
  li.querySelector(".toggle").checked = todo.done;
  li.querySelector(".title").textContent = type === "shift" ? SHIFT_TITLE : todo.title;
  li.querySelector(".badge").textContent = TYPES[type].badge;
  li.querySelector(".due").textContent = formatDue(todo);
  return li;
}

function update(id, changes) {
  todos = todos.map((t) => (t.id === id ? { ...t, ...changes } : t));
  save();
  render();
}

function startEdit(li) {
  const todo = todos.find((t) => t.id === li.dataset.id);
  const titleEl = li.querySelector(".title");
  const input = document.createElement("input");
  input.className = "edit";
  input.value = todo.title;
  input.maxLength = 200;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const value = input.value.trim();
    if (commit && value) {
      update(todo.id, { title: value });
    } else {
      render();
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

function syncTypeFields() {
  const type = form.elements.type.value;
  const isShift = type === "shift";
  // バイトはタイトル固定なので、入力するのは日付と時限だけ
  titleInput.hidden = isShift;
  titleInput.required = !isShift;
  titleInput.placeholder = TYPES[type].placeholder;
  timeInput.hidden = type !== "event";
  periodInput.hidden = periodEndInput.hidden = periodSep.hidden = !isShift;
  periodInput.required = periodEndInput.required = isShift;
  dueInput.required = isShift;
  dueInput.setAttribute("aria-label", TYPES[type].dueLabel);
}

// 終了の時限は開始より前を選べないようにし、未選択なら開始と同じにする
function syncPeriodEnd() {
  const start = Number(periodInput.value) || 1;
  for (const opt of periodEndInput.options) {
    opt.disabled = opt.value !== "" && Number(opt.value) < start;
  }
  if (periodInput.value && Number(periodEndInput.value) < start) {
    periodEndInput.value = periodInput.value;
  }
}

form.addEventListener("change", (e) => {
  if (e.target.name === "type") syncTypeFields();
  if (e.target === periodInput) syncPeriodEnd();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = form.elements.type.value;
  const isShift = type === "shift";
  const title = isShift ? SHIFT_TITLE : titleInput.value.trim();
  if (!title) return;
  const period = isShift ? Number(periodInput.value) : null;
  const endPeriod = isShift ? Number(periodEndInput.value) : null;
  if (isShift && endPeriod < period) return;
  let time = null;
  if (isShift) time = PERIOD_START[period];
  else if (type === "event") time = timeInput.value || null;
  todos.push({
    id: crypto.randomUUID(),
    type,
    title,
    due: dueInput.value || null,
    time,
    endTime: isShift ? periodEnd(endPeriod) : null,
    period,
    endPeriod,
    done: false,
  });
  completePastEvents();
  save();
  // 種類の選択は連続入力しやすいよう残す
  titleInput.value = "";
  dueInput.value = "";
  timeInput.value = "";
  periodInput.value = "";
  periodEndInput.value = "";
  syncPeriodEnd();
  (isShift ? dueInput : titleInput).focus();
  render();
});

listEl.addEventListener("change", (e) => {
  if (!e.target.classList.contains("toggle")) return;
  update(e.target.closest(".item").dataset.id, { done: e.target.checked });
});

listEl.addEventListener("click", (e) => {
  if (!e.target.classList.contains("delete")) return;
  const id = e.target.closest(".item").dataset.id;
  todos = todos.filter((t) => t.id !== id);
  save();
  render();
});

listEl.addEventListener("dblclick", (e) => {
  const li = e.target.closest(".item");
  // バイトのタイトルは固定なので編集しない
  if (!e.target.classList.contains("title") || li.classList.contains("shift")) return;
  startEdit(li);
});

document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filters button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    render();
  });
});

document.getElementById("clear-done").addEventListener("click", () => {
  todos = todos.filter((t) => !t.done);
  save();
  render();
});

syncTypeFields();
completePastEvents();
render();

// 開いたままでも時間の経過を反映する（予定の自動完了・今日/明日の強調）
setInterval(() => {
  completePastEvents();
  if (!document.querySelector(".item .edit")) render();
}, 60 * 1000);
