const STORAGE_KEY = "siteTracker.tasks.v1";

let tasks = loadTasks();

function uid() {
  return "t_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to parse tasks from storage:", e);
    return [];
  }
}

function addTask(task) {
  tasks.push(task);
  saveTasks();
  renderAll();
}

function updateTask(id, patch) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...patch };
    saveTasks();
    renderAll();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
}

// -------- Rendering --------
function renderAll() {
  document.querySelectorAll(".task-list").forEach(ul => ul.innerHTML = "");

  ["site", "tender", "cost", "drawing"].forEach(category => {
    ["Open", "In Progress", "Completed"].forEach(status => {
      const ul = document.querySelector(`.task-list[data-category="${category}"][data-status="${status}"]`);
      if (!ul) return;
      tasks
        .filter(t => t.category === category && t.status === status)
        .sort(sortByPriorityThenEndDate)
        .forEach(t => ul.appendChild(taskCard(t)));
    });
  });

  // Render Today view sorted by floor
  ["site", "tender", "cost", "drawing"].forEach(category => {
    const ul = document.querySelector(`.task-list.today[data-today-category="${category}"]`);
    if (!ul) return;
    const todays = tasks
      .filter(t => t.category === category && t.isToday && t.status !== "Completed")
      .sort((a, b) => {
        const fa = parseInt(a.floor) || 0;
        const fb = parseInt(b.floor) || 0;
        if (!isNaN(fa) && !isNaN(fb) && fa !== fb) return fa - fb;
        return sortByPriorityThenEndDate(a, b);
      });
    if (todays.length === 0) {
      ul.innerHTML = `<li class="small">No tasks added for today.</li>`;
    } else {
      ul.innerHTML = "";
      todays.forEach(t => ul.appendChild(taskCard(t, { inTodayView: true })));
    }
  });
}

function priorityWeight(p) {
  return p === "High" ? 0 : p === "Medium" ? 1 : 2;
}
function sortByPriorityThenEndDate(a, b) {
  const p = priorityWeight(a.priority) - priorityWeight(b.priority);
  if (p !== 0) return p;
  return (a.endDate || "").localeCompare(b.endDate || "");
}

function taskCard(t, opts = {}) {
  const li = document.createElement("li");
  li.className = "task-card";

  const overdue = t.status !== "Completed" && t.endDate && new Date(t.endDate) < todayNoTime();
  const dueSoon = t.status !== "Completed" && t.endDate && daysBetween(todayNoTime(), new Date(t.endDate)) <= 2 && !overdue;

  const top = document.createElement("div");
  top.className = "row-top";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t.name;
  top.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(chip(t.priority,
    t.priority === "High" ? "danger" : t.priority === "Medium" ? "warn" : "ok"
  ));
  meta.appendChild(chip(t.status));
  if (t.isToday) meta.appendChild(chip("Today"));
  if (overdue) meta.appendChild(chip("Overdue", "danger"));
  else if (dueSoon) meta.appendChild(chip("Due soon", "warn"));
  top.appendChild(meta);

  const info = document.createElement("div");
  info.className = "small";
  info.innerHTML = `
    <strong>Assigned:</strong> ${escapeHTML(t.assignedTo)} &nbsp;•&nbsp;
    <strong>Floor:</strong> ${t.floor || "-"} &nbsp;•&nbsp;
    <strong>Start:</strong> ${fmtDate(t.startDate)} &nbsp;•&nbsp;
    <strong>End:</strong> ${fmtDate(t.endDate)}
  `;

  const remarks = document.createElement("div");
  remarks.className = "remarks";
  remarks.textContent = t.remarks || "";

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const statusSel = document.createElement("select");
  ["Open","In Progress","Completed"].forEach(s=>{
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    if (t.status === s) opt.selected = true;
    statusSel.appendChild(opt);
  });
  statusSel.className = "btn";
  statusSel.title = "Change Status";
  statusSel.addEventListener("change", (e) => {
    const newStatus = e.target.value;
    updateTask(t.id, {
      status: newStatus,
      isToday: newStatus === "Completed" ? false : t.isToday
    });
  });
  actions.appendChild(statusSel);

  const todayBtn = document.createElement("button");
  todayBtn.className = "btn today";
  todayBtn.textContent = t.isToday ? "Remove from Today" : "Add to Today";
  todayBtn.addEventListener("click", () => {
    if (t.status === "Completed") {
      alert("Task is completed and cannot be added to Today's list.");
      return;
    }
    updateTask(t.id, { isToday: !t.isToday });
  });
  actions.appendChild(todayBtn);

  const toggleDone = document.createElement("button");
  toggleDone.className = "btn";
  toggleDone.textContent = t.status === "Completed" ? "Mark Reopen" : "Mark Completed";
  toggleDone.addEventListener("click", () => {
    const newStatus = t.status === "Completed" ? "Open" : "Completed";
    updateTask(t.id, { status: newStatus, isToday: newStatus === "Completed" ? false : t.isToday });
  });
  actions.appendChild(toggleDone);

  const editBtn = document.createElement("button");
  editBtn.className = "btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => {
    const name = prompt("Task Name:", t.name) ?? t.name;
    const startDate = prompt("Start Date (YYYY-MM-DD):", t.startDate) ?? t.startDate;
    const endDate = prompt("End Date (YYYY-MM-DD):", t.endDate) ?? t.endDate;
    const assignedTo = prompt("Assign to (Person):", t.assignedTo) ?? t.assignedTo;
    const priority = prompt("Priority (Low/Medium/High):", t.priority) ?? t.priority;
    const status = prompt("Status (Open/In Progress/Completed):", t.status) ?? t.status;
    const floor = prompt("Floor:", t.floor || "") ?? t.floor;
    const remarks = prompt("Remarks:", t.remarks) ?? t.remarks;
    updateTask(t.id, { name, startDate, endDate, assignedTo, priority, status, floor, remarks, isToday: status === "Completed" ? false : t.isToday });
  });
  actions.appendChild(editBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "btn danger";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => {
    if (confirm("Delete this task?")) deleteTask(t.id);
  });
  actions.appendChild(delBtn);

  li.appendChild(top);
  li.appendChild(info);
  if (t.remarks) li.appendChild(remarks);
  li.appendChild(actions);

  return li;
}

function chip(text, flavor) {
  const span = document.createElement("span");
  span.className = "chip" + (flavor ? ` ${flavor}` : "");
  span.textContent = text;
  return span;
}

function fmtDate(v) {
  if (!v) return "-";
  try {
    const d = new Date(v + "T00:00:00");
    return d.toLocaleDateString();
  } catch { return v; }
}

function todayNoTime() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000*60*60*24));
}
function escapeHTML(s) {
  return (s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// -------- Forms handling --------
document.querySelectorAll(".task-form").forEach(form => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const category = form.dataset.category;
    const name = (fd.get("name") || "").toString().trim();
    const startDate = (fd.get("startDate") || "").toString();
    const endDate = (fd.get("endDate") || "").toString();
    const assignedTo = (fd.get("assignedTo") || "").toString().trim();
    const priority = (fd.get("priority") || "").toString();
    const status = (fd.get("status") || "").toString();
    const floor = (fd.get("floor") || "").toString();
    const remarks = (fd.get("remarks") || "").toString();

    if (!name || !startDate || !endDate || !assignedTo || !priority || !status) {
      alert("Please fill all required fields.");
      return;
    }

    const t = {
      id: uid(),
      category, name, startDate, endDate, assignedTo, remarks,
      priority, status, floor,
      isToday: false,
      createdAt: new Date().toISOString()
    };
    addTask(t);
    form.reset();
  });
});

// -------- Tabs --------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;

    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.add("active");
  });
});

// -------- Export / Import --------
document.getElementById("exportJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "site-tracker-tasks.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("importJson").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Invalid JSON format");

      // Merge tasks instead of replacing
      data.forEach(task => {
        if (!task.id || tasks.some(t => t.id === task.id)) {
          task.id = uid(); // ensure unique ID
        }
        tasks.push(task);
      });

      saveTasks();
      renderAll();
      alert("Import successful. Tasks merged.");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(f);
});

// Initial render
renderAll();
