const STORAGE_KEY = "team-task-board-v1";

const people = {
  anna: { name: "Анна Лебедева", initials: "АЛ", className: "avatar-blue" },
  mikhail: { name: "Михаил Орлов", initials: "МО", className: "avatar-green" },
  elena: { name: "Елена Волкова", initials: "ЕВ", className: "avatar-violet" },
  dmitry: { name: "Дмитрий Соколов", initials: "ДС", className: "avatar-orange" },
};

const statuses = { new: "Новые", progress: "В работе", review: "На проверке", done: "Готово" };
const priorities = { high: "Высокий", medium: "Средний", low: "Низкий" };

const initialTasks = [
  { id: crypto.randomUUID(), title: "Собрать требования к личному кабинету", description: "Провести короткие интервью и зафиксировать ключевые пользовательские сценарии.", assignee: "anna", priority: "high", dueDate: offsetDate(1), status: "new" },
  { id: crypto.randomUUID(), title: "Подготовить план запуска", description: "Сверить этапы с маркетингом и обозначить ответственных.", assignee: "dmitry", priority: "medium", dueDate: offsetDate(4), status: "new" },
  { id: crypto.randomUUID(), title: "Обновить базу знаний", description: "Добавить инструкции по новому процессу согласования задач.", assignee: "elena", priority: "low", dueDate: offsetDate(7), status: "new" },
  { id: crypto.randomUUID(), title: "Прототип страницы аналитики", description: "Собрать кликабельный прототип для внутренней проверки.", assignee: "elena", priority: "high", dueDate: offsetDate(2), status: "progress" },
  { id: crypto.randomUUID(), title: "Настроить события продукта", description: "Добавить события для основного сценария и проверить передачу данных.", assignee: "mikhail", priority: "medium", dueDate: offsetDate(5), status: "progress" },
  { id: crypto.randomUUID(), title: "Тексты для onboarding", description: "Сократить подсказки и проверить единый тон интерфейса.", assignee: "anna", priority: "medium", dueDate: offsetDate(3), status: "review" },
  { id: crypto.randomUUID(), title: "Проверить адаптивные состояния", description: "Пройти основные экраны на ширине 375 и 768 пикселей.", assignee: "dmitry", priority: "high", dueDate: offsetDate(2), status: "review" },
  { id: crypto.randomUUID(), title: "Согласовать структуру релиза", description: "Финальная структура принята командой и добавлена в документацию.", assignee: "mikhail", priority: "low", dueDate: offsetDate(-2), status: "done" },
];

let tasks = loadTasks();
let pendingDeleteId = null;
let lastFocusedElement = null;
let toastTimer = null;

const els = {
  taskModal: document.querySelector("#taskModal"), confirmModal: document.querySelector("#confirmModal"), form: document.querySelector("#taskForm"),
  addButton: document.querySelector("#addTaskButton"), search: document.querySelector("#searchInput"), assigneeFilter: document.querySelector("#assigneeFilter"),
  priorityFilter: document.querySelector("#priorityFilter"), resetFilters: document.querySelector("#resetFilters"), resultsCount: document.querySelector("#resultsCount"),
  template: document.querySelector("#taskTemplate"), title: document.querySelector("#taskTitle"), description: document.querySelector("#taskDescription"),
  assignee: document.querySelector("#taskAssignee"), priority: document.querySelector("#taskPriority"), dueDate: document.querySelector("#taskDueDate"),
  status: document.querySelector("#taskStatus"), id: document.querySelector("#taskId"), modalTitle: document.querySelector("#modalTitle"),
  modalKicker: document.querySelector("#modalKicker"), saveButton: document.querySelector("#saveTaskButton"), descriptionCount: document.querySelector("#descriptionCount"),
  titleError: document.querySelector("#titleError"), dateError: document.querySelector("#dateError"), toast: document.querySelector("#toast"), toastText: document.querySelector("#toastText"),
};

init();

function init() {
  populatePeople();
  bindEvents();
  render();
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : initialTasks;
  } catch { return initialTasks; }
}

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

function populatePeople() {
  Object.entries(people).forEach(([id, person]) => {
    const filterOption = new Option(person.name, id);
    const formOption = new Option(person.name, id);
    els.assigneeFilter.add(filterOption);
    els.assignee.add(formOption);
  });
}

function bindEvents() {
  els.addButton.addEventListener("click", () => openTaskModal());
  document.querySelectorAll("[data-add-status]").forEach(button => button.addEventListener("click", () => openTaskModal(null, button.dataset.addStatus)));
  document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeTaskModal));
  els.form.addEventListener("submit", handleSubmit);
  els.description.addEventListener("input", () => els.descriptionCount.textContent = els.description.value.length);
  [els.search, els.assigneeFilter, els.priorityFilter].forEach(control => control.addEventListener("input", render));
  els.resetFilters.addEventListener("click", resetFilters);
  document.querySelector("#cancelDelete").addEventListener("click", () => els.confirmModal.close());
  document.querySelector("#confirmDelete").addEventListener("click", deleteTask);
  document.querySelector("#notificationsButton").addEventListener("click", () => showToast("Новых уведомлений нет"));
  els.taskModal.addEventListener("click", event => { if (event.target === els.taskModal) closeTaskModal(); });
  els.confirmModal.addEventListener("click", event => { if (event.target === els.confirmModal) els.confirmModal.close(); });
  document.addEventListener("click", closeMenusOnOutsideClick);
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); els.search.focus(); }
    if (event.key === "Escape") document.querySelectorAll(".task-menu:not([hidden])").forEach(menu => closeMenu(menu));
  });
}

function render() {
  const query = els.search.value.trim().toLocaleLowerCase("ru");
  const filtered = tasks.filter(task => (!query || task.title.toLocaleLowerCase("ru").includes(query)) && (els.assigneeFilter.value === "all" || task.assignee === els.assigneeFilter.value) && (els.priorityFilter.value === "all" || task.priority === els.priorityFilter.value));

  Object.keys(statuses).forEach(status => {
    const list = document.querySelector(`[data-list="${status}"]`);
    const statusTasks = filtered.filter(task => task.status === status);
    list.replaceChildren(...statusTasks.map(createTaskCard));
    document.querySelector(`[data-count="${status}"]`).textContent = statusTasks.length;
    if (!statusTasks.length) list.append(createEmptyState(status));
  });

  const filtersActive = Boolean(query || els.assigneeFilter.value !== "all" || els.priorityFilter.value !== "all");
  els.resetFilters.hidden = !filtersActive;
  els.resultsCount.textContent = filtersActive ? `Найдено: ${filtered.length}` : `Всего задач: ${tasks.length}`;
}

function createTaskCard(task) {
  const card = els.template.content.firstElementChild.cloneNode(true);
  const person = people[task.assignee];
  card.dataset.id = task.id;
  card.querySelector(".priority-badge").classList.add(`priority-${task.priority}`);
  card.querySelector(".priority-badge").textContent = priorities[task.priority];
  card.querySelector(".task-title").textContent = task.title;
  card.querySelector(".task-description").textContent = task.description;
  const avatar = card.querySelector(".avatar");
  avatar.textContent = person.initials;
  avatar.classList.add(person.className);
  card.querySelector(".assignee-name").textContent = person.name.split(" ")[0];
  const date = card.querySelector(".due-date");
  date.dateTime = task.dueDate;
  date.textContent = formatDate(task.dueDate);
  if (isOverdue(task)) { date.classList.add("overdue"); date.title = "Срок истёк"; }
  const statusSelect = card.querySelector(".card-status");
  statusSelect.value = task.status;
  statusSelect.setAttribute("aria-label", `Статус задачи «${task.title}»`);
  statusSelect.addEventListener("change", () => changeStatus(task.id, statusSelect.value));
  const menuButton = card.querySelector(".card-menu");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.addEventListener("click", event => toggleMenu(event, card));
  card.querySelector('[data-action="edit"]').addEventListener("click", () => openTaskModal(task));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => openDeleteConfirm(task.id));
  return card;
}

function createEmptyState(status) {
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  wrap.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h7M4 6h.01M4 12h.01M4 18h.01"/></svg><p>Здесь пока нет задач</p><button type="button">Добавить задачу</button>`;
  wrap.querySelector("button").addEventListener("click", () => openTaskModal(null, status));
  return wrap;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)).replace(".", "");
}

function isOverdue(task) { return task.status !== "done" && task.dueDate < new Date().toISOString().slice(0, 10); }

function openTaskModal(task = null, status = "new") {
  closeAllMenus();
  lastFocusedElement = document.activeElement;
  els.form.reset();
  clearErrors();
  els.id.value = task?.id || "";
  els.title.value = task?.title || "";
  els.description.value = task?.description || "";
  els.assignee.value = task?.assignee || "anna";
  els.priority.value = task?.priority || "medium";
  els.dueDate.value = task?.dueDate || offsetDate(7);
  els.status.value = task?.status || status;
  els.descriptionCount.textContent = els.description.value.length;
  els.modalKicker.textContent = task ? "Редактирование" : "Новая задача";
  els.modalTitle.textContent = task ? "Изменить задачу" : "Добавить задачу";
  els.saveButton.textContent = task ? "Сохранить изменения" : "Создать задачу";
  els.taskModal.showModal();
  requestAnimationFrame(() => els.title.focus());
}

function closeTaskModal() {
  if (!els.taskModal.open) return;
  els.taskModal.close();
  lastFocusedElement?.focus();
}

function clearErrors() {
  [els.title, els.dueDate].forEach(input => { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); });
  els.titleError.textContent = ""; els.dateError.textContent = "";
}

function validateForm() {
  clearErrors();
  let valid = true;
  if (!els.title.value.trim()) { setError(els.title, els.titleError, "Введите название задачи"); valid = false; }
  if (!els.dueDate.value) { setError(els.dueDate, els.dateError, "Выберите срок"); valid = false; }
  if (!valid) els.form.querySelector('[aria-invalid="true"]').focus();
  return valid;
}

function setError(input, errorElement, message) {
  input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", errorElement.id); errorElement.textContent = message;
}

function handleSubmit(event) {
  event.preventDefault();
  if (!validateForm()) return;
  const task = { id: els.id.value || crypto.randomUUID(), title: els.title.value.trim(), description: els.description.value.trim(), assignee: els.assignee.value, priority: els.priority.value, dueDate: els.dueDate.value, status: els.status.value };
  const index = tasks.findIndex(item => item.id === task.id);
  if (index >= 0) tasks[index] = task; else tasks.unshift(task);
  saveTasks(); render(); closeTaskModal();
  showToast(index >= 0 ? "Изменения сохранены" : "Задача создана");
}

function changeStatus(id, status) {
  const task = tasks.find(item => item.id === id);
  if (!task || task.status === status) return;
  task.status = status; saveTasks(); render(); showToast(`Задача перемещена в «${statuses[status]}»`);
}

function openDeleteConfirm(id) { pendingDeleteId = id; closeAllMenus(); els.confirmModal.showModal(); document.querySelector("#cancelDelete").focus(); }

function deleteTask() {
  if (!pendingDeleteId) return;
  tasks = tasks.filter(task => task.id !== pendingDeleteId);
  pendingDeleteId = null; saveTasks(); render(); els.confirmModal.close(); showToast("Задача удалена");
}

function resetFilters() { els.search.value = ""; els.assigneeFilter.value = "all"; els.priorityFilter.value = "all"; render(); els.search.focus(); }

function toggleMenu(event, card) {
  event.stopPropagation();
  const menu = card.querySelector(".task-menu");
  const wasOpen = !menu.hidden;
  closeAllMenus();
  if (!wasOpen) { menu.hidden = false; card.querySelector(".card-menu").setAttribute("aria-expanded", "true"); menu.querySelector("button").focus(); }
}

function closeMenusOnOutsideClick(event) { if (!event.target.closest(".task-menu, .card-menu")) closeAllMenus(); }
function closeAllMenus() { document.querySelectorAll(".task-menu:not([hidden])").forEach(closeMenu); }
function closeMenu(menu) { menu.hidden = true; menu.closest(".task-card").querySelector(".card-menu").setAttribute("aria-expanded", "false"); }

function showToast(message) {
  clearTimeout(toastTimer); els.toastText.textContent = message; els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3200);
}

