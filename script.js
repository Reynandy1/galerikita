"use strict";

/* =========================================================
   MYSTIC ARCHIVE — GALLERY APPLICATION
   ========================================================= */

/* ---------------- CONFIGURATION ---------------- */

const CONFIG = {
  databaseName: "MysticArchiveVaultDB",
  databaseVersion: 1,
  storeName: "artifacts",
  pageSize: 12,
  allowedCategories: [
    "Together",
    "Travel"
  ]
};

/* ---------------- DEFAULT GALLERY PHOTOS ---------------- */

const DEFAULT_PHOTOS = [
  {
    name: "Eternal Moments",
    category: "Together",
    image: "images/foto1.jpeg",
    date: "2026-10-01"
  },
  {
    name: "Hidden Horizons",
    category: "Travel",
    image: "images/foto2.jpeg",
    date: "2026-09-20"
  },
  {
    name: "Golden Memories",
    category: "Together",
    image: "images/foto3.jpeg",
    date: "2026-08-15"
  },
  {
    name: "Quiet Escape",
    category: "Travel",
    image: "images/foto4.jpeg",
    date: "2026-07-12"
  },
  {
    name: "A Timeless Story",
    category: "Together",
    image: "images/foto5.jpeg",
    date: "2026-06-18"
  },
  {
    name: "Beyond The Clouds",
    category: "Travel",
    image: "images/foto6.jpeg",
    date: "2026-05-21"
  },
  {
    name: "Little Chapters",
    category: "Together",
    image: "images/foto7.jpeg",
    date: "2026-04-10"
  },
  {
    name: "Somewhere Beautiful",
    category: "Travel",
    image: "images/foto8.jpeg",
    date: "2026-03-08"
  },
  {
    name: "Fragments of Us",
    category: "Together",
    image: "images/foto9.jpeg",
    date: "2026-02-14"
  },
  {
    name: "The Lasting View",
    category: "Travel",
    image: "images/foto10.jpeg",
    date: "2026-01-05"
  },
  {
    name: "Memory in Bloom",
    category: "Together",
    image: "images/foto11.jpeg",
    date: "2025-12-18"
  },
  {
    name: "Whispers of Tomorrow",
    category: "Travel",
    image: "images/foto12.jpeg",
    date: "2025-11-02"
  }
];

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

  mobileMenuButton: document.getElementById("mobileMenuButton"),
  mainNav: document.getElementById("mainNav")
};

/* =========================================================
   DATABASE
   ========================================================= */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported."));
      return;
    }

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

    const store = transaction.objectStore(
      CONFIG.storeName
    );

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

async function getAllPhotos() {
  const records = await runTransaction(
    "readonly",
    (store) => store.getAll()
  );

  return records.filter(
    (record) => record.recordType !== "meta"
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
   LOAD DEFAULT PHOTOS
   ========================================================= */

/*
  Fungsi ini memeriksa foto yang sudah tersimpan
  sebelum menambahkan foto bawaan.

  Foto lama dengan nama Memory 01 sampai Memory 10
  akan disesuaikan dengan koleksi terbaru.

  Foto 11 dan 12 akan ditambahkan jika belum tersedia.

  Data foto yang sudah dihapus tidak akan dibuat kembali
  setelah penanda defaults-loaded tersimpan.
*/

async function loadDefaultPhotos() {
  const allRecords = await runTransaction(
    "readonly",
    (store) => store.getAll()
  );

  const initialized = allRecords.some(
    (record) =>
      record.id === "defaults-loaded" &&
      record.recordType === "meta"
  );

  let existingPhotos = allRecords.filter(
    (record) => record.recordType !== "meta"
  );

  for (let index = 0; index < DEFAULT_PHOTOS.length; index++) {
    const item = DEFAULT_PHOTOS[index];

    const sourceKey = `default-photo-${index + 1}`;

    const legacyName = `Memory ${String(index + 1).padStart(2, "0")}`;

    const matchingPhotos = existingPhotos.filter((photo) => {
      return (
        photo.sourceKey === sourceKey ||
        photo.name === item.name ||
        photo.name === legacyName
      );
    });

    const shouldAddMissingPhoto =
      !initialized || index >= 10;

    if (matchingPhotos.length > 0) {
      const primaryPhoto = matchingPhotos[0];

      const updatedPhoto = {
        ...primaryPhoto,

        name: item.name,
        category: item.category,
        image: item.image,

        date: new Date(
          `${item.date}T12:00:00`
        ).toISOString(),

        sourceKey,

        favorite:
          primaryPhoto.favorite ??
          primaryPhoto.isFavorite ??
          false,

        note: primaryPhoto.note || ""
      };

      await updatePhoto(updatedPhoto);

      /*
        Jika versi sebelumnya sempat membuat
        foto bawaan yang sama lebih dari satu kali,
        duplikat foto bawaan tersebut dibersihkan.
      */

      for (let duplicateIndex = 1; duplicateIndex < matchingPhotos.length; duplicateIndex++) {
        const duplicate = matchingPhotos[duplicateIndex];

        await removePhoto(duplicate.id);

        revokePhotoUrl(duplicate.id);
      }

      existingPhotos = existingPhotos.filter(
        (photo) =>
          !matchingPhotos.some(
            (matched) => matched.id === photo.id
          )
      );

      existingPhotos.push(updatedPhoto);

    } else if (shouldAddMissingPhoto) {
      const newPhoto = {
        name: item.name,
        category: item.category,
        image: item.image,

        date: new Date(
          `${item.date}T12:00:00`
        ).toISOString(),

        createdAt: new Date().toISOString(),

        favorite: false,
        note: "",

        sourceKey
      };

      await addPhoto(newPhoto);

      existingPhotos.push(newPhoto);
    }
  }

  /*
    Penanda ini hanya dibuat sekali.
    Fungsinya mencegah foto yang sengaja dihapus
    muncul kembali saat halaman dimuat ulang.
  */

  if (!initialized) {
    await addPhoto({
      id: "defaults-loaded",
      recordType: "meta",
      value: true
    });
  }
}

/* =========================================================
   UTILITIES
   ========================================================= */

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

function dateForInput(value) {
  const date = new Date(value);

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() - offset * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function cleanFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .slice(0, 80);
}

/*
  Foto bawaan menggunakan alamat file langsung.
  Foto lama yang tersimpan sebagai Blob tetap didukung.
*/

function getPhotoUrl(photo) {
  if (typeof photo.image === "string") {
    return photo.image;
  }

  if (!photo.image) {
    return "";
  }

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
  if (!elements.toast) {
    console.info(message);
    return;
  }

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

    await loadDefaultPhotos();

    attachEventListeners();

    await refreshPhotos();

    updateCounters();

  } catch (error) {
    console.error(
      "Vault initialization failed:",
      error
    );

    showToast("Unable to open local vault storage.");
  }
}

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

  if (elements.allCount) {
    elements.allCount.textContent = total;
  }

  if (elements.heroMemoryCount) {
    elements.heroMemoryCount.textContent =
      `${total} ARTIFACTS EXHIBITED`;
  }

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

  if (state.activeCategory === "Favorites") {
    result = result.filter(
      (photo) => photo.favorite
    );

  } else if (state.activeCategory !== "All") {
    result = result.filter(
      (photo) => photo.category === state.activeCategory
    );
  }

  if (state.searchTerm.trim()) {
    const term = state.searchTerm
      .trim()
      .toLowerCase();

    result = result.filter((photo) => {
      const titleMatch = photo.name
        .toLowerCase()
        .includes(term);

      const categoryMatch = photo.category
        .toLowerCase()
        .includes(term);

      const noteMatch = (photo.note || "")
        .toLowerCase()
        .includes(term);

      return (
        titleMatch ||
        categoryMatch ||
        noteMatch
      );
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
  if (!elements.photoGrid) {
    return;
  }

  const visible = state.visiblePhotos.slice(
    0,
    state.visibleLimit
  );

  elements.photoGrid.innerHTML = "";

  if (elements.emptyState) {
    elements.emptyState.hidden =
      state.visiblePhotos.length !== 0;
  }

  if (elements.loadMoreRow) {
    elements.loadMoreRow.hidden =
      state.visiblePhotos.length <= state.visibleLimit;
  }

  visible.forEach((photo, index) => {
    const card = createPhotoCard(photo, index);

    elements.photoGrid.appendChild(card);
  });

  const count = state.visiblePhotos.length;

  if (elements.resultCount) {
    elements.resultCount.textContent =
      `${count} ${count === 1 ? "ARTIFACT" : "ARTIFACTS"}`;
  }
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

  const hasEditDialog = Boolean(
    elements.memoryDialog &&
    elements.memoryForm &&
    elements.memoryName &&
    elements.memoryCategory &&
    elements.memoryDate
  );

  card.innerHTML = `
    <div
      class="photo-visual"
      role="button"
      tabindex="0"
      aria-label="Open ${escapeHTML(photo.name)}"
    >
      <img
        src="${escapeHTML(imageUrl)}"
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
          class="photo-tool favorite ${
            photo.favorite ? "is-favorite" : ""
          }"
          data-action="favorite"
          aria-label="Toggle favorite"
          aria-pressed="${photo.favorite ? "true" : "false"}"
          type="button"
        >
          ${photo.favorite ? "◆" : "◇"}
        </button>

        ${
          hasEditDialog
            ? `
              <button
                class="photo-tool"
                data-action="edit"
                aria-label="Edit photo"
                type="button"
              >
                ✎
              </button>
            `
            : ""
        }

        <button
          class="photo-tool delete"
          data-action="delete"
          aria-label="Delete photo"
          type="button"
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

  const editButton = card.querySelector(
    '[data-action="edit"]'
  );

  if (editButton) {
    editButton.addEventListener("click", () => {
      openEditDialog(photo.id);
    });
  }

  card
    .querySelector('[data-action="delete"]')
    .addEventListener("click", () => {
      deleteMemory(photo.id);
    });

  return card;
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

  const previousFavorite = photo.favorite;

  photo.favorite = !photo.favorite;

  try {
    await updatePhoto(photo);

    await refreshPhotos();

    showToast(
      photo.favorite
        ? "Marked as favorite ◇"
        : "Removed from favorites."
    );

    if (
      state.viewerPhotoId === id &&
      !state.visiblePhotos.some((item) => item.id === id)
    ) {
      closeViewer();
    }

  } catch (error) {
    photo.favorite = previousFavorite;

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

    if (state.viewerPhotoId === id) {
      closeViewer();
    }

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
  if (!elements.memoryDialog) {
    return;
  }

  const photo = state.photos.find(
    (item) => item.id === id
  );

  if (!photo) {
    return;
  }

  state.editingPhotoId = id;

  if (elements.dialogEyebrow) {
    elements.dialogEyebrow.textContent = "EDIT ARTIFACT";
  }

  if (elements.dialogTitle) {
    elements.dialogTitle.innerHTML =
      'Refine vault <em>entry.</em>';
  }

  if (elements.dialogSave) {
    elements.dialogSave.textContent = "Save changes";
  }

  elements.memoryName.value = photo.name;
  elements.memoryCategory.value = photo.category;
  elements.memoryDate.value = dateForInput(photo.date);

  openDialog();
}

function openDialog() {
  if (!elements.memoryDialog) {
    return;
  }

  elements.memoryDialog.showModal();

  document.body.classList.add("dialog-open");

  if (elements.memoryName) {
    elements.memoryName.focus();
  }
}

function closeDialog() {
  if (
    elements.memoryDialog &&
    elements.memoryDialog.open
  ) {
    elements.memoryDialog.close();
  }

  document.body.classList.remove("dialog-open");

  state.editingPhotoId = null;

  if (elements.memoryForm) {
    elements.memoryForm.reset();
  }
}

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

  const newCategory = elements.memoryCategory.value;
  const newDate = elements.memoryDate.value;

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

function openViewer(id) {
  if (
    !elements.viewer ||
    !elements.viewerImage
  ) {
    return;
  }

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

function renderViewer() {
  const photo = state.visiblePhotos[state.viewerIndex];

  if (!photo) {
    closeViewer();
    return;
  }

  state.viewerPhotoId = photo.id;

  const url = getPhotoUrl(photo);

  elements.viewerImage.src = url;
  elements.viewerImage.alt = photo.name;

  if (elements.viewerTitle) {
    elements.viewerTitle.textContent = photo.name;
  }

  if (elements.viewerCategory) {
    elements.viewerCategory.textContent = photo.category;
  }

  if (elements.viewerDate) {
    elements.viewerDate.textContent = formatDate(photo.date);
  }

  if (elements.viewerDownload) {
    elements.viewerDownload.href = url;

    elements.viewerDownload.download =
      `${cleanFileName(photo.name) || "artifact"}.jpeg`;
  }

  if (elements.viewerFavorite) {
    elements.viewerFavorite.textContent =
      photo.favorite ? "◆" : "◇";

    elements.viewerFavorite.style.color =
      photo.favorite ? "#b77f7c" : "";
  }
}

function showNextPhoto() {
  if (!state.visiblePhotos.length) {
    return;
  }

  state.viewerIndex =
    (state.viewerIndex + 1) %
    state.visiblePhotos.length;

  renderViewer();
}

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

function closeViewer() {
  if (!elements.viewer) {
    return;
  }

  elements.viewer.classList.remove("open");

  elements.viewer.setAttribute(
    "aria-hidden",
    "true"
  );

  if (elements.viewerImage) {
    elements.viewerImage.src = "";
  }

  document.body.classList.remove("dialog-open");

  state.viewerPhotoId = null;
}

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
  const button = event.target.closest("[data-category]");

  if (!button) {
    return;
  }

  document
    .querySelectorAll(".filter-chip")
    .forEach((chip) => {
      chip.classList.remove("active");
    });

  button.classList.add("active");

  state.activeCategory = button.dataset.category;

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
    if (
      elements.viewer &&
      elements.viewer.classList.contains("open")
    ) {
      closeViewer();
    }

    if (
      elements.memoryDialog &&
      elements.memoryDialog.open
    ) {
      closeDialog();
    }
  }

  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  ) {
    if (elements.searchInput) {
      event.preventDefault();

      elements.searchInput.focus();
    }
  }

  if (
    elements.viewer &&
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
  if (elements.mainNav) {
    const isOpen = elements.mainNav.classList.toggle("menu-open");

    if (elements.mobileMenuButton) {
      elements.mobileMenuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }
  }
}

function closeMobileMenu() {
  if (elements.mainNav) {
    elements.mainNav.classList.remove("menu-open");
  }

  if (elements.mobileMenuButton) {
    elements.mobileMenuButton.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function attachEventListeners() {

  /* Search */

  if (elements.searchInput) {
    elements.searchInput.addEventListener(
      "input",
      handleSearch
    );
  }

  /* Sorting */

  if (elements.sortSelect) {
    elements.sortSelect.addEventListener(
      "change",
      handleSortChange
    );
  }

  /* Category filter */

  const categoryList = document.querySelector(
    ".category-list"
  );

  if (categoryList) {
    categoryList.addEventListener(
      "click",
      handleCategoryChange
    );
  }

  /* Photo viewer */

  if (elements.viewerClose) {
    elements.viewerClose.addEventListener(
      "click",
      closeViewer
    );
  }

  if (elements.viewerPrev) {
    elements.viewerPrev.addEventListener(
      "click",
      showPreviousPhoto
    );
  }

  if (elements.viewerNext) {
    elements.viewerNext.addEventListener(
      "click",
      showNextPhoto
    );
  }

  if (elements.viewer) {
    elements.viewer.addEventListener("click", (event) => {
      if (event.target === elements.viewer) {
        closeViewer();
      }
    });
  }

  if (elements.viewerFavorite) {
    elements.viewerFavorite.addEventListener(
      "click",
      toggleViewerFavorite
    );
  }

  /* Edit dialog */

  if (elements.memoryForm) {
    elements.memoryForm.addEventListener(
      "submit",
      saveMemoryChanges
    );
  }

  if (elements.dialogClose) {
    elements.dialogClose.addEventListener(
      "click",
      closeDialog
    );
  }

  if (elements.dialogCancel) {
    elements.dialogCancel.addEventListener(
      "click",
      closeDialog
    );
  }

  if (elements.memoryDialog) {
    elements.memoryDialog.addEventListener(
      "click",
      (event) => {
        if (event.target === elements.memoryDialog) {
          closeDialog();
        }
      }
    );
  }

  /* Load more */

  if (elements.loadMoreButton) {
    elements.loadMoreButton.addEventListener(
      "click",
      loadMorePhotos
    );
  }

  /* Mobile navigation */

  if (elements.mobileMenuButton) {
    elements.mobileMenuButton.addEventListener(
      "click",
      toggleMobileMenu
    );
  }

  if (elements.mainNav) {
    elements.mainNav
      .querySelectorAll("a")
      .forEach((link) => {
        link.addEventListener(
          "click",
          closeMobileMenu
        );
      });
  }

  /* Keyboard shortcuts */

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

  if (state.database) {
    state.database.close();
  }
});

/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeGallery
);