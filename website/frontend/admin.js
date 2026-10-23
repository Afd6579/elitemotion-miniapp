(() => {
  const $ = s => document.querySelector(s);
  let csrfToken = "";
  let products = [];
  const notice = $("#notice");
  function message(text, type="") { notice.textContent = text; notice.className = `notice ${type}`.trim(); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch])); }
  async function api(url, options={}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (options.method && !["GET","HEAD"].includes(options.method.toUpperCase())) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(url, { credentials:"same-origin", ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  async function securityToken() {
    const data = await api("/api/admin/csrf");
    csrfToken = data.csrfToken;
  }
  async function initialize() {
    try {
      const data = await api("/api/admin/status");
      $("#setup-panel").hidden = data.adminExists;
      $("#login-panel").hidden = !data.adminExists;
      $("#dashboard").hidden = true;
      if (!data.adminExists) message("Create the first admin account to continue.");
      else {
        await securityToken();
        try {
          const auth = await api("/api/admin/me");
          if (auth.authenticated) await showDashboard();
        } catch {}
      }
    } catch (e) { message(e.message, "error"); }
  }
  $("#setup-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await securityToken();
      const form = new FormData(e.currentTarget);
      await api("/api/admin/setup", { method:"POST", body:JSON.stringify(Object.fromEntries(form)) });
      message("Admin account created. Sign in to manage products.", "success");
      $("#setup-panel").hidden = true; $("#login-panel").hidden = false;
      e.currentTarget.reset();
    } catch (err) { message(err.message, "error"); }
  });
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const form = new FormData(e.currentTarget);
      await api("/api/admin/login", { method:"POST", body:JSON.stringify(Object.fromEntries(form)) });
      await securityToken();
      e.currentTarget.reset();
      await showDashboard();
      message("Signed in.", "success");
    } catch (err) { message(err.message, "error"); }
  });
  async function showDashboard() {
    $("#setup-panel").hidden = true; $("#login-panel").hidden = true; $("#dashboard").hidden = false;
    await loadProducts();
  }
  async function loadProducts() {
    const data = await api("/api/admin/products");
    products = data.products || [];
    $("#admin-products").innerHTML = products.length ? products.map(p => `
      <article class="admin-product"><div><h3>${escapeHtml(p.name)} <span class="pill ${p.active ? "" : "hidden"}">${p.active ? "VISIBLE" : "HIDDEN"}</span></h3><p>${escapeHtml(p.code)} · ${escapeHtml(p.collection)} · ${Number(p.priceToman).toLocaleString("en-US")} Toman · $${Number(p.priceUSD).toFixed(2)}</p><small>${escapeHtml(p.description || "")}</small></div><div class="actions"><button data-edit="${escapeHtml(p.id)}" class="secondary">Edit</button><button data-toggle="${escapeHtml(p.id)}" class="secondary">${p.active ? "Hide" : "Show"}</button><button data-delete="${escapeHtml(p.id)}" class="danger">Delete</button></div></article>`).join("") : '<div class="panel">No products yet. Add your first artwork above.</div>';
  }
  function resetForm() {
    $("#product-form").reset(); $("#product-form").elements.id.value = ""; $("#product-form").elements.position.value = "10";
    $("#product-form").elements.active.checked = true; $("#form-title").textContent = "Add artwork"; $("#save-button").textContent = "Save product"; $("#cancel-edit").hidden = true;
  }
  $("#product-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form);
    body.priceToman = Number(body.priceToman); body.priceUSD = Number(body.priceUSD); body.position = Number(body.position);
    body.active = form.has("active");
    const id = body.id; delete body.id;
    try {
      await api(id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products", { method:id ? "PUT" : "POST", body:JSON.stringify(body) });
      resetForm(); await loadProducts(); message("Product saved.", "success");
    } catch (err) { message(err.message, "error"); }
  });
  $("#cancel-edit").addEventListener("click", resetForm);
  $("#admin-products").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit]"), toggle = e.target.closest("[data-toggle]"), del = e.target.closest("[data-delete]");
    try {
      if (edit) {
        const p = products.find(row => String(row.id) === edit.dataset.edit); if (!p) return;
        const form = $("#product-form");
        for (const key of ["id","name","code","collection","priceToman","priceUSD","previewUrl","position","description"]) form.elements[key].value = p[key] ?? "";
        form.elements.active.checked = Boolean(p.active);
        $("#form-title").textContent = "Edit artwork"; $("#save-button").textContent = "Update product"; $("#cancel-edit").hidden = false;
        form.scrollIntoView({behavior:"smooth",block:"start"});
      } else if (toggle) {
        const p = products.find(row => String(row.id) === toggle.dataset.toggle); if (!p) return;
        await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method:"PUT", body:JSON.stringify({active:!p.active}) });
        await loadProducts(); message("Product visibility updated.", "success");
      } else if (del) {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        await api(`/api/admin/products/${encodeURIComponent(del.dataset.delete)}`, {method:"DELETE"});
        await loadProducts(); message("Product deleted.", "success");
      }
    } catch (err) { message(err.message, "error"); }
  });
  $("#logout-button").addEventListener("click", async () => {
    try { await api("/api/admin/logout", {method:"POST",body:JSON.stringify({})}); csrfToken = ""; await initialize(); message("Signed out."); }
    catch (e) { message(e.message,"error"); }
  });
  initialize();
})();