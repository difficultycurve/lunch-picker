const defaultCategories = [
  { id: "all", label: "全部", icon: "🍽️" },
  { id: "rice", label: "米饭", icon: "🍚" },
  { id: "noodle", label: "面食", icon: "🍜" },
  { id: "light", label: "轻食", icon: "🥗" },
  { id: "fast", label: "快餐", icon: "🍔" },
  { id: "hot", label: "热辣", icon: "🌶️" }
];

const defaultFoods = [
  { id: "f01", name: "黄焖鸡米饭", category: "rice", emoji: "🍗" },
  { id: "f02", name: "隆江猪脚饭", category: "rice", emoji: "🍖" },
  { id: "f03", name: "咖喱鸡饭", category: "rice", emoji: "🍛" },
  { id: "f04", name: "烧腊双拼饭", category: "rice", emoji: "🍱" },
  { id: "f05", name: "兰州牛肉面", category: "noodle", emoji: "🍜" },
  { id: "f06", name: "重庆小面", category: "noodle", emoji: "🥢" },
  { id: "f07", name: "陕西油泼面", category: "noodle", emoji: "🍝" },
  { id: "f08", name: "馄饨水饺", category: "noodle", emoji: "🥟" },
  { id: "f09", name: "麻辣烫", category: "hot", emoji: "🌶️" },
  { id: "f10", name: "冒菜", category: "hot", emoji: "🥘" },
  { id: "f11", name: "螺蛳粉", category: "hot", emoji: "🍲" },
  { id: "f12", name: "酸菜鱼", category: "hot", emoji: "🐟" },
  { id: "f13", name: "鸡胸肉沙拉", category: "light", emoji: "🥗" },
  { id: "f14", name: "赛百味", category: "light", emoji: "🥪" },
  { id: "f15", name: "日式荞麦面", category: "light", emoji: "🍃" },
  { id: "f16", name: "麦当劳", category: "fast", emoji: "🍔" },
  { id: "f17", name: "肯德基", category: "fast", emoji: "🍗" },
  { id: "f18", name: "披萨", category: "fast", emoji: "🍕" }
];

const STORAGE = { foods: "lunch-picker-foods-v1", history: "lunch-picker-history-v1", categories: "lunch-picker-categories-v1" };
const $ = (selector) => document.querySelector(selector);
const els = {
  filterRow: $("#filterRow"), resultStage: $("#resultStage"), resultIcon: $("#resultIcon"),
  resultName: $("#resultName"), resultCategory: $("#resultCategory"), candidateCount: $("#candidateCount"),
  drawButton: $("#drawButton"), drawAgainButton: $("#drawAgainButton"), avoidRecent: $("#avoidRecent"),
  totalCount: $("#totalCount"), foodName: $("#foodName"), foodCategory: $("#foodCategory"),
  addForm: $("#addForm"), menuList: $("#menuList"), resetButton: $("#resetButton"),
  historySection: $("#historySection"), historyList: $("#historyList"), clearHistoryButton: $("#clearHistoryButton"),
  shareButton: $("#shareButton"), shareDialog: $("#shareDialog"), shareLink: $("#shareLink"),
  shareMenuToggle: $("#shareMenuToggle"),
  copyLinkButton: $("#copyLinkButton"), toast: $("#toast"), importButton: $("#importButton"),
  importDialog: $("#importDialog"), closeImportButton: $("#closeImportButton"), pastePanel: $("#pastePanel"),
  imagePanel: $("#imagePanel"), orderText: $("#orderText"), parseTextButton: $("#parseTextButton"),
  orderImages: $("#orderImages"), ocrProgress: $("#ocrProgress"), progressBar: $("#progressBar"),
  progressText: $("#progressText"), importPreview: $("#importPreview"), candidateList: $("#candidateList"),
  toggleCandidatesButton: $("#toggleCandidatesButton"), importCategory: $("#importCategory"),
  confirmImportButton: $("#confirmImportButton"), categoryDialog: $("#categoryDialog"),
  closeCategoryButton: $("#closeCategoryButton"), categoryAddForm: $("#categoryAddForm"),
  categoryIcon: $("#categoryIcon"), categoryName: $("#categoryName"), categoryList: $("#categoryList")
};

let categories = loadCategories();
let foods = loadFoods();
let history = loadHistory();
let activeCategory = "all";
let drawing = false;
let importCandidates = [];
let categoryEditTimer;

const importNoise = [
  /^(订单|订单详情|全部订单|外卖|美团|美团外卖|饿了么|饿了么外卖|首页|消息|我的|评价|再来一单|已完成|已送达|已取消|配送中|待付款|待收货|联系商家|申请售后|查看详情|展开|收起|商家配送|平台配送|准时宝|隐私号|号码保护|放心吃|红包|优惠券|配送费|打包费|餐盒费|实付|合计|小计|共\s*\d+\s*件|删除订单)$/i,
  /^\s*[¥￥]?\s*\d+(?:\.\d{1,2})?\s*元?\s*$/,
  /^\d{1,2}[:：]\d{2}/,
  /^\d{4}[-/.年]\d{1,2}/,
  /^(x|×)\s*\d+$/i,
  /^\d+\s*(分钟|公里|km|人食|份|件)$/i
];

function parseSharedFoods() {
  const data = new URLSearchParams(location.search).get("menu");
  if (!data) return null;
  try {
    const json = decodeURIComponent(Array.from(atob(data.replace(/-/g, "+").replace(/_/g, "/")), c => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    const parsed = JSON.parse(json);
    const sharedCategories = Array.isArray(parsed?.categories) ? sanitizeCategories(parsed.categories) : null;
    const sharedFoods = Array.isArray(parsed) ? parsed : parsed?.foods;
    if (sharedCategories?.length) {
      categories = sharedCategories;
      saveCategories();
    }
    if (!Array.isArray(sharedFoods) || !sharedFoods.length) return null;
    return sharedFoods.filter(item => item && typeof item.name === "string" && categories.some(c => c.id === item.category)).slice(0, 100).map((item, index) => ({
      id: `shared-${Date.now()}-${index}`,
      name: item.name.slice(0, 18),
      category: item.category,
      emoji: item.emoji || categoryOf(item.category).icon
    }));
  } catch { return null; }
}

function sanitizeCategories(items) {
  const cleaned = items.filter(item => item && typeof item.id === "string" && typeof item.label === "string")
    .slice(0, 30).map(item => ({ id: item.id.slice(0, 40), label: item.label.slice(0, 8), icon: String(item.icon || "🍽️").slice(0, 4) }));
  const withoutAll = cleaned.filter(item => item.id !== "all");
  return [{ id: "all", label: "全部", icon: "🍽️" }, ...withoutAll];
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.categories));
    return Array.isArray(saved) && saved.length > 1 ? sanitizeCategories(saved) : structuredClone(defaultCategories);
  } catch { return structuredClone(defaultCategories); }
}

function loadFoods() {
  const shared = parseSharedFoods();
  if (shared) {
    localStorage.setItem(STORAGE.foods, JSON.stringify(shared));
    window.history.replaceState({}, "", location.pathname);
    setTimeout(() => showToast("已载入朋友分享的饭单"), 300);
    return shared;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.foods));
    return Array.isArray(saved) && saved.length ? saved : structuredClone(defaultFoods);
  } catch { return structuredClone(defaultFoods); }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.history));
    return Array.isArray(saved) ? saved.slice(0, 12) : [];
  } catch { return []; }
}

function saveFoods() { localStorage.setItem(STORAGE.foods, JSON.stringify(foods)); }
function saveHistory() { localStorage.setItem(STORAGE.history, JSON.stringify(history)); }
function saveCategories() { localStorage.setItem(STORAGE.categories, JSON.stringify(categories)); }
function categoryOf(id) { return categories.find(c => c.id === id) || categories[0]; }
function candidates() { return activeCategory === "all" ? foods : foods.filter(food => food.category === activeCategory); }

function renderFilters() {
  els.filterRow.innerHTML = categories.map(category => `
    <button class="filter-button ${category.id === activeCategory ? "active" : ""}" type="button" data-category="${category.id}">
      ${escapeHtml(category.icon)} ${escapeHtml(category.label)}
    </button>`).join("") + `
    <button class="manage-category-button" type="button" data-manage-categories aria-label="管理分类" title="管理分类">
      <i data-lucide="settings-2" aria-hidden="true"></i>
    </button>`;
  refreshIcons();
}

function renderCategorySelect() {
  const currentFoodCategory = els.foodCategory.value;
  const currentImportCategory = els.importCategory.value;
  const options = categories.filter(c => c.id !== "all").map(c => `<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.label)}</option>`).join("");
  els.foodCategory.innerHTML = options;
  els.importCategory.innerHTML = options;
  if (categories.some(c => c.id === currentFoodCategory)) els.foodCategory.value = currentFoodCategory;
  if (categories.some(c => c.id === currentImportCategory)) els.importCategory.value = currentImportCategory;
}

function renderMenu() {
  els.totalCount.textContent = `${foods.length} 个选择`;
  els.candidateCount.textContent = candidates().length;
  els.menuList.innerHTML = foods.map(food => `
    <div class="menu-item">
      <span class="menu-emoji" aria-hidden="true">${escapeHtml(food.emoji)}</span>
      <div class="menu-copy">
        <div class="menu-name" title="${escapeHtml(food.name)}">${escapeHtml(food.name)}</div>
        <div class="menu-category">${categoryOf(food.category).label}</div>
      </div>
      <button class="delete-button" type="button" data-delete="${food.id}" aria-label="删除 ${escapeHtml(food.name)}" title="删除">
        <i data-lucide="trash-2" aria-hidden="true"></i>
      </button>
    </div>`).join("");
  refreshIcons();
}

function renderHistory() {
  els.historySection.hidden = history.length === 0;
  els.historyList.innerHTML = history.map((item, index) => `
    <li class="history-item">
      <span class="history-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="history-emoji" aria-hidden="true">${escapeHtml(item.emoji)}</span>
      <span class="history-name">${escapeHtml(item.name)}</span>
      <time class="history-time">${formatTime(item.time)}</time>
    </li>`).join("");
}

function draw() {
  if (drawing) return;
  const pool = candidates();
  if (!pool.length) return showToast("这个分类还没有选项，先加一个吧");
  let eligible = pool;
  if (els.avoidRecent.checked && pool.length > 3) {
    const recentIds = new Set(history.slice(0, 3).map(item => item.id));
    eligible = pool.filter(food => !recentIds.has(food.id));
    if (!eligible.length) eligible = pool;
  }

  drawing = true;
  els.drawButton.disabled = true;
  els.drawAgainButton.hidden = true;
  els.resultName.classList.add("rolling");
  let tick = 0;
  const totalTicks = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 15;
  const timer = setInterval(() => {
    const preview = pool[Math.floor(Math.random() * pool.length)];
    showResult(preview, false);
    tick += 1;
    if (tick >= totalTicks) {
      clearInterval(timer);
      const result = eligible[Math.floor(Math.random() * eligible.length)];
      showResult(result, true);
      history.unshift({ ...result, time: Date.now() });
      history = history.slice(0, 12);
      saveHistory();
      renderHistory();
      drawing = false;
      els.drawButton.disabled = false;
      els.drawAgainButton.hidden = false;
      els.drawButton.querySelector("span").textContent = "这次听命运的";
    }
  }, 75);
}

function showResult(food, final) {
  els.resultIcon.textContent = food.emoji;
  els.resultName.textContent = food.name;
  els.resultCategory.textContent = categoryOf(food.category).label;
  if (final) {
    els.resultName.classList.remove("rolling");
    els.resultStage.classList.remove("pop");
    void els.resultStage.offsetWidth;
    els.resultStage.classList.add("pop");
  }
}

function addFood(event) {
  event.preventDefault();
  const name = els.foodName.value.trim();
  const category = els.foodCategory.value;
  if (!name) return;
  if (foods.some(food => food.name.toLowerCase() === name.toLowerCase())) return showToast("饭单里已经有它了");
  const cat = categoryOf(category);
  foods.unshift({ id: `custom-${Date.now()}`, name, category, emoji: cat.icon });
  saveFoods();
  renderMenu();
  els.foodName.value = "";
  els.foodName.focus();
  showToast(`已加入：${name}`);
}

function removeFood(id) {
  if (foods.length <= 1) return showToast("至少留一个，不能饿着");
  const food = foods.find(item => item.id === id);
  foods = foods.filter(item => item.id !== id);
  saveFoods();
  renderMenu();
  if (food) showToast(`已移除：${food.name}`);
}

function resetFoods() {
  if (!confirm("恢复默认饭单？你后来添加的选项会被清掉。")) return;
  foods = structuredClone(defaultFoods);
  activeCategory = "all";
  saveFoods();
  renderFilters();
  renderMenu();
  showToast("已恢复默认饭单");
}

function openCategoryManager() {
  renderCategoryManager();
  els.categoryDialog.showModal();
}

function renderCategoryManager() {
  els.categoryList.innerHTML = categories.filter(category => category.id !== "all").map(category => {
    const usage = foods.filter(food => food.category === category.id).length;
    return `
      <div class="category-row" data-category-row="${category.id}">
        <input class="category-row-icon" value="${escapeHtml(category.icon)}" maxlength="4" aria-label="${escapeHtml(category.label)}分类图标" data-category-icon="${category.id}">
        <div>
          <input class="category-row-name" value="${escapeHtml(category.label)}" maxlength="8" aria-label="分类名称" data-category-name="${category.id}">
          <div class="category-usage">${usage} 个选择</div>
        </div>
        <button class="category-delete-button" type="button" data-delete-category="${category.id}" aria-label="删除${escapeHtml(category.label)}分类" title="删除分类">
          <i data-lucide="trash-2" aria-hidden="true"></i>
        </button>
      </div>`;
  }).join("");
  refreshIcons();
}

function addCategory(event) {
  event.preventDefault();
  const label = els.categoryName.value.trim();
  const icon = els.categoryIcon.value.trim() || "🍽️";
  if (!label) return;
  if (categories.some(category => category.label.toLowerCase() === label.toLowerCase())) return showToast("这个分类已经有了");
  categories.push({ id: `custom-${Date.now()}`, label: label.slice(0, 8), icon: icon.slice(0, 4) });
  saveCategories();
  els.categoryName.value = "";
  renderCategoryManager();
  refreshCategoryUi();
  if (!els.categoryDialog.open) els.categoryDialog.showModal();
  els.categoryName.focus();
  showToast(`已添加分类：${label}`);
}

function updateCategory(id, field, value) {
  const category = categories.find(item => item.id === id);
  if (!category) return;
  const cleaned = value.trim();
  if (!cleaned) {
    renderCategoryManager();
    return showToast(field === "label" ? "分类名称不能为空" : "图标不能为空");
  }
  if (field === "label" && categories.some(item => item.id !== id && item.label.toLowerCase() === cleaned.toLowerCase())) {
    renderCategoryManager();
    return showToast("分类名称不能重复");
  }
  category[field] = cleaned.slice(0, field === "label" ? 8 : 4);
  saveCategories();
  refreshCategoryUi();
}

function deleteCategory(id) {
  const category = categories.find(item => item.id === id);
  if (!category) return;
  const usedFoods = foods.filter(food => food.category === id);
  let targetId = categories.find(item => item.id !== "all" && item.id !== id)?.id;
  if (usedFoods.length) {
    const alternatives = categories.filter(item => item.id !== "all" && item.id !== id);
    if (!alternatives.length) return showToast("至少需要另一个分类来接收这些食物");
    const choices = alternatives.map(item => `${item.label}`).join("、");
    const answer = prompt(`“${category.label}”里有 ${usedFoods.length} 个选择。请输入要迁移到的分类名称：\n${choices}`, alternatives[0].label);
    if (answer === null) return;
    const target = alternatives.find(item => item.label.toLowerCase() === answer.trim().toLowerCase());
    if (!target) return showToast("没有找到这个目标分类");
    targetId = target.id;
    foods.forEach(food => { if (food.category === id) food.category = targetId; });
    saveFoods();
  }
  categories = categories.filter(item => item.id !== id);
  if (activeCategory === id) activeCategory = "all";
  saveCategories();
  renderCategoryManager();
  refreshCategoryUi();
  showToast(`已删除分类：${category.label}`);
}

function refreshCategoryUi() {
  renderCategorySelect();
  renderFilters();
  renderMenu();
}

function createShareUrl(includeMenu = false) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  if (!includeMenu) return url.toString();
  const compactFoods = foods.map(({ name, category, emoji }) => ({ name, category, emoji }));
  const compactCategories = categories.filter(item => item.id !== "all");
  const bytes = encodeURIComponent(JSON.stringify({ foods: compactFoods, categories: compactCategories })).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const encoded = btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  url.searchParams.set("menu", encoded);
  return url.toString();
}

function updateShareLink() {
  els.shareLink.value = createShareUrl(els.shareMenuToggle.checked);
}

function openShare() {
  els.shareMenuToggle.checked = false;
  updateShareLink();
  els.shareDialog.showModal();
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(els.shareLink.value);
  } catch {
    els.shareLink.select();
    document.execCommand("copy");
  }
  els.copyLinkButton.querySelector("span").textContent = "已复制";
  showToast("分享链接已复制");
  setTimeout(() => { els.copyLinkButton.querySelector("span").textContent = "复制"; }, 1800);
}

function openImport() {
  importCandidates = [];
  els.importPreview.hidden = true;
  els.orderImages.value = "";
  els.ocrProgress.hidden = true;
  switchImportTab("paste");
  els.importDialog.showModal();
  setTimeout(() => els.orderText.focus(), 100);
}

function switchImportTab(tab) {
  document.querySelectorAll("[data-import-tab]").forEach(button => {
    const active = button.dataset.importTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  els.pastePanel.hidden = tab !== "paste";
  els.imagePanel.hidden = tab !== "image";
  els.importPreview.hidden = true;
}

function cleanCandidate(line) {
  return line.replace(/[\t|]+/g, " ")
    .replace(/^[\s•·●○▪▫◆◇★☆▶>\-—_]+|[\s•·●○▪▫◆◇★☆▶>\-—_]+$/g, "")
    .replace(/^商家[：:]?\s*/i, "").replace(/\s{2,}/g, " ").trim();
}

function extractCandidates(text) {
  const lines = String(text).replace(/\r/g, "\n").split(/\n+/).map(cleanCandidate).filter(Boolean);
  const results = [];
  for (const line of lines) {
    if (line.length < 2 || line.length > 28 || importNoise.some(pattern => pattern.test(line))) continue;
    if (/^[\d\s¥￥+.,:：/年月日时分秒()-]+$/.test(line)) continue;
    if (/^(备注|地址|收货|骑手|送达|下单|支付|预计|实际|订单号|手机号|餐具|发票)/.test(line)) continue;
    if (/\d{6,}/.test(line)) continue;
    if (/(?:x|×)\s*\d+\s*$/i.test(line)) continue;
    const normalized = line.toLowerCase().replace(/[\s()（）·-]/g, "");
    if (!results.some(item => item.normalized === normalized)) results.push({ name: line, normalized });
  }
  return results.slice(0, 60).map(item => item.name);
}

function showImportCandidates(names) {
  importCandidates = names.map((name, index) => ({
    id: `candidate-${index}`,
    name,
    existing: foods.some(food => food.name.toLowerCase() === name.toLowerCase())
  }));
  if (!importCandidates.length) {
    els.importPreview.hidden = true;
    return showToast("暂时没认出商家名，可以精简文字后再试");
  }
  els.candidateList.innerHTML = importCandidates.map(item => `
    <label class="candidate-option ${item.existing ? "existing" : ""}">
      <input type="checkbox" value="${item.id}" ${item.existing ? "disabled" : "checked"}>
      <span>${escapeHtml(item.name)}</span>
      ${item.existing ? "<small>已在饭单</small>" : ""}
    </label>`).join("");
  els.importPreview.hidden = false;
  updateCandidateToggle();
}

function parseOrderText() {
  const text = els.orderText.value.trim();
  if (!text) return showToast("先粘贴一些订单文字");
  showImportCandidates(extractCandidates(text));
}

async function recognizeOrderImages(event) {
  const files = Array.from(event.target.files || []).slice(0, 10);
  if (!files.length) return;
  if (document.documentElement.dataset.ocrReady !== "true" || !window.Tesseract) return showToast("截图识别组件加载失败，请刷新后重试");
  els.ocrProgress.hidden = false;
  els.importPreview.hidden = true;
  els.orderImages.disabled = true;
  let fullText = "";
  try {
    for (let index = 0; index < files.length; index += 1) {
      els.progressText.textContent = `正在识别第 ${index + 1} / ${files.length} 张截图…`;
      const result = await Tesseract.recognize(files[index], "chi_sim+eng", {
        workerPath: "vendor/worker.min.js",
        logger: message => {
          if (typeof message.progress !== "number") return;
          els.progressBar.style.width = `${Math.round(((index + message.progress) / files.length) * 100)}%`;
        }
      });
      fullText += `\n${result.data.text}`;
    }
    els.progressBar.style.width = "100%";
    els.progressText.textContent = "识别完成，请确认下面的结果";
    showImportCandidates(extractCandidates(fullText));
  } catch (error) {
    console.error(error);
    els.progressText.textContent = "识别失败，请换一张清晰截图或使用文字导入";
    showToast("截图识别失败");
  } finally {
    els.orderImages.disabled = false;
  }
}

function updateCandidateToggle() {
  const enabled = Array.from(els.candidateList.querySelectorAll('input:not(:disabled)'));
  const allChecked = enabled.length > 0 && enabled.every(input => input.checked);
  els.toggleCandidatesButton.textContent = allChecked ? "取消全选" : "全部选择";
}

function toggleCandidates() {
  const enabled = Array.from(els.candidateList.querySelectorAll('input:not(:disabled)'));
  const shouldCheck = !enabled.every(input => input.checked);
  enabled.forEach(input => { input.checked = shouldCheck; });
  updateCandidateToggle();
}

function confirmImport() {
  const selectedIds = new Set(Array.from(els.candidateList.querySelectorAll("input:checked")).map(input => input.value));
  const selected = importCandidates.filter(item => selectedIds.has(item.id) && !item.existing);
  if (!selected.length) return showToast("至少选择一个新选项");
  const category = els.importCategory.value;
  const emoji = categoryOf(category).icon;
  const now = Date.now();
  selected.reverse().forEach((item, index) => foods.unshift({ id: `imported-${now}-${index}`, name: item.name.slice(0, 18), category, emoji }));
  saveFoods();
  renderMenu();
  els.importDialog.close();
  showToast(`已导入 ${selected.length} 个选项`);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

els.filterRow.addEventListener("click", event => {
  if (event.target.closest("[data-manage-categories]")) return openCategoryManager();
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderFilters();
  renderMenu();
});
els.drawButton.addEventListener("click", draw);
els.drawAgainButton.addEventListener("click", draw);
els.addForm.addEventListener("submit", addFood);
els.menuList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (button) removeFood(button.dataset.delete);
});
els.resetButton.addEventListener("click", resetFoods);
els.clearHistoryButton.addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
  showToast("足迹已清空");
});
els.shareButton.addEventListener("click", openShare);
els.copyLinkButton.addEventListener("click", copyShareLink);
els.shareMenuToggle.addEventListener("change", updateShareLink);
els.shareDialog.addEventListener("click", event => {
  if (event.target === els.shareDialog) els.shareDialog.close();
});
els.importButton.addEventListener("click", openImport);
els.closeImportButton.addEventListener("click", () => els.importDialog.close());
els.importDialog.addEventListener("click", event => {
  if (event.target === els.importDialog) els.importDialog.close();
});
document.querySelectorAll("[data-import-tab]").forEach(button => button.addEventListener("click", () => switchImportTab(button.dataset.importTab)));
els.parseTextButton.addEventListener("click", parseOrderText);
els.orderImages.addEventListener("change", recognizeOrderImages);
els.toggleCandidatesButton.addEventListener("click", toggleCandidates);
els.candidateList.addEventListener("change", updateCandidateToggle);
els.confirmImportButton.addEventListener("click", confirmImport);
els.closeCategoryButton.addEventListener("click", () => els.categoryDialog.close());
els.categoryDialog.addEventListener("click", event => {
  if (event.target === els.categoryDialog) els.categoryDialog.close();
});
els.categoryAddForm.addEventListener("submit", addCategory);
els.categoryList.addEventListener("input", event => {
  const nameInput = event.target.closest("[data-category-name]");
  const iconInput = event.target.closest("[data-category-icon]");
  clearTimeout(categoryEditTimer);
  categoryEditTimer = setTimeout(() => {
    if (nameInput) updateCategory(nameInput.dataset.categoryName, "label", nameInput.value);
    if (iconInput) updateCategory(iconInput.dataset.categoryIcon, "icon", iconInput.value);
  }, 220);
});
els.categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-category]");
  if (button) deleteCategory(button.dataset.deleteCategory);
});

renderCategorySelect();
renderFilters();
renderMenu();
renderHistory();
refreshIcons();
