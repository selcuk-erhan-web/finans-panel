(function () {
  function toggleMenu() {
    document.getElementById("sidebar")?.classList.toggle("open");
    document.getElementById("overlay")?.classList.toggle("open");
  }
  window.toggleMenu = toggleMenu;

  const loader = document.getElementById("loader");
  function showLoader() {
    loader?.classList.add("show");
  }
  function hideLoader() {
    loader?.classList.remove("show");
  }

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", () => showLoader());
  });

  document.querySelectorAll("a.btn, a.plate-link").forEach((a) => {
    a.addEventListener("click", () => {
      if (!a.getAttribute("onclick")) showLoader();
    });
  });

  window.addEventListener("pageshow", hideLoader);

  const params = new URLSearchParams(location.search);
  const msg = params.get("msg");
  const isErr = params.get("err");
  const isOk = params.get("ok");

  if (msg && (isOk || isErr)) {
    const wrap = document.getElementById("toast-wrap");
    if (wrap) {
      const el = document.createElement("div");
      el.className = "toast " + (isErr ? "error" : "success");
      el.textContent = decodeURIComponent(msg);
      wrap.appendChild(el);
      setTimeout(() => el.remove(), 4500);
      const url = new URL(location.href);
      url.searchParams.delete("ok");
      url.searchParams.delete("err");
      url.searchParams.delete("msg");
      history.replaceState({}, "", url);
    }
  }

  if (typeof Chart !== "undefined") {
    Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', sans-serif";
    Chart.defaults.color = "#64748b";
  }
})();
