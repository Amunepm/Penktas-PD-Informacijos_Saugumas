const entryForm = document.getElementById("entryForm");
const titleInput = document.getElementById("title");
const passwordInput = document.getElementById("password");
const urlInput = document.getElementById("url");
const notesInput = document.getElementById("notes");
const recordsBody = document.getElementById("recordsBody");
const addButton = document.getElementById("addButton");
const searchInput = document.getElementById("searchInput");
const masterPasswordInput = document.getElementById("masterPassword");
const saveFileButton = document.getElementById("saveFileButton");
const loadVaultButton = document.getElementById("loadVaultButton");
const statusMessage = document.getElementById("statusMessage");

const records = [];
let editingRecord = null;

function setStatus(message) {
  statusMessage.textContent = message;
}

async function deriveKey(masterPassword, salt) {
  const encoder = new TextEncoder();

  const passwordData = encoder.encode(masterPassword);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );

  return aesKey;
}

async function encryptPassword(password, masterPassword) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(masterPassword, salt);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(password),
  );

  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encryptedData)),
  };
}

async function encryptText(text, masterPassword) {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(masterPassword, salt);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(text),
  );

  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encryptedData)),
  };
}

async function decryptText(encryptedText, masterPassword) {
  const decoder = new TextDecoder();

  const salt = new Uint8Array(encryptedText.salt);
  const iv = new Uint8Array(encryptedText.iv);
  const ciphertext = new Uint8Array(encryptedText.ciphertext);

  const key = await deriveKey(masterPassword, salt);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext,
  );

  return decoder.decode(decryptedData);
}

async function decryptPassword(encryptedPassword, masterPassword) {
  const decoder = new TextDecoder();

  const salt = new Uint8Array(encryptedPassword.salt);
  const iv = new Uint8Array(encryptedPassword.iv);
  const ciphertext = new Uint8Array(encryptedPassword.ciphertext);

  const key = await deriveKey(masterPassword, salt);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext,
  );

  return decoder.decode(decryptedData);
}

function displayRecords() {
  recordsBody.innerHTML = "";

  const searchText = searchInput.value.trim().toLowerCase();

  const filteredRecords = records.filter(function (record) {
    return record.title.toLowerCase().includes(searchText);
  });

  if (filteredRecords.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");

    emptyCell.colSpan = 4;
    emptyCell.textContent =
      searchText === "" ? "Irasu dar nera." : "Pagal paieska irasu nerasta.";

    emptyRow.className = "empty-row";
    emptyRow.appendChild(emptyCell);
    recordsBody.appendChild(emptyRow);
    return;
  }

  filteredRecords.forEach(function (record) {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = record.title;

    const urlCell = document.createElement("td");
    urlCell.textContent = record.url;

    const notesCell = document.createElement("td");
    notesCell.textContent = record.notes;

    const actionsCell = document.createElement("td");

    const showButton = document.createElement("button");
    showButton.textContent = "Rodyti";

    showButton.addEventListener("click", async function () {
      const masterPassword = masterPasswordInput.value;

      if (masterPassword === "") {
        alert("Iveskite pagrindini slaptazodi.");
        return;
      }

      try {
        const decryptedPassword = await decryptPassword(
          record.password,
          masterPassword,
        );

        alert("Slaptazodis: " + decryptedPassword);
      } catch (error) {
        alert(
          "Nepavyko parodyti slaptazodzio. Patikrinkite pagrindini slaptazodi.",
        );
      }
    });

    const updateButton = document.createElement("button");
    updateButton.textContent = "Redaguoti";

    updateButton.addEventListener("click", async function () {
      const masterPassword = masterPasswordInput.value;

      if (masterPassword === "") {
        alert("Iveskite pagrindini slaptazodi.");
        return;
      }

      try {
        const decryptedPassword = await decryptPassword(
          record.password,
          masterPassword,
        );

        editingRecord = record;

        titleInput.value = record.title;
        passwordInput.value = decryptedPassword;
        urlInput.value = record.url;
        notesInput.value = record.notes;

        addButton.textContent = "Issaugoti pakeitimus";
      } catch (error) {
        alert("Nepavyko atidaryti iraso. Patikrinkite pagrindini slaptazodi.");
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Istrinti";

    deleteButton.addEventListener("click", async function () {
      if (masterPasswordInput.value === "") {
        setStatus("Norint istrinti irasa, iveskite pagrindini slaptazodi.");
        masterPasswordInput.focus();
        return;
      }

      const recordIndex = records.indexOf(record);
      records.splice(recordIndex, 1);

      displayRecords();

      try {
        await saveVault(false);
        setStatus("Irasas istrintas ir saugykla issaugota.");
      } catch (error) {
        setStatus("Irasas istrintas, bet saugyklos issaugoti nepavyko.");
      }
    });

    actionsCell.appendChild(showButton);
    actionsCell.appendChild(updateButton);
    actionsCell.appendChild(deleteButton);

    row.appendChild(titleCell);
    row.appendChild(urlCell);
    row.appendChild(notesCell);
    row.appendChild(actionsCell);

    recordsBody.appendChild(row);
  });
}

entryForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const masterPassword = masterPasswordInput.value;

  if (masterPassword === "") {
    alert("Iveskite pagrindini slaptazodi.");
    return;
  }

  const title = titleInput.value.trim();
  const password = passwordInput.value;
  const encryptedPassword = await encryptPassword(password, masterPassword);
  const url = urlInput.value.trim();
  const notes = notesInput.value.trim();

  const record = {
    title: title,
    password: encryptedPassword,
    url: url,
    notes: notes,
  };

  const isEditing = editingRecord !== null;

  if (editingRecord === null) {
    records.push(record);
  } else {
    editingRecord.title = record.title;
    editingRecord.password = record.password;
    editingRecord.url = record.url;
    editingRecord.notes = record.notes;

    editingRecord = null;
  }

  displayRecords();

  try {
    await saveVault(false);
    setStatus(
      isEditing
        ? "Irasas atnaujintas ir saugykla issaugota."
        : "Irasas pridetas ir saugykla issaugota.",
    );
  } catch (error) {
    setStatus("Irasas pakeistas, bet saugyklos issaugoti nepavyko.");
  }

  entryForm.reset();

  addButton.textContent = "Pridėti";
});

searchInput.addEventListener("input", function () {
  displayRecords();
});

async function saveVault(showValidation = true) {
  const masterPassword = masterPasswordInput.value;

  if (masterPassword === "") {
    if (showValidation) {
      setStatus("Iveskite pagrindini slaptazodi.");
      masterPasswordInput.focus();
    }

    return false;
  }

  const data = JSON.stringify(records);
  const encryptedFile = await encryptText(data, masterPassword);
  const fileContent = JSON.stringify(encryptedFile, null, 2);

  await window.vaultAPI.saveVault(fileContent);

  return true;
}

saveFileButton.addEventListener("click", async function () {
  try {
    const saved = await saveVault();

    if (saved) {
      setStatus("Saugykla issaugota.");
    }
  } catch (error) {
    setStatus("Nepavyko issaugoti saugyklos.");
  }
});

loadVaultButton.addEventListener("click", async function () {
  const masterPassword = masterPasswordInput.value;

  if (masterPassword === "") {
    setStatus("Iveskite pagrindini slaptazodi.");
    masterPasswordInput.focus();
    return;
  }

  try {
    const result = await window.vaultAPI.loadVault();

    if (result.content === "") {
      records.length = 0;
      displayRecords();

      setStatus("Saugyklos failas tuscias arba sukurtas pirma karta.");
      titleInput.focus();
      return;
    }

    const encryptedFile = JSON.parse(result.content);
    const decryptedText = await decryptText(encryptedFile, masterPassword);
    const loadedRecords = JSON.parse(decryptedText);

    records.length = 0;

    loadedRecords.forEach(function (record) {
      records.push(record);
    });

    displayRecords();

    setStatus("Saugykla ikelta.");
    titleInput.focus();
  } catch (error) {
    setStatus("Nepavyko ikelti saugyklos. Patikrinkite slaptazodi arba faila.");
    masterPasswordInput.focus();
  }
});

window.vaultAPI.onAppClosing(async function () {
  try {
    await saveVault(false);
  } finally {
    await window.vaultAPI.finishClose();
  }
});

displayRecords();
