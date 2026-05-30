const loginPanel = document.getElementById("loginPanel");
const editorPanel = document.getElementById("editorPanel");
const loginForm = document.getElementById("loginForm");
const authForm = document.getElementById("authForm");
const contentForm = document.getElementById("contentForm");
const loginMessage = document.getElementById("loginMessage");
const authMessage = document.getElementById("authMessage");
const saveMessage = document.getElementById("saveMessage");
const logoutButton = document.getElementById("logoutButton");

let content = null;

const repeatConfig = {
  heroLinks: {
    target: "heroLinksEditor",
    fields: [
      ["label", "Label"],
      ["url", "Link"]
    ]
  },
  materials: {
    target: "materialsEditor",
    fields: [
      ["title", "Judul"],
      ["url", "Link"],
      ["description", "Deskripsi", "wide"]
    ]
  },
  assignments: {
    target: "assignmentsEditor",
    fields: [
      ["title", "Judul"],
      ["dueDate", "Batas", "", "date"],
      ["url", "Link"],
      ["description", "Deskripsi", "wide"]
    ]
  },
  links: {
    target: "linksEditor",
    fields: [
      ["label", "Label"],
      ["url", "Link"]
    ]
  }
};

function setByPath(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((acc, key) => acc[key], object);
  target[last] = value;
}

function getByPath(object, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], object);
}

function showEditor() {
  loginPanel.classList.add("hidden");
  editorPanel.classList.remove("hidden");
}

function showLogin() {
  editorPanel.classList.add("hidden");
  loginPanel.classList.remove("hidden");
}

function createField(group, index, field) {
  const [key, labelText, className = "", type = "text"] = field;
  const label = document.createElement("label");
  label.className = className;
  label.textContent = labelText;
  const input = key === "description" ? document.createElement("textarea") : document.createElement("input");
  input.name = `${group}.${index}.${key}`;
  input.value = content[group][index][key] || "";
  if (type) input.type = type;
  if (input.tagName === "TEXTAREA") input.rows = 3;
  label.append(input);
  return label;
}

function renderRepeat(group) {
  const config = repeatConfig[group];
  const target = document.getElementById(config.target);
  target.innerHTML = "";

  content[group].forEach((_, index) => {
    const row = document.createElement("div");
    row.className = "repeat-item";
    config.fields.forEach((field) => row.append(createField(group, index, field)));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-button remove-button";
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => {
      content[group].splice(index, 1);
      renderRepeat(group);
    });
    row.append(remove);
    target.append(row);
  });
}

function fillForm() {
  contentForm.querySelectorAll("[name]").forEach((field) => {
    if (!field.name.includes(".") || field.name.split(".").length === 2) {
      field.value = getByPath(content, field.name) || "";
    }
  });
  Object.keys(repeatConfig).forEach(renderRepeat);
}

function collectForm() {
  const next = structuredClone(content);
  contentForm.querySelectorAll("[name]").forEach((field) => {
    const parts = field.name.split(".");
    if (parts.length === 2) setByPath(next, field.name, field.value);
  });

  Object.keys(repeatConfig).forEach((group) => {
    next[group] = content[group].map((item, index) => {
      const updated = { ...item };
      repeatConfig[group].fields.forEach(([key]) => {
        const field = contentForm.querySelector(`[name="${group}.${index}.${key}"]`);
        updated[key] = field ? field.value : "";
      });
      return updated;
    });
  });

  return next;
}

async function loadContent() {
  const response = await fetch("/api/content");
  content = await response.json();
  fillForm();
}

async function loadAuthSettings() {
  const response = await fetch("/api/auth-settings");
  if (!response.ok) return;
  const auth = await response.json();
  authForm.elements.username.value = auth.username || "";
  authForm.elements.password.value = "";
  authForm.elements.confirmPassword.value = "";
}

async function checkSession() {
  const response = await fetch("/api/me");
  if (response.ok) {
    showEditor();
    await loadAuthSettings();
    await loadContent();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Memeriksa akun...";
  const form = new FormData(loginForm);
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(form))
  });

  if (!response.ok) {
    const body = await response.json();
    loginMessage.textContent = body.error || "Login gagal.";
    return;
  }

  showEditor();
  await loadAuthSettings();
  await loadContent();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "Menyimpan akun...";
  const form = new FormData(authForm);
  const response = await fetch("/api/auth-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(form))
  });

  const body = await response.json();
  if (!response.ok) {
    authMessage.textContent = body.error || "Gagal menyimpan akun.";
    return;
  }

  authForm.elements.password.value = "";
  authForm.elements.confirmPassword.value = "";
  loginForm.elements.username.value = body.username;
  authMessage.textContent = "User dan password admin sudah diperbarui.";
});

contentForm.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (!addButton) return;

  const group = addButton.dataset.add;
  const emptyItem = repeatConfig[group].fields.reduce((acc, [key]) => {
    acc[key] = "";
    return acc;
  }, {});
  content[group].push(emptyItem);
  renderRepeat(group);
});

contentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveMessage.textContent = "Menyimpan...";
  const next = collectForm();
  const response = await fetch("/api/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next)
  });

  if (!response.ok) {
    const body = await response.json();
    saveMessage.textContent = body.error || "Gagal menyimpan.";
    return;
  }

  const body = await response.json();
  content = body.data;
  fillForm();
  saveMessage.textContent = "Perubahan sudah tersimpan.";
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  showLogin();
});

checkSession();
