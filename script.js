const menuList = document.getElementById('menuList');
const orderMenuList = document.getElementById('orderMenuList');
const orderForm = document.getElementById('orderForm');
const orderSummaryEl = document.getElementById('orderSummary');
const fulfillmentRadios = document.querySelectorAll('input[name="fulfillment"]');
const addressField = document.getElementById('addressField');
const addressInput = document.getElementById('address');
const requestedDateInput = document.getElementById('requestedDate');
const requestedTimeSelect = document.getElementById('requestedTime');
const totalDisplay = document.getElementById('orderTotal');
const responseEl = document.getElementById('formResponse');
const yearEl = document.getElementById('year');
const burgerButton = document.getElementById('burgerButton');
const drawer = document.getElementById('optionsDrawer');
const drawerClose = document.getElementById('drawerClose');
const drawerScrim = document.getElementById('drawerScrim');
const drawerLinks = document.querySelectorAll('.drawer__link');
const ctaButton = document.getElementById('ctaButton');
const historyList = document.getElementById('historyList');
const sections = {
  menu: document.getElementById('menu'),
  bestellen: document.getElementById('bestellen'),
  orderHistory: document.getElementById('orderHistory')
};
const infoSection = document.querySelector('.section--info');
const appMain = document.querySelector('.app-main');
const historyShortcut = document.getElementById('historyShortcut');
let responseTimerId = null;
let activeSection = null;

const fallbackMenu = [
  {
    name: "Signature Devil'd Eggs",
    price: 20,
    priceLabel: 'SRD 20 per stuk',
    type: 'eggs',
    image: 'assets/menu/signature-eggs.jpeg',
    quantityRules: {
      min: 20,
      step: 5,
      max: 100
    }
  },
  {
    name: 'Xmas-Tree Eggs (Christmas Special)',
    price: 20,
    priceLabel: 'SRD 20 per stuk',
    type: 'eggs',
    image: 'assets/menu/xmas-eggs.jpeg',
    quantityRules: {
      min: 20,
      step: 5,
      max: 100
    }
  },
  {
    name: 'Huzarensalade from Heaven (A4)',
    price: 1800,
    priceLabel: 'SRD 1800',
    type: 'fixed',
    image: 'assets/menu/huzarensalade.jpeg',
    quantityLabel: 'A4'
  },
  {
    name: "Combo Deal (60 Signature Devil'd Eggs + A4 Huzarensalade)",
    price: 2900,
    priceLabel: 'SRD 2900 per combo',
    type: 'combo',
    image: 'assets/menu/combo-deal.jpeg',
    quantityLabel: 'combo',
    quantityRules: {
      min: 1,
      max: 10,
      step: 1
    }
  },
  {
    name: 'Koude Schotel (A4)',
    price: 1500,
    priceLabel: 'SRD 1500',
    type: 'fixed',
    image: 'assets/menu/koude-schotel.jpg',
    quantityLabel: 'A4'
  }
];

const NAME_OVERRIDES = {
  'Koude Schotel': 'Koude Schotel (A4)'
};

const ORDERED_TITLES = [
  "Signature Devil'd Eggs",
  'Xmas-Tree Eggs (Christmas Special)',
  'Huzarensalade from Heaven (A4)',
  'Koude Schotel (A4)',
  "Combo Deal (60 Signature Devil'd Eggs + A4 Huzarensalade)"
];

const TRAY_ITEMS = new Set(['Huzarensalade from Heaven (A4)', 'Koude Schotel (A4)']);
const BEST_SELLER_NAME = "Signature Devil'd Eggs";
const NEW_TAG_ITEMS = new Set(['Koude Schotel (A4)']);
const VALUE_TAG_ITEMS = new Set(["Combo Deal (60 Signature Devil'd Eggs + A4 Huzarensalade)"]);
const HALF_HOUR_STEP = 30;
const MIN_OFFSET_HOURS = 24;
let earliestAllowedSlot = null;
const historyData = [
  {
    id: 'HIS-2401',
    datetime: '2025-01-12T14:30:00',
    status: 'Afgerond',
    total: 1680,
     customer: {
       name: 'Laura Pinas',
       email: 'laura@example.com',
       phone: '+597 8123456',
       notes: 'Afleveren bij receptie.'
     },
    items: [
      { label: "Signature Devil'd Eggs", qty: 40, unit: 'stuks' },
      { label: 'Huzarensalade from Heaven (A4)', qty: 1, unit: 'A4' }
    ]
  }
];

let menuItems = [];
const orderState = {};

const slugify = (text) => {
  if (!text) return `item-${Math.random().toString(36).slice(2, 8)}`;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const toNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const renameTitle = (title) => NAME_OVERRIDES[title] || title;
const isTrayItem = (item) => TRAY_ITEMS.has(item.title);
const isBestSeller = (item) => item.title === BEST_SELLER_NAME;
const isNewItem = (item) => NEW_TAG_ITEMS.has(item.title);
const isValueItem = (item) => VALUE_TAG_ITEMS.has(item.title);
const isComboDeal = (item) => item.title === "Combo Deal (60 Signature Devil'd Eggs + A4 Huzarensalade)";

const getStep = (item) => toNumber(item.stepQuantity, toNumber(item.batchSize, 1));
const getMin = (item) => toNumber(item.minQuantity, getStep(item));
const getMax = (item) => toNumber(item.maxQuantity, null) ?? Infinity;
const getFixedQuantity = (item) => {
  const fixed = toNumber(item.fixedQuantity, null);
  return fixed && fixed > 0 ? fixed : null;
};
const isFixedItem = (item) => getFixedQuantity(item) !== null;
const getUnitPrice = (item) => {
  const pricePerUnit = toNumber(item.pricePerUnit, null);
  if (pricePerUnit && pricePerUnit > 0) return pricePerUnit;
  const pricePerBatch = toNumber(item.pricePerBatch, 0) || 0;
  const batchSize = toNumber(item.batchSize, 1) || 1;
  return pricePerBatch / batchSize;
};
const formatCurrency = (value) =>
  `SRD ${Number(value || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getOrderCreatedAt = (order) => order.createdAt || order.created_at || order.datetime || order.requestedDatetime;
const getOrderDeliveryAt = (order) => order.datetime || order.requestedDatetime || order.createdAt;
const getUnitDisplay = (item) => {
  const fallback = isTrayItem(item) ? 'A4' : 'stuk';
  const label = (item.unitLabel || fallback).trim();
  if (label.toLowerCase() === 'stuks') {
    return 'stuk';
  }
  return label;
};
const formatPriceLabel = (item) =>
  item.displayPrice || `${formatCurrency(getUnitPrice(item))} per ${getUnitDisplay(item)}`;
const getLineTotal = (item, quantity) => getUnitPrice(item) * quantity;
const getQuantityLabel = (item, quantity) => {
  const unit = (item.unitLabel || (isTrayItem(item) ? 'A4' : 'stuks')).trim();
  if (unit.toLowerCase() === 'stuks') {
    return `${quantity} stuks`;
  }
  return `${quantity} x ${unit}`;
};

const canCancelOrder = (order) => {
  const orderTime = new Date(order.datetime);
  const diff = orderTime.getTime() - Date.now();
  return diff >= MIN_OFFSET_HOURS * 60 * 60 * 1000;
};

const setResponseMessage = (message, variant, autoHide = true) => {
  if (!responseEl) return;
  clearTimeout(responseTimerId);
  responseEl.classList.remove('form-response--error', 'form-response--success', 'form-response--info');
  if (!message) {
    responseEl.textContent = '';
    responseEl.style.opacity = 0;
    return;
  }
  responseEl.textContent = message;
  responseEl.style.opacity = 1;
  if (variant) {
    responseEl.classList.add(variant);
  }
  if (autoHide) {
    responseTimerId = setTimeout(() => setResponseMessage('', null, false), 3500);
  }
};

const updateHistoryButtonVisibility = () => {
  if (!historyShortcut) return;
  const shouldShow = historyData.length > 0 && activeSection !== 'orderHistory';
  historyShortcut.classList.toggle('btn--history--hidden', !shouldShow);
};

const getBadges = (item) => {
  const badges = [];
  if (isBestSeller(item)) {
    badges.push('Best Seller');
  }
  if (isNewItem(item)) {
    badges.push('New');
  }
  if (isValueItem(item)) {
    badges.push('Value');
  }
  return badges;
};

const formatStatusText = (status) => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AFGEROND' || normalized === 'COMPLETED') return 'Afgerond';
  if (normalized === 'IN PROGRESS' || normalized === 'IN_PROGRESS') return 'In Progress';
  return normalized || 'In Progress';
};

const formatDateValue = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatTimeValue = (hours, minutes) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
};

const roundToNextSlot = (date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % HALF_HOUR_STEP;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + HALF_HOUR_STEP - remainder);
  }
  return rounded;
};

const getEarliestAllowedSlot = () => {
  const now = new Date();
  const future = new Date(now.getTime() + MIN_OFFSET_HOURS * 60 * 60 * 1000);
  return roundToNextSlot(future);
};

const refreshTimeOptions = () => {
  if (!requestedDateInput || !requestedTimeSelect || !earliestAllowedSlot) return;
  let dateValue = requestedDateInput.value;
  const minDate = formatDateValue(earliestAllowedSlot);
  if (!dateValue) {
    dateValue = minDate;
    requestedDateInput.value = minDate;
  } else if (dateValue < minDate) {
    dateValue = minDate;
    requestedDateInput.value = minDate;
  }

  const isEarliestDate = dateValue === minDate;
  const cutoffMinutes = earliestAllowedSlot.getHours() * 60 + earliestAllowedSlot.getMinutes();
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += HALF_HOUR_STEP) {
    if (isEarliestDate && minutes < cutoffMinutes) continue;
    const hours = Math.floor(minutes / 60);
    const minuteValue = minutes % 60;
    options.push(formatTimeValue(hours, minuteValue));
  }

  requestedTimeSelect.innerHTML = options
    .map((time) => `<option value="${time}">${time}</option>`)
    .join('');

  const previous = requestedTimeSelect.dataset.previousValue;
  if (previous && options.includes(previous)) {
    requestedTimeSelect.value = previous;
  } else if (options.length > 0) {
    requestedTimeSelect.value = options[0];
  } else {
    requestedTimeSelect.value = '';
  }
  requestedTimeSelect.dataset.previousValue = requestedTimeSelect.value;
};

const initializeDateTimeControls = () => {
  if (!requestedDateInput || !requestedTimeSelect) return;
  earliestAllowedSlot = getEarliestAllowedSlot();
  const minDate = formatDateValue(earliestAllowedSlot);
  requestedDateInput.min = minDate;
  if (!requestedDateInput.value || requestedDateInput.value < minDate) {
    requestedDateInput.value = minDate;
  }
  refreshTimeOptions();
};

const toggleAddressField = () => {
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked');
  if (fulfillment && fulfillment.value === 'bezorgen') {
    addressField.classList.remove('hidden');
    addressInput.required = true;
  } else {
    addressField.classList.add('hidden');
    addressInput.required = false;
    addressInput.value = '';
  }
};

const openDrawer = () => {
  drawer?.classList.add('drawer--open');
  drawerScrim?.classList.add('drawer__scrim--visible');
  if (drawer) {
    drawer.setAttribute('aria-hidden', 'false');
  }
};

const closeDrawer = () => {
  drawer?.classList.remove('drawer--open');
  drawerScrim?.classList.remove('drawer__scrim--visible');
  if (drawer) {
    drawer.setAttribute('aria-hidden', 'true');
  }
};

const activateSection = (target) => {
  activeSection = target;
  appMain?.classList.remove('app-main--hidden');
  Object.values(sections).forEach((section) => {
    section?.classList.remove('app-section--active');
  });
  const section = sections[target];
  if (section) {
    section.classList.remove('app-section--hidden');
    section.classList.add('app-section--active');
    closeDrawer();
    requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (infoSection) {
    infoSection.classList.remove('app-section--hidden');
    infoSection.classList.add('app-section--active');
  }
  updateHistoryButtonVisibility();
};

const renderSummary = () => {
  if (!orderSummaryEl) return;
  const activeItems = menuItems
    .map((item) => ({ item, quantity: orderState[item.id] || 0 }))
    .filter((entry) => entry.quantity > 0);

  if (!activeItems.length) {
    orderSummaryEl.innerHTML =
      '<h3 class="order-summary__heading">Winkelmand</h3><p class="muted small">Nog geen items in de winkelmand.</p>';
    return;
  }

  const listItems = activeItems
    .map(({ item, quantity }) => {
      const qtyLabel = getQuantityLabel(item, quantity);
      const unitPrice = formatCurrency(getUnitPrice(item));
      const displayUnit = getUnitDisplay(item);
      const lineTotal = formatCurrency(getLineTotal(item, quantity));
      return `
        <li class="order-summary__item">
          <div>
            <p class="order-summary__name">${item.title}</p>
            <p class="order-summary__meta">${qtyLabel}</p>
            <p class="order-summary__price">${unitPrice} per ${displayUnit}</p>
          </div>
          <span class="order-summary__total">${lineTotal}</span>
        </li>
      `;
    })
    .join('');

  orderSummaryEl.innerHTML = `
    <h3 class="order-summary__heading">Winkelmand</h3>
    <ul class="order-summary__list">${listItems}</ul>
  `;
};

const renderHistory = () => {
  if (!historyList) return;
  const allowed = ['AFGEROND', 'IN PROGRESS'];
  const filtered = historyData.filter((entry) => allowed.includes((entry.status || '').toUpperCase()));
  if (!filtered.length) {
    historyList.innerHTML = '<p class="muted small">Geen bestellingen beschikbaar.</p>';
    return;
  }
  const markup = filtered
    .map(
      (entry) => `
      <article class="history-card">
        <div class="history-card__header">
          <span class="status-badge history-card__status">${formatStatusText(entry.status)}</span>
        </div>
        <div class="history-card__details">
          <p><strong>Klant:</strong> ${entry.customer?.name || 'Onbekend'}</p>
          <p><strong>E-mail:</strong> ${entry.customer?.email || '-'}</p>
          <p><strong>Telefoon:</strong> ${entry.customer?.phone || '-'}</p>
        </div>
        <div class="history-card__dates">
          <p><strong>Besteldatum:</strong> ${formatDateTime(getOrderCreatedAt(entry))}</p>
          <p><strong>Leverdatum:</strong> ${formatDateTime(getOrderDeliveryAt(entry))}</p>
        </div>
        <ul class="history-card__items">
          ${entry.items
            .map((item) => `<li>${item.label} &middot; ${item.qty} ${item.unit === 'stuks' ? 'stuks' : 'A4'}</li>`)
            .join('')}
        </ul>
        <div class="history-card__footer">
          <strong>${formatCurrency(entry.total)}</strong>
          <span class="muted small">Order ID: ${entry.id}</span>
        </div>
        ${
          entry.customer?.notes
            ? `<p class="history-card__notes"><strong>Notities:</strong> ${entry.customer.notes}</p>`
            : ''
        }
        ${
          canCancelOrder(entry)
            ? `<button class="history-card__cancel" data-cancel-id="${entry.id}">Bestelling Annuleren</button>`
            : ''
        }
      </article>
    `
    )
    .join('');
  historyList.innerHTML = markup;
};

const updateTotal = () => {
  const total = menuItems.reduce((sum, item) => sum + getLineTotal(item, orderState[item.id] || 0), 0);
  totalDisplay.textContent = formatCurrency(total);
  renderSummary();
};

const refreshCardDisplay = (item) => {
  const card = orderMenuList?.querySelector(`[data-id="${item.id}"]`);
  if (!card) return;
  const wasActive = card.classList.contains('order-menu-card--active');
  const quantity = orderState[item.id] || 0;
  card.classList.toggle('order-menu-card--active', quantity > 0);
  if (quantity > 0 && !wasActive) {
    card.classList.add('order-menu-card--flash');
    setTimeout(() => {
      card.classList.remove('order-menu-card--flash');
    }, 220);
  }

  const amountEl = card.querySelector('[data-role="amount"]');
  if (amountEl) amountEl.textContent = quantity;

  const decreaseBtn = card.querySelector('button[data-action="decrease"]');
  if (decreaseBtn) decreaseBtn.disabled = quantity === 0;

  const increaseBtn = card.querySelector('button[data-action="increase"]');
  if (increaseBtn) increaseBtn.disabled = quantity >= getMax(item);

  const toggleBtn = card.querySelector('button[data-action="toggle"]');
  if (toggleBtn) toggleBtn.textContent = quantity > 0 ? 'Verwijder' : 'Voeg toe';
};

const applyQuantity = (item, nextQuantity) => {
  const fixedQuantity = getFixedQuantity(item);
  if (fixedQuantity) {
    orderState[item.id] = nextQuantity > 0 ? fixedQuantity : 0;
    refreshCardDisplay(item);
    updateTotal();
    return;
  }

  const min = getMin(item);
  const max = getMax(item);
  const step = getStep(item);
  let next = nextQuantity;

  if (next <= 0) {
    orderState[item.id] = 0;
    refreshCardDisplay(item);
    updateTotal();
    return;
  }

  next = Math.max(min, Math.min(max, next));
  const relative = next - min;
  if (relative % step !== 0) {
    const steps = Math.floor(relative / step);
    next = min + steps * step;
    if (next < min) next = min;
  }

  orderState[item.id] = next;
  refreshCardDisplay(item);
  updateTotal();
};

const incrementItem = (item) => {
  const fixedQuantity = getFixedQuantity(item);
  if (fixedQuantity) {
    orderState[item.id] = fixedQuantity;
    refreshCardDisplay(item);
    updateTotal();
    return;
  }

  const current = orderState[item.id] || 0;
  const next = current === 0 ? getMin(item) : current + getStep(item);
  applyQuantity(item, next);
};

const decrementItem = (item) => {
  const fixedQuantity = getFixedQuantity(item);
  if (fixedQuantity) {
    orderState[item.id] = 0;
    refreshCardDisplay(item);
    updateTotal();
    return;
  }

  const current = orderState[item.id] || 0;
  const next = current - getStep(item);
  if (next < getMin(item)) {
    applyQuantity(item, 0);
  } else {
    applyQuantity(item, next);
  }
};

const toggleFixedItem = (item) => {
  const fixedQuantity = getFixedQuantity(item) || 1;
  orderState[item.id] = orderState[item.id] > 0 ? 0 : fixedQuantity;
  refreshCardDisplay(item);
  updateTotal();
};

const handleOrderMenuInteraction = (event) => {
  const card = event.target.closest('.order-menu-card');
  if (!card) return;
  const item = menuItems.find((entry) => entry.id === card.dataset.id);
  if (!item) return;

  const button = event.target.closest('button[data-action]');
  if (button) {
    event.stopPropagation();
    const action = button.dataset.action;
    if (action === 'increase') {
      incrementItem(item);
    } else if (action === 'decrease') {
      decrementItem(item);
    } else if (action === 'toggle') {
      toggleFixedItem(item);
    }
    return;
  }

  if (isFixedItem(item)) {
    toggleFixedItem(item);
  } else {
    incrementItem(item);
  }
};

const buildMenuCards = () => {
  menuList.innerHTML = menuItems
    .map((item) => {
      const imageMarkup = item.image
        ? `<div class="menu-item__image-wrapper"><img src="${item.image}" alt="${item.title}" class="menu-item__image" loading="lazy" /></div>`
        : '';
      const badgeMarkup = getBadges(item)
        .map((label) => `<span class="menu-item__badge">${label}</span>`)
        .join(' ');
      return `
      <article class="menu-item${isComboDeal(item) ? ' menu-item--combo' : ''}">
        ${imageMarkup}
        <div class="menu-item__title">
          <h3 class="menu-item__name">${item.title}${badgeMarkup ? ` ${badgeMarkup}` : ''}</h3>
          <span class="menu-item__price">${formatPriceLabel(item)}</span>
        </div>
        <p>${item.description || 'Beschikbaar op aanvraag.'}</p>
      </article>
    `;
    })
    .join('');

  orderMenuList.innerHTML = menuItems
    .map((item) => {
      const min = getMin(item);
      const max = getMax(item);
      const step = getStep(item);
      const fixedQuantity = getFixedQuantity(item);
      const maxLabel = max === Infinity ? 'geen limiet' : max;
      const badges = getBadges(item)
        .map((label) => `<span class="menu-item__badge menu-item__badge--inline">${label}</span>`)
        .join(' ');
      const rulesLabel = isTrayItem(item)
        ? `${item.unitLabel || 'A4'} &middot; Min ${min} &middot; Stap ${step} &middot; Max ${maxLabel}`
        : `Min ${min} &middot; Stap ${step} &middot; Max ${maxLabel}`;

      const controls = fixedQuantity
        ? `
        <div class="order-menu-card__controls order-menu-card__fixed">
          <button type="button" class="btn btn--ghost" data-action="toggle">Voeg toe</button>
          <p class="order-menu-card__rules">${item.unitLabel || 'Vast formaat'}</p>
        </div>
      `
        : `
        <div class="order-menu-card__controls">
          <div class="quantity-input" role="group" aria-label="Aantal ${item.title}">
            <button type="button" data-action="decrease" aria-label="verlaag hoeveelheid">-</button>
            <span data-role="amount">0</span>
            <button type="button" data-action="increase" aria-label="verhoog hoeveelheid">+</button>
          </div>
          <p class="order-menu-card__rules">${rulesLabel}</p>
        </div>
      `;

      return `
        <div class="order-menu-card" data-id="${item.id}">
          <div class="order-menu-card__body">
            <p class="menu-item__title">
              <span class="menu-item__name">${item.title}${badges ? ` ${badges}` : ''}</span>
              <span class="menu-item__price">${formatPriceLabel(item)}</span>
            </p>
            <p class="muted small">${item.description || ''}</p>
          </div>
          ${controls}
        </div>
      `;
    })
    .join('');

  menuItems.forEach((item) => refreshCardDisplay(item));
};

const resetQuantities = () => {
  Object.keys(orderState).forEach((key) => {
    orderState[key] = 0;
  });
  menuItems.forEach((item) => refreshCardDisplay(item));
  updateTotal();
};

const submitOrder = (event) => {
  event.preventDefault();
  setResponseMessage('', null, false);

  const dateValue = requestedDateInput?.value;
  const timeValue = requestedTimeSelect?.value;
  if (!dateValue || !timeValue) {
    setResponseMessage('Kies een datum en tijdslot.', 'form-response--error');
    return;
  }

  const items = menuItems
    .map((item) => ({ id: item.id, quantity: orderState[item.id] || 0 }))
    .filter((entry) => entry.quantity > 0);

  if (!items.length) {
    setResponseMessage('Selecteer minimaal een gerecht.', 'form-response--error');
    return;
  }

  const totalPrice = items.reduce((sum, entry) => {
    const menuItem = menuItems.find((item) => item.id === entry.id);
    return sum + getLineTotal(menuItem, entry.quantity);
  }, 0);

  const flattenedItems = items.map((entry) => {
    const menuItem = menuItems.find((item) => item.id === entry.id);
    return {
      label: menuItem.title,
      qty: entry.quantity,
      unit: menuItem.unitLabel || (isTrayItem(menuItem) ? 'A4' : 'stuks')
    };
  });

  const customerInfo = {
    name: document.getElementById('customerName').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    notes: document.getElementById('notes').value.trim()
  };

  const newOrder = {
    id: `LOCAL-${Date.now()}`,
    datetime: `${dateValue}T${timeValue}`,
    status: 'IN PROGRESS',
    createdAt: new Date().toISOString(),
    total: totalPrice,
    customer: customerInfo,
    items: flattenedItems
  };

  historyData.unshift(newOrder);
  localStorage.setItem('shiraOrders', JSON.stringify(historyData));
  renderHistory();
  updateHistoryButtonVisibility();
  setResponseMessage('Bestelling bevestigd.', 'form-response--success');
  orderForm.reset();
  toggleAddressField();
  initializeDateTimeControls();
  resetQuantities();
};

const applyTrayOverrides = (item) => {
  if (!TRAY_ITEMS.has(item.title)) {
    return item;
  }
  return {
    ...item,
    minQuantity: 1,
    maxQuantity: 10,
    stepQuantity: 1,
    fixedQuantity: null,
    unitLabel: 'A4'
  };
};

const sortMenu = (items) =>
  items.sort((a, b) => {
    const aIndex = ORDERED_TITLES.indexOf(a.title);
    const bIndex = ORDERED_TITLES.indexOf(b.title);
    if (aIndex === -1 && bIndex === -1) {
      return a.title.localeCompare(b.title);
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

const normalizeMenuData = (items) => {
  if (!Array.isArray(items) || !items.length) {
    const normalizedFallback = fallbackMenu.map((item, index) => {
      const renamedTitle = renameTitle(item.name);
      const mapped = {
        id: slugify(`${renamedTitle}-${index}`),
        title: renamedTitle,
        description: '',
        displayPrice: item.priceLabel,
        pricePerUnit: toNumber(item.price, 0) || 0,
        minQuantity: toNumber(item.quantityRules?.min, null) ?? (item.type === 'eggs' ? 20 : 1),
        maxQuantity: toNumber(item.quantityRules?.max, null) ?? (item.type === 'eggs' ? 100 : 1),
        stepQuantity: toNumber(item.quantityRules?.step, null) ?? (item.type === 'eggs' ? 5 : 1),
        fixedQuantity: item.type === 'fixed' ? 1 : null,
        unitLabel: item.quantityLabel || (item.type === 'eggs' ? 'stuks' : 'A4'),
        pricePerBatch: toNumber(item.price, 0) || 0,
        batchSize: item.type === 'eggs' ? 5 : 1,
        image: item.image || ''
      };
      return applyTrayOverrides(mapped);
    });
    return sortMenu(normalizedFallback);
  }

  const normalized = items.map((item, index) => {
    const baseTitle = item.title || item.name || `Menu item ${index + 1}`;
    const normalizedTitle = renameTitle(baseTitle);
    const mapped = {
      id: item.id || slugify(`${normalizedTitle}-${index}`),
      title: normalizedTitle,
      description: item.description || '',
      displayPrice: item.displayPrice || item.priceLabel || '',
      pricePerUnit: toNumber(item.pricePerUnit ?? item.price ?? item.pricePerBatch, 0) || 0,
      minQuantity: toNumber(item.minQuantity ?? item.quantityRules?.min, null) ?? (item.type === 'fixed' ? 1 : 20),
      maxQuantity: toNumber(item.maxQuantity ?? item.quantityRules?.max, null) ?? (item.type === 'fixed' ? 1 : 100),
      stepQuantity: toNumber(item.stepQuantity ?? item.quantityRules?.step, null) ?? (item.type === 'fixed' ? 1 : 5),
      fixedQuantity: toNumber(item.fixedQuantity, null) ?? (item.type === 'fixed' ? 1 : null),
      unitLabel: item.unitLabel || item.quantityLabel || (item.type === 'fixed' ? 'A4' : 'stuks'),
      pricePerBatch: toNumber(item.pricePerBatch ?? item.price, 0) || 0,
      batchSize: toNumber(item.batchSize, null) ?? (item.type === 'eggs' ? 5 : 1),
      image: item.image || ''
    };
    return applyTrayOverrides(mapped);
  });

  return sortMenu(normalized);
};

const loadMenu = async () => {
  const hydrateMenu = (data) => {
    menuItems = normalizeMenuData(data);
    menuItems.forEach((item) => {
      orderState[item.id] = 0;
    });
    buildMenuCards();
    updateTotal();
  };

  try {
    const res = await fetch('/api/menu');
    if (!res.ok) {
      hydrateMenu(fallbackMenu);
      return;
    }
    const remoteMenu = await res.json();
    if (!Array.isArray(remoteMenu) || !remoteMenu.length) {
      hydrateMenu(fallbackMenu);
      return;
    }
    hydrateMenu(remoteMenu);
  } catch (error) {
    console.warn('Menu laden mislukt, gebruik fallback.', error);
    hydrateMenu(fallbackMenu);
  }
};

orderMenuList?.addEventListener('click', handleOrderMenuInteraction);
orderForm?.addEventListener('submit', submitOrder);
requestedDateInput?.addEventListener('change', () => {
  refreshTimeOptions();
});
requestedTimeSelect?.addEventListener('change', (event) => {
  requestedTimeSelect.dataset.previousValue = event.target.value;
});
fulfillmentRadios.forEach((radio) => radio.addEventListener('change', toggleAddressField));
burgerButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
drawerScrim?.addEventListener('click', closeDrawer);
drawerLinks.forEach((link) =>
  link.addEventListener('click', () => {
    const target = link.dataset.target;
    if (target) {
      if (target === 'orderHistory') {
        renderHistory();
      }
      activateSection(target);
    }
  })
);
ctaButton?.addEventListener('click', () => {
  activateSection('bestellen');
});
historyShortcut?.addEventListener('click', () => {
  renderHistory();
  activateSection('orderHistory');
});
historyList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cancel-id]');
  if (!button) return;
  const { cancelId } = button.dataset;
  const confirmed = window.confirm('Ben je zeker dat je deze bestelling wilt annuleren?');
  if (!confirmed) {
    setResponseMessage('Bestelling niet verwijderd.', 'form-response--error');
    return;
  }
  const card = button.closest('.history-card');
  const removeOrder = () => {
    const index = historyData.findIndex((entry) => entry.id === cancelId);
    if (index !== -1) {
      historyData.splice(index, 1);
      localStorage.setItem('shiraOrders', JSON.stringify(historyData));
      renderHistory();
      updateHistoryButtonVisibility();
      setResponseMessage('Bestelling succesvol verwijderd.', 'form-response--success');
    } else {
      setResponseMessage('Bestelling niet verwijderd.', 'form-response--error');
    }
  };
  if (card) {
    card.classList.add('history-card--removing');
    setTimeout(removeOrder, 400);
  } else {
    removeOrder();
  }
});
initializeDateTimeControls();
toggleAddressField();
const storedOrders = localStorage.getItem('shiraOrders');
if (storedOrders) {
  try {
    const parsed = JSON.parse(storedOrders);
    if (Array.isArray(parsed)) {
      historyData.splice(0, historyData.length, ...parsed);
    }
  } catch (error) {
    console.warn('Kon opgeslagen bestellingen niet laden.', error);
  }
}
renderHistory();
updateHistoryButtonVisibility();
loadMenu();
if (yearEl) {
  yearEl.textContent = '2020';
}

window.addEventListener('storage', (event) => {
  if (event.key === 'shiraOrders') {
    try {
      const next = JSON.parse(event.newValue || '[]');
      if (Array.isArray(next)) {
        historyData.splice(0, historyData.length, ...next);
        renderHistory();
        updateHistoryButtonVisibility();
      }
    } catch (error) {
      console.warn('Kon bestellingen niet synchroniseren via storage.', error);
    }
  }
});
