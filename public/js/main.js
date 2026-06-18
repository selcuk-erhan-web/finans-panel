(function () {
  window.toggleNav = function () {
    document.getElementById("sidebar")?.classList.toggle("is-open");
    document.getElementById("navBackdrop")?.classList.toggle("is-on");
  };

  const loader = document.getElementById("loader");
  function showLoader() {
    if (!loader) return;
    loader.classList.add("is-on", "is-skeleton");
  }
  function hideLoader() {
    loader?.classList.remove("is-on", "is-skeleton");
  }

  document.querySelectorAll("form").forEach((f) => {
    if (f.id === "fuelImportForm") return;
    f.addEventListener("submit", showLoader);
  });

  document.querySelectorAll("a.btn, a.vehicle-card__cta, a.fleet-card__cta, a.fleet-card--clickable, a.vehicle-card--clickable, a.nav-link, a.rank-card, a.expense-cat-card, a.income-hub-card").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (a.getAttribute("onclick")) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) {
        if (href.length > 1) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        return;
      }
      showLoader();
    });
  });

  window.addEventListener("pageshow", hideLoader);
  document.addEventListener("DOMContentLoaded", hideLoader);

  /* Canlı saat — yalnızca dashboard welcome */
  function tickClock() {
    const dateEl = document.getElementById("liveDate");
    const timeEl = document.getElementById("liveTime");
    if (!dateEl || !timeEl) return;
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    timeEl.textContent = now.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* Gelişmiş toast */
  window.showToast = function showToast(message, type) {
    const w = document.getElementById("toasts");
    if (!w || !message) return;
    const t = document.createElement("div");
    t.className = "toast toast--" + (type || "success");
    t.setAttribute("role", "status");
    t.textContent = message;
    w.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = "1";
    });
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(100%)";
      setTimeout(function () {
        t.remove();
      }, 300);
    }, 4800);
  }

  const params = new URLSearchParams(window.location.search);
  const msg = params.get("msg");
  const ok = params.get("ok");
  const err = params.get("err");
  if (msg) showToast(msg, err ? "error" : "success");

  window.openModal = function (html) {
    const b = document.getElementById("modalBackdrop");
    const box = document.getElementById("modalBox");
    if (!b || !box) return;
    box.innerHTML =
      '<div class="modal__head"><h3 class="modal__title">Bilgi</h3><button type="button" class="modal__close" onclick="closeModal()">×</button></div>' +
      html;
    b.classList.add("is-on");
  };
  window.closeModal = function () {
    document.getElementById("modalBackdrop")?.classList.remove("is-on");
  };

  if (typeof Chart !== "undefined") {
    Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', sans-serif";
    Chart.defaults.color = "#64748b";
    Chart.defaults.borderColor = "rgba(15,23,42,0.06)";
    Chart.defaults.plugins.tooltip.enabled = true;
  }

  /* Executive sidebar — tek açık grup (FLEETOS-EXEC-01) */
  document.querySelectorAll(".nav-group__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var group = btn.closest(".nav-group");
      if (!group) return;
      var willOpen = !group.classList.contains("is-open");
      document.querySelectorAll(".nav-group.is-open").forEach(function (g) {
        if (g === group) return;
        g.classList.remove("is-open");
        var t = g.querySelector(".nav-group__toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
      group.classList.toggle("is-open", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });
})();
