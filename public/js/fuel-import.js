(function () {
  const form = document.getElementById("fuelImportForm");
  const card = document.getElementById("fuelExcelImportCard");
  const drop = document.getElementById("fuelDropZone");
  const input = document.getElementById("fuelFileInput");
  const pickBtn = document.getElementById("fuelPickBtn");
  const btn = document.getElementById("fuelImportBtn");
  const label = document.getElementById("fuelDropLabel");
  const progress = document.getElementById("fuelImportProgress");
  const fill = document.getElementById("fuelProgressFill");
  const progressLabel = document.getElementById("fuelProgressLabel");

  if (!form || !input) {
    console.warn("[fuel-import] Kart bulunamadı — #fuelImportForm veya #fuelFileInput yok");
    return;
  }

  const fakeUpload = form.dataset.fakeUpload !== "0";

  function toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type);
    else alert(msg);
  }

  function runFakeUploadProgress(done) {
    progress?.removeAttribute("hidden");
    if (fill) fill.style.width = "0%";
    if (progressLabel) progressLabel.textContent = "Yükleniyor…";
    let pct = 0;
    const t = setInterval(() => {
      pct += 12;
      if (fill) fill.style.width = Math.min(pct, 100) + "%";
      if (progressLabel) progressLabel.textContent = `Yükleniyor… %${Math.min(pct, 100)}`;
      if (pct >= 100) {
        clearInterval(t);
        setTimeout(() => {
          progress?.setAttribute("hidden", "");
          done();
        }, 350);
      }
    }, 80);
  }

  function showUploadSuccess() {
    card?.classList.add("is-uploaded");
    toast("Excel başarıyla yüklendi", "success");
  }

  function setFile(file) {
    if (!file) return;
    const ok = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!ok) {
      toast("Sadece Excel dosyaları (.xlsx, .xls) yüklenebilir.", "error");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    if (label) label.textContent = file.name;
    drop?.classList.add("has-file");
    if (btn) btn.disabled = false;

    if (fakeUpload) {
      runFakeUploadProgress(showUploadSuccess);
    }
  }

  input.addEventListener("change", function () {
    if (input.files[0]) setFile(input.files[0]);
  });

  pickBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.click();
  });

  ["dragenter", "dragover"].forEach((ev) => {
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("is-dragover");
    });
  });
  drop?.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  });
  drop?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!input.files?.length) {
      toast("Lütfen önce bir dosya seçin.", "error");
      return;
    }
    if (fakeUpload) {
      if (btn) btn.disabled = true;
      runFakeUploadProgress(() => {
        if (btn) btn.disabled = false;
        showUploadSuccess();
      });
      return;
    }
    submitRealImport();
  });

  function submitRealImport() {
    const fd = new FormData();
    fd.append("file", input.files[0]);
    const xhr = new XMLHttpRequest();
    if (btn) {
      btn.disabled = true;
      btn.textContent = "İçe aktarılıyor…";
    }
    progress?.removeAttribute("hidden");
    xhr.upload.addEventListener("progress", (ev) => {
      if (!ev.lengthComputable || !fill) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      fill.style.width = pct + "%";
    });
    xhr.addEventListener("load", () => {
      progress?.setAttribute("hidden", "");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "İçe aktar";
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400 || !data.ok) {
          toast(data.message || "İçe aktarma başarısız.", "error");
          return;
        }
        toast("Excel başarıyla yüklendi", "success");
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast("Sunucu yanıtı okunamadı.", "error");
      }
    });
    xhr.open("POST", "/fuel/import");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.send(fd);
  }
})();
