const profileFields = document.querySelectorAll("[data-profile]");

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "";
}

function createLink(item, className = "") {
  const link = document.createElement("a");
  link.href = item.url || "#";
  link.target = "_blank";
  link.rel = "noopener";
  link.className = className;
  link.textContent = item.label || item.title || "Buka link";
  return link;
}

function normalizeImageUrl(url) {
  const match = String(url || "").match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200` : url;
}

function renderCards(container, items, type) {
  container.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `item-card ${type === "assignment" ? "assignment-card" : "material-card"}`;

    const content = document.createElement("div");
    if (type !== "assignment") {
      const icon = document.createElement("div");
      icon.className = "card-icon";
      icon.textContent = "⌘";
      content.append(icon);
    }

    const title = document.createElement("h3");
    title.textContent = item.title;
    content.append(title);

    if (type === "assignment" && item.dueDate) {
      const time = document.createElement("time");
      time.dateTime = item.dueDate;
      time.textContent = `Batas: ${new Date(item.dueDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })}`;
      content.append(time);
    }

    const desc = document.createElement("p");
    desc.textContent = item.description;
    content.append(desc);

    card.append(content, createLink({ ...item, label: type === "assignment" ? "Buka" : "Buka Materi →" }));
    container.append(card);
  });
}

function render(data) {
  profileFields.forEach((element) => {
    const key = element.dataset.profile;
    element.textContent = data.profile[key] || "";
  });

  const profilePhoto = document.getElementById("profilePhoto");
  profilePhoto.onerror = () => {
    profilePhoto.onerror = null;
    profilePhoto.src = "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=900&auto=format&fit=crop";
  };
  profilePhoto.src = normalizeImageUrl(data.profile.photoUrl);
  document.getElementById("aboutText").textContent = data.about;
  document.getElementById("year").textContent = new Date().getFullYear();

  const quickLinks = document.getElementById("quickLinks");
  quickLinks.innerHTML = "";
  const heroLinks = data.heroLinks?.length ? data.heroLinks : [
    { label: "Google Classroom", url: "https://classroom.google.com/" },
    { label: "Drive Materi", url: "https://drive.google.com/" },
    { label: "Kontak WhatsApp", url: "https://wa.me/6281200000000" }
  ];
  heroLinks.forEach((item) => quickLinks.append(createLink(item)));

  const stats = document.getElementById("stats");
  stats.innerHTML = "";
  const socialLinks = [
    { label: "YouTube", url: data.links?.[0]?.url || "https://youtube.com/" },
    { label: "Instagram", url: data.links?.[1]?.url || "https://instagram.com/" },
    { label: "TikTok", url: data.links?.[2]?.url || "https://tiktok.com/" }
  ];
  socialLinks.forEach((item) => {
    const stat = document.createElement("div");
    stat.className = "stat social-stat";
    stat.innerHTML = `<a target="_blank" rel="noopener"><strong></strong></a>`;
    stat.querySelector("a").href = item.url;
    stat.querySelector("strong").textContent = item.label;
    stats.append(stat);
  });

  renderCards(document.getElementById("materials"), data.materials, "material");
  renderCards(document.getElementById("assignments"), data.assignments, "assignment");

  const emailLink = document.getElementById("emailLink");
  emailLink.href = `mailto:${data.profile.email}`;
  emailLink.textContent = data.profile.email || "Email";

  const phoneLink = document.getElementById("phoneLink");
  phoneLink.href = `tel:${data.profile.phone}`;
  phoneLink.textContent = data.profile.phone || "Telepon";
}

fetch("/api/content")
  .then((response) => response.json())
  .then(render)
  .catch(() => setText(".lead", "Konten belum dapat dimuat. Pastikan server berjalan."));
