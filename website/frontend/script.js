(() => {
  const $ = (selector) => document.querySelector(selector);
  const grid = $("#product-grid");
  const status = $("#product-status");
  const cartKey = "elitemotion-cart-v1";
  let products = [];
  let currency = "USD";
  let cart = readCart();

  function readCart() {
    try { return JSON.parse(sessionStorage.getItem(cartKey) || "[]"); }
    catch { return []; }
  }
  function saveCart() { sessionStorage.setItem(cartKey, JSON.stringify(cart)); }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function priceFor(product) {
    return currency === "USD"
      ? new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(Number(product.priceUSD || 0))
      : `${new Intl.NumberFormat("fa-IR").format(Number(product.priceToman || 0))} تومان`;
  }
  function filteredProducts() {
    const query = ($("#search-input").value || "").trim().toLowerCase();
    const collection = $("#collection-filter").value;
    const sort = $("#sort-select").value;
    let result = products.filter(p => {
      const searchable = `${p.name} ${p.description} ${p.collection} ${p.code}`.toLowerCase();
      return (!query || searchable.includes(query)) && (collection === "all" || p.collection === collection);
    });
    if (sort === "price-low") result.sort((a,b) => Number(a.priceToman)-Number(b.priceToman));
    if (sort === "price-high") result.sort((a,b) => Number(b.priceToman)-Number(a.priceToman));
    if (sort === "name") result.sort((a,b) => a.name.localeCompare(b.name));
    else if (sort === "featured") result.sort((a,b) => Number(a.position || 999)-Number(b.position || 999));
    return result;
  }
  function renderProducts() {
    const list = filteredProducts();
    status.textContent = `${list.length} artwork${list.length === 1 ? "" : "s"} in the collection`;
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state">No artwork found. Try a different search or collection.</div>';
      return;
    }
    grid.innerHTML = list.map(p => `
      <article class="product-card">
        <div class="product-preview">
          ${p.previewUrl ? `<img src="${escapeHtml(p.previewUrl)}" alt="${escapeHtml(p.name)} poster preview" loading="lazy" onerror="this.remove()">` : ""}
          <div class="poster-placeholder"><div class="poster-brand">ELITEMOTION</div><div class="poster-name">${escapeHtml(p.name)}</div><div class="poster-series">${escapeHtml(p.collection)} · ${escapeHtml(p.code || "DIGITAL EDITION")}</div></div>
        </div>
        <div class="product-info"><span class="product-kicker">${escapeHtml(p.collection)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description || "Premium digital automotive artwork.")}</p><div class="product-bottom"><span class="price">${priceFor(p)}</span><button class="add-button" data-add="${escapeHtml(p.id)}" type="button">ADD TO BAG +</button></div></div>
      </article>`).join("");
  }
  function getProduct(id) { return products.find(p => String(p.id) === String(id)); }
  function addToCart(id) {
    const p = getProduct(id);
    if (!p) return;
    const item = cart.find(row => String(row.id) === String(id));
    if (item) item.quantity += 1;
    else cart.push({ id:p.id, quantity:1 });
    saveCart(); renderCart(); openCart();
  }
  function renderCart() {
    const count = cart.reduce((sum,row) => sum + row.quantity, 0);
    $("#cart-count").textContent = String(count);
    const items = cart.map(row => ({ ...row, product:getProduct(row.id) })).filter(row => row.product);
    $("#cart-items").innerHTML = items.length ? items.map(row => `
      <div class="cart-row"><div><strong>${escapeHtml(row.product.name)}</strong><small>${row.quantity} × ${priceFor(row.product)}</small></div><div><strong>${priceFor({...row.product, priceToman:Number(row.product.priceToman)*row.quantity, priceUSD:Number(row.product.priceUSD)*row.quantity})}</strong><br><button data-remove="${escapeHtml(row.id)}" type="button">Remove</button></div></div>`).join("") : '<p class="status-line">Your bag is empty.</p>';
    const totalToman = items.reduce((sum,row) => sum + Number(row.product.priceToman || 0)*row.quantity, 0);
    const totalUSD = items.reduce((sum,row) => sum + Number(row.product.priceUSD || 0)*row.quantity, 0);
    $("#cart-total").textContent = currency === "USD" ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(totalUSD) : `${new Intl.NumberFormat("fa-IR").format(totalToman)} تومان`;
  }
  function openCart() {
    $("#cart-panel").classList.add("open");
    $("#cart-panel").setAttribute("aria-hidden","false");
    $("#cart-backdrop").hidden = false;
  }
  function closeCart() {
    $("#cart-panel").classList.remove("open");
    $("#cart-panel").setAttribute("aria-hidden","true");
    $("#cart-backdrop").hidden = true;
  }
  async function loadProducts() {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Request failed");
      const data = await response.json();
      products = data.products || [];
      renderProducts(); renderCart();
    } catch {
      status.textContent = "Could not load the collection. Start the local server and refresh this page.";
      grid.innerHTML = '<div class="empty-state">Collection unavailable. Please try again after starting the server.</div>';
    }
  }
  $("#year").textContent = new Date().getFullYear();
  $("#search-input").addEventListener("input", renderProducts);
  $("#collection-filter").addEventListener("change", renderProducts);
  $("#sort-select").addEventListener("change", renderProducts);
  $("#currency-toggle").addEventListener("click", () => { currency = currency === "USD" ? "IRR" : "USD"; $("#currency-toggle").textContent = currency === "USD" ? "USD / تومان" : "تومان / USD"; renderProducts(); renderCart(); });
  $("#product-grid").addEventListener("click", e => { const button = e.target.closest("[data-add]"); if (button) addToCart(button.dataset.add); });
  $("#cart-items").addEventListener("click", e => {
    const button = e.target.closest("[data-remove]");
    if (button) { cart = cart.filter(row => String(row.id) !== String(button.dataset.remove)); saveCart(); renderCart(); }
  });
  $("#cart-open").addEventListener("click", openCart);
  $("#cart-close").addEventListener("click", closeCart);
  $("#cart-backdrop").addEventListener("click", closeCart);
  document.querySelectorAll("[data-collection]").forEach(button => button.addEventListener("click", () => {
    $("#collection-filter").value = button.dataset.collection;
    renderProducts();
    $("#shop").scrollIntoView({behavior:"smooth"});
  }));
  $("#checkout-button").disabled = true;
  loadProducts();
})();