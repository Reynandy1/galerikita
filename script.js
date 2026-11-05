"use strict";

/* =========================================================
   MYSTIC ARCHIVE — GALLERY APPLICATION
   ========================================================= */

/* ---------------- CONFIGURATION (Tanpa Personal) ---------------- */

const CONFIG = {
  databaseName: "MysticArchiveVaultDB",
  databaseVersion: 1,
  storeName: "artifacts",
  maximumFileSize: 15 * 1024 * 1024,
  pageSize: 30,
  allowedCategories: [
    "Together",
    "Travel"
  ]
};

/* ---------------- APPLICATION STATE ---------------- */

const state = {
  database: null,
  photos: [],
  visiblePhotos: [],

  activeCategory: "All",
  searchTerm: "",
  sortMode: "newest",

  viewerPhotoId: null,
  viewerIndex: 0,

  editingPhotoId: null,
  visibleLimit: CONFIG.pageSize,

  objectUrls: new Map(),
  toastTimer: null
};

/* ---------------- DOM REFERENCES ---------------- */

const elements = {
  photoGrid: document.getElementById("photoGrid"),

  photoUpload: document.getElementById("photoUpload"),
  emptyUpload: document.getElementById("emptyUpload"),

  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),

  emptyState: document.getElementById("emptyState"),

  resultCount: document.getElementById("resultCount"),
  allCount: document.getElementById("allCount"),
  heroMemoryCount: document.getElementById("heroMemoryCount"),

  viewer: document.getElementById("photoViewer"),
  viewerImage: document.getElementById("viewerImage"),
  viewerTitle: document.getElementById("viewerTitle"),
  viewerCategory: document.getElementById("viewerCategory"),
  viewerDate: document.getElementById("viewerDate"),
  viewerDownload: document.getElementById("viewerDownload"),
  viewerFavorite: document.getElementById("viewerFavorite"),

  viewerClose: document.getElementById("viewerClose"),
  viewerPrev: document.getElementById("viewerPrev"),
  viewerNext: document.getElementById("viewerNext"),

  memoryDialog: document.getElementById("memoryDialog"),
  memoryForm: document.getElementById("memoryForm"),

  memoryName: document.getElementById("memoryName"),
  memoryCategory: document.getElementById("memoryCategory"),
  memoryDate: document.getElementById("memoryDate"),

  dialogTitle: document.getElementById("dialogTitle"),
  dialogEyebrow: document.getElementById("dialogEyebrow"),
  dialogSave: document.getElementById("dialogSave"),

  dialogClose: document.getElementById("dialogClose"),
  dialogCancel: document.getElementById("dialogCancel"),

  toast: document.getElementById("toast"),

  loadMoreRow: document.getElementById("loadMoreRow"),
  loadMoreButton: document.getElementById("loadMoreButton"),

  uploadProgressWrap: document.getElementById("uploadProgressWrap"),
  uploadProgressText: document.getElementById("uploadProgressText"),
  uploadProgressNumber: document.getElementById("uploadProgressNumber"),
  uploadProgressBar: document.getElementById("uploadProgressBar"),

  mobileMenuButton: document.getElementById("mobileMenuButton"),
  mainNav: document.getElementById("mainNav")
};

/* =========================================================
   DATABASE
   ========================================================= */

/* ---------------- OPEN DATABASE ---------------- */

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      CONFIG.databaseName,
      CONFIG.databaseVersion
    );

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(CONFIG.storeName)) {
        const store = database.createObjectStore(
          CONFIG.storeName,
          {
            keyPath: "id",
            autoIncrement: true
          }
        );

        store.createIndex(
          "category",
          "category",
          { unique: false }
        );

        store.createIndex(
          "createdAt",
          "createdAt",
          { unique: false }
        );

        store.createIndex(
          "favorite",
          "favorite",
          { unique: false }
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      showToast("Close other tabs accessing this vault.");
    };
  });
}

/* ---------------- GENERIC TRANSACTION ---------------- */

function runTransaction(mode, operation) {
  return new Promise((resolve, reject) => {
    if (!state.database) {
      reject(new Error("Database is not initialized."));
      return;
    }

    const transaction = state.database.transaction(
      CONFIG.storeName,
      mode
    );

    const store = transaction.objectStore(CONFIG.storeName);

    let request;

    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      resolve(request ? request.result : undefined);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    transaction.onabort = () => {
      reject(
        transaction.error ||
        new Error("Transaction aborted.")
      );
    };
  });
}

/* ---------------- DATABASE CRUD ---------------- */

async function getAllPhotos() {
  return runTransaction(
    "readonly",
    (store) => store.getAll()
  );
}

async function addPhoto(photo) {
  return runTransaction(
    "readwrite",
    (store) => store.add(photo)
  );
}

async function updatePhoto(photo) {
  return runTransaction(
    "readwrite",
    (store) => store.put(photo)
  );
}

async function removePhoto(id) {
  return runTransaction(
    "readwrite",
    (store) => store.delete(id)
  );
}

/* =========================================================
   UTILITIES
   ========================================================= */

/* ---------------- ESCAPE HTML ---------------- */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

/* ---------------- FORMAT DATE ---------------- */

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/* ---------------- DATE INPUT FORMAT ---------------- */

function dateForInput(value) {
  const date = new Date(value);

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() - offset * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

/* ---------------- FILE NAME ---------------- */

function cleanFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .slice(0, 80);
}

/* ---------------- OBJECT URL MANAGEMENT ---------------- */

function getPhotoUrl(photo) {
  if (!state.objectUrls.has(photo.id)) {
    const url = URL.createObjectURL(photo.image);

    state.objectUrls.set(photo.id, url);
  }

  return state.objectUrls.get(photo.id);
}

function revokePhotoUrl(id) {
  const url = state.objectUrls.get(id);

  if (url) {
    URL.revokeObjectURL(url);
    state.objectUrls.delete(id);
  }
}

function revokeAllPhotoUrls() {
  state.objectUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });

  state.objectUrls.clear();
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function showToast(message) {
  elements.toast.textContent = message;

  elements.toast.classList.add("visible");

  clearTimeout(state.toastTimer);

  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2800);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeGallery() {
  try {
    state.database = await openDatabase();

    attachEventListeners();

    await refreshPhotos();

    updateCounters();

  } catch (error) {
    console.error(
      "Vault initialization failed:",
      error
    );

    showToast(
      "Unable to open local vault storage."
    );
  }
}

/* ---------------- REFRESH DATA ---------------- */

async function refreshPhotos() {
  state.photos = await getAllPhotos();

  updateCounters();

  applyFilters();
}

/* =========================================================
   COUNTERS
   ========================================================= */

function updateCounters() {
  const total = state.photos.length;

  const favorites = state.photos.filter(
    (photo) => photo.favorite
  ).length;

  elements.allCount.textContent = total;

  elements.heroMemoryCount.textContent =
    `${total} ARTIFACTS EXHIBITED`;

  document
    .querySelectorAll('[data-category="Favorites"]')
    .forEach((button) => {
      button.setAttribute(
        "aria-label",
        `Favorites, ${favorites} artifacts`
      );
    });
}

/* =========================================================
   FILTER AND SEARCH
   ========================================================= */

function applyFilters() {
  let result = [...state.photos];

  /* CATEGORY FILTER */

  if (state.activeCategory === "Favorites") {
    result = result.filter(
      (photo) => photo.favorite
    );

  } else if (state.activeCategory !== "All") {
    result = result.filter(
      (photo) => photo.category === state.activeCategory
    );
  }

  /* SEARCH FILTER */

  if (state.searchTerm.trim()) {
    const term = state.searchTerm
      .trim()
      .toLowerCase();

    result = result.filter((photo) => {
      const titleMatch =
        photo.name.toLowerCase().includes(term);

      const categoryMatch =
        photo.category.toLowerCase().includes(term);

      const noteMatch =
        (photo.note || "").toLowerCase().includes(term);

      return titleMatch || categoryMatch || noteMatch;
    });
  }

  sortPhotos(result);

  state.visiblePhotos = result;

  state.visibleLimit = CONFIG.pageSize;

  renderGallery();

  updateCounters();
}

/* =========================================================
   SORTING
   ========================================================= */

function sortPhotos(list) {
  if (state.sortMode === "oldest") {
    list.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    return;
  }

  if (state.sortMode === "az") {
    list.sort(
      (a, b) => a.name.localeCompare(b.name)
    );

    return;
  }

  list.sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}

/* =========================================================
   RENDER GALLERY
   ========================================================= */

function renderGallery() {
  const visible = state.visiblePhotos.slice(
    0,
    state.visibleLimit
  );

  elements.photoGrid.innerHTML = "";

  elements.emptyState.hidden =
    state.visiblePhotos.length !== 0;

  elements.loadMoreRow.hidden =
    state.visiblePhotos.length <= state.visibleLimit;

  visible.forEach((photo, index) => {
    const card = createPhotoCard(photo, index);

    elements.photoGrid.appendChild(card);
  });

  const count = state.visiblePhotos.length;

  elements.resultCount.textContent =
    `${count} ${count === 1 ? "ARTIFACT" : "ARTIFACTS"}`;
}

/* =========================================================
   PHOTO CARD
   ========================================================= */

function createPhotoCard(photo, index) {
  const card = document.createElement("article");

  card.className = "photo-card";

  card.style.animationDelay =
    `${Math.min(index * 35, 300)}ms`;

  const imageUrl = getPhotoUrl(photo);

  card.innerHTML = `
    <div
      class="photo-visual"
      role="button"
      tabindex="0"
      aria-label="Open ${escapeHTML(photo.name)}"
    >

      <img
        src="${imageUrl}"
        alt="${escapeHTML(photo.name)}"
        loading="lazy"
      >

      <span class="photo-category-tag">
        ${escapeHTML(photo.category)}
      </span>

      <div class="photo-hover">
        <span>Inspect artifact ◇</span>
        <span>EXAMINE</span>
      </div>

    </div>

    <div class="photo-card-footer">

      <div class="photo-info">

        <h3 title="${escapeHTML(photo.name)}">
          ${escapeHTML(photo.name)}
        </h3>

        <p>
          ${formatDate(photo.date).toUpperCase()}
        </p>

      </div>

      <div class="photo-tools">

        <button
          class="photo-tool favorite ${photo.favorite ? "is-favorite" : ""}"
          data-action="favorite"
          aria-label="Toggle favorite"
        >
          ${photo.favorite ? "◆" : "◇"}
        </button>

        <button
          class="photo-tool"
          data-action="edit"
          aria-label="Edit photo"
        >
          ✎
        </button>

        <button
          class="photo-tool delete"
          data-action="delete"
          aria-label="Delete photo"
        >
          ⌫
        </button>

      </div>

    </div>
  `;

  const visual = card.querySelector(".photo-visual");

  visual.addEventListener("click", () => {
    openViewer(photo.id);
  });

  visual.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      openViewer(photo.id);
    }
  });

  card
    .querySelector('[data-action="favorite"]')
    .addEventListener("click", () => {
      toggleFavorite(photo.id);
    });

  card
    .querySelector('[data-action="edit"]')
    .addEventListener("click", () => {
      openEditDialog(photo.id);
    });

  card
    .querySelector('[data-action="delete"]')
    .addEventListener("click", () => {
      deleteMemory(photo.id);
    });

  return card;
}

/* =========================================================
   UPLOAD VALIDATION
   ========================================================= */

function validateImage(file) {
  if (!file.type.startsWith("image/")) {
    return "This file is not an image artifact.";
  }

  if (file.size > CONFIG.maximumFileSize) {
    return "Each artifact must be smaller than 15 MB.";
  }

  return null;
}

/* =========================================================
   UPLOAD PHOTOS
   ========================================================= */

async function handleUpload(event) {
  const files = Array.from(
    event.target.files || []
  );

  if (!files.length) {
    return;
  }

  const validFiles = files.filter((file) => {
    const error = validateImage(file);

    if (error) {
      showToast(`${file.name}: ${error}`);

      return false;
    }

    return true;
  });

  if (!validFiles.length) {
    event.target.value = "";

    return;
  }

  elements.uploadProgressWrap.hidden = false;

  let completed = 0;

  for (const file of validFiles) {
    const defaultName = cleanFileName(
      file.name.replace(/\.[^/.]+$/, "")
    );

    const photo = {
      name: defaultName || "Untitled artifact",

      category: "Together",

      date: new Date().toISOString(),

      createdAt: new Date().toISOString(),

      image: file,

      favorite: false,

      note: ""
    };

    try {
      await addPhoto(photo);

      completed += 1;

      const percentage = Math.round(
        completed / validFiles.length * 100
      );

      updateUploadProgress(
        percentage,
        file.name
      );

    } catch (error) {
      console.error(
        "Could not secure artifact:",
        error
      );

      showToast(
        "An artifact could not be secured. Storage may be full."
      );
    }
  }

  elements.uploadProgressWrap.hidden = true;

  elements.uploadProgressBar.style.width = "0%";

  event.target.value = "";

  await refreshPhotos();

  showToast(
    `${completed} ${completed === 1 ? "artifact" : "artifacts"} secured successfully.`
  );
}

/* ---------------- UPLOAD PROGRESS ---------------- */

function updateUploadProgress(
  percentage,
  filename
) {
  elements.uploadProgressBar.style.width =
    `${percentage}%`;

  elements.uploadProgressNumber.textContent =
    `${percentage}%`;

  elements.uploadProgressText.textContent =
    `Securing ${filename}`;
}

/* =========================================================
   FAVORITE
   ========================================================= */

async function toggleFavorite(id) {
  const photo = state.photos.find(
    (item) => item.id === id
  );

  if (!photo) {
    return;
  }

  photo.favorite = !photo.favorite;

  try {
    await updatePhoto(photo);

    await refreshPhotos();

    showToast(
      photo.favorite
        ? "Marked as favorite ◇"
        : "Removed from favorites."
    );

  } catch (error) {
    console.error(error);

    showToast("Could not update favorite status.");
  }
}

/* =========================================================
   DELETE MEMORY
   ========================================================= */

async function deleteMemory(id) {
  const photo = state.photos.find(
    (item) => item.id === id
  );

  if (!photo) {
    return;
  }

  const confirmed = window.confirm(
    `Remove "${photo.name}" from the exhibition vault? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    await removePhoto(id);

    revokePhotoUrl(id);

    await refreshPhotos();

    showToast("Artifact removed.");

  } catch (error) {
    console.error(error);

    showToast("Could not remove this artifact.");
  }
}

/* =========================================================
   EDIT MEMORY DIALOG
   ========================================================= */

function openEditDialog(id) {
  const photo = state.photos.find(
    (item) => item.id === id
  );

  if (!photo) {
    return;
  }

  state.editingPhotoId = id;

  elements.dialogEyebrow.textContent =
    "EDIT ARTIFACT";

  elements.dialogTitle.innerHTML =
    'Refine vault <em>entry.</em>';

  elements.dialogSave.textContent =
    "Save changes";

  elements.memoryName.value =
    photo.name;

  elements.memoryCategory.value =
    photo.category;

  elements.memoryDate.value =
    dateForInput(photo.date);

  openDialog();
}

/* ---------------- OPEN DIALOG ---------------- */

function openDialog() {
  elements.memoryDialog.showModal();

  document.body.classList.add("dialog-open");

  elements.memoryName.focus();
}

/* ---------------- CLOSE DIALOG ---------------- */

function closeDialog() {
  if (elements.memoryDialog.open) {
    elements.memoryDialog.close();
  }

  document.body.classList.remove("dialog-open");

  state.editingPhotoId = null;

  elements.memoryForm.reset();
}

/* ---------------- SAVE EDITED MEMORY ---------------- */

async function saveMemoryChanges(event) {
  event.preventDefault();

  const photo = state.photos.find(
    (item) => item.id === state.editingPhotoId
  );

  if (!photo) {
    closeDialog();

    return;
  }

  const newName = cleanFileName(
    elements.memoryName.value
  );

  const newCategory =
    elements.memoryCategory.value;

  const newDate =
    elements.memoryDate.value;

  if (!newName) {
    showToast("Please enter an artifact title.");

    return;
  }

  if (
    !CONFIG.allowedCategories.includes(newCategory)
  ) {
    showToast("Please select a valid category.");

    return;
  }

  photo.name = newName;

  photo.category = newCategory;

  if (newDate) {
    photo.date = new Date(
      `${newDate}T12:00:00`
    ).toISOString();
  }

  try {
    await updatePhoto(photo);

    closeDialog();

    await refreshPhotos();

    showToast("Artifact updated.");

  } catch (error) {
    console.error(error);

    showToast("Could not update this artifact.");
  }
}

/* =========================================================
   PHOTO VIEWER
   ========================================================= */

/* ---------------- OPEN VIEWER ---------------- */

function openViewer(id) {
  const index = state.visiblePhotos.findIndex(
    (photo) => photo.id === id
  );

  if (index < 0) {
    return;
  }

  state.viewerIndex = index;

  state.viewerPhotoId = id;

  renderViewer();

  elements.viewer.classList.add("open");

  elements.viewer.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add("dialog-open");
}

/* ---------------- RENDER VIEWER ---------------- */

function renderViewer() {
  const photo =
    state.visiblePhotos[state.viewerIndex];

  if (!photo) {
    closeViewer();

    return;
  }

  state.viewerPhotoId = photo.id;

  const url = getPhotoUrl(photo);

  elements.viewerImage.src = url;

  elements.viewerImage.alt = photo.name;

  elements.viewerTitle.textContent =
    photo.name;

  elements.viewerCategory.textContent =
    photo.category;

  elements.viewerDate.textContent =
    formatDate(photo.date);

  elements.viewerDownload.href = url;

  elements.viewerDownload.download =
    `${cleanFileName(photo.name) || "artifact"}`;

  elements.viewerFavorite.textContent =
    photo.favorite ? "◆" : "◇";

  elements.viewerFavorite.style.color =
    photo.favorite ? "#b77f7c" : "";
}

/* ---------------- NEXT PHOTO ---------------- */

function showNextPhoto() {
  if (!state.visiblePhotos.length) {
    return;
  }

  state.viewerIndex =
    (state.viewerIndex + 1) %
    state.visiblePhotos.length;

  renderViewer();
}

/* ---------------- PREVIOUS PHOTO ---------------- */

function showPreviousPhoto() {
  if (!state.visiblePhotos.length) {
    return;
  }

  state.viewerIndex =
    (
      state.viewerIndex -
      1 +
      state.visiblePhotos.length
    ) % state.visiblePhotos.length;

  renderViewer();
}

/* ---------------- CLOSE VIEWER ---------------- */

function closeViewer() {
  elements.viewer.classList.remove("open");

  elements.viewer.setAttribute(
    "aria-hidden",
    "true"
  );

  elements.viewerImage.src = "";

  document.body.classList.remove("dialog-open");

  state.viewerPhotoId = null;
}

/* ---------------- VIEWER FAVORITE ---------------- */

async function toggleViewerFavorite() {
  if (state.viewerPhotoId === null) {
    return;
  }

  const currentId = state.viewerPhotoId;

  await toggleFavorite(currentId);

  const newIndex = state.visiblePhotos.findIndex(
    (photo) => photo.id === currentId
  );

  if (newIndex >= 0) {
    state.viewerIndex = newIndex;

    renderViewer();

  } else {
    closeViewer();
  }
}

/* =========================================================
   LOAD MORE
   ========================================================= */

function loadMorePhotos() {
  state.visibleLimit += CONFIG.pageSize;

  renderGallery();
}

/* =========================================================
   SEARCH
   ========================================================= */

function handleSearch(event) {
  state.searchTerm = event.target.value;

  state.visibleLimit = CONFIG.pageSize;

  applyFilters();
}

/* =========================================================
   CATEGORY FILTER
   ========================================================= */

function handleCategoryChange(event) {
  const button = event.target.closest(
    "[data-category]"
  );

  if (!button) {
    return;
  }

  document
    .querySelectorAll(".filter-chip")
    .forEach((chip) => {
      chip.classList.remove("active");
    });

  button.classList.add("active");

  state.activeCategory =
    button.dataset.category;

  state.visibleLimit = CONFIG.pageSize;

  applyFilters();
}

/* =========================================================
   SORT SELECT
   ========================================================= */

function handleSortChange(event) {
  state.sortMode = event.target.value;

  applyFilters();
}

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function handleKeyboard(event) {
  if (event.key === "Escape") {
    if (elements.viewer.classList.contains("open")) {
      closeViewer();
    }

    if (elements.memoryDialog.open) {
      closeDialog();
    }
  }

  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();

    elements.searchInput.focus();
  }

  if (
    elements.viewer.classList.contains("open")
  ) {
    if (event.key === "ArrowRight") {
      showNextPhoto();
    }

    if (event.key === "ArrowLeft") {
      showPreviousPhoto();
    }
  }
}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function toggleMobileMenu() {
  elements.mainNav.classList.toggle(
    "menu-open"
  );
}

function closeMobileMenu() {
  elements.mainNav.classList.remove(
    "menu-open"
  );
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function attachEventListeners() {

  /* Upload events */

  elements.photoUpload.addEventListener(
    "change",
    handleUpload
  );

  elements.emptyUpload.addEventListener(
    "change",
    handleUpload
  );

  /* Search and sort */

  elements.searchInput.addEventListener(
    "input",
    handleSearch
  );

  elements.sortSelect.addEventListener(
    "change",
    handleSortChange
  );

  /* Category filters */

  document
    .querySelector(".category-list")
    .addEventListener(
      "click",
      handleCategoryChange
    );

  /* Viewer controls */

  elements.viewerClose.addEventListener(
    "click",
    closeViewer
  );

  elements.viewerPrev.addEventListener(
    "click",
    showPreviousPhoto
  );

  elements.viewerNext.addEventListener(
    "click",
    showNextPhoto
  );

  elements.viewer.addEventListener(
    "click",
    (event) => {
      if (event.target === elements.viewer) {
        closeViewer();
      }
    }
  );

  elements.viewerFavorite.addEventListener(
    "click",
    toggleViewerFavorite
  );

  /* Dialog controls */

  elements.memoryForm.addEventListener(
    "submit",
    saveMemoryChanges
  );

  elements.dialogClose.addEventListener(
    "click",
    closeDialog
  );

  elements.dialogCancel.addEventListener(
    "click",
    closeDialog
  );

  /* Load more */

  elements.loadMoreButton.addEventListener(
    "click",
    loadMorePhotos
  );

  /* Mobile menu */

  elements.mobileMenuButton.addEventListener(
    "click",
    toggleMobileMenu
  );

  elements.mainNav
    .querySelectorAll("a")
    .forEach((link) => {
      link.addEventListener(
        "click",
        closeMobileMenu
      );
    });

  /* Keyboard */

  document.addEventListener(
    "keydown",
    handleKeyboard
  );
}

/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener("beforeunload", () => {
  revokeAllPhotoUrls();
});

/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeGallery
);