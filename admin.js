const loginForm = document.getElementById('loginForm');
const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginFeedback = document.getElementById('loginFeedback');
const refreshBtn = document.getElementById('refreshBtn');
const totalRevenueEl = document.getElementById('totalRevenue');
const ordersList = document.getElementById('ordersList');

const PASSWORD = 'sd3admin';
const ORDER_STORAGE_KEY = 'shiraOrders';
const STATUS_OPTIONS = ['IN PROGRESS', 'AFGEROND'];

let orders = [];

const formatCurrency = (value) =>
  `SRD ${Number(value || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatStatusText = (status) => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AFGEROND') return 'Afgerond';
  if (normalized === 'IN PROGRESS') return 'In Progress';
  return normalized || 'In Progress';
};

const getOrderCreatedAt = (order) => order.createdAt || order.created_at || order.datetime || order.requestedDatetime;
const getOrderDeliveryAt = (order) => order.datetime || order.requestedDatetime || order.createdAt;

const loadOrdersFromStorage = () => {
  const stored = localStorage.getItem(ORDER_STORAGE_KEY);
  if (!stored) {
    orders = [];
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    orders = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Kon lokale bestellingen niet lezen.', error);
    orders = [];
  }
};

const saveOrdersToStorage = () => {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
};

const calculateRevenue = () =>
  orders.reduce((sum, order) => sum + Number(order.total || order.financials?.total || 0), 0);

const buildOrderItems = (items = []) =>
  items
    .map(
      (item) =>
        `<li>${item.label} &middot; ${item.qty ?? item.quantity} ${item.unit === 'stuks' ? 'stuks' : item.unit}</li>`
    )
    .join('');

const renderOrders = () => {
  if (!ordersList) return;
  if (!orders.length) {
    ordersList.innerHTML = '<p class="muted">Geen bestellingen gevonden.</p>';
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const statusValue = (order.status || 'IN PROGRESS').toUpperCase();
      return `
      <article class="history-card">
        <div class="history-card__header">
          <span class="status-badge history-card__status">${formatStatusText(statusValue)}</span>
        </div>
        <div class="history-card__details">
          <p><strong>Klant:</strong> ${order.customer?.name || 'Onbekend'}</p>
          <p><strong>E-mail:</strong> ${order.customer?.email || '-'}</p>
          <p><strong>Telefoon:</strong> ${order.customer?.phone || '-'}</p>
        </div>
        <div class="history-card__dates">
          <p><strong>Besteldatum:</strong> ${formatDateTime(getOrderCreatedAt(order))}</p>
          <p><strong>Leverdatum:</strong> ${formatDateTime(getOrderDeliveryAt(order))}</p>
        </div>
        <ul class="history-card__items">
          ${buildOrderItems(order.items || [])}
        </ul>
        <div class="history-card__footer">
          <strong>${formatCurrency(order.total || order.financials?.total)}</strong>
          <span class="muted small">Order ID: ${order.id}</span>
        </div>
        ${
          order.customer?.notes
            ? `<p class="history-card__notes"><strong>Notities:</strong> ${order.customer.notes}</p>`
            : ''
        }
        <label class="field field--inline history-card__status-control">
          <span>Status</span>
          <select class="status-select" data-id="${order.id}">
            ${STATUS_OPTIONS.map(
              (option) =>
                `<option value="${option}" ${statusValue === option ? 'selected' : ''}>${formatStatusText(option)}</option>`
            ).join('')}
          </select>
        </label>
      </article>
    `;
    })
    .join('');
};

const renderDashboard = () => {
  loadOrdersFromStorage();
  if (totalRevenueEl) {
    totalRevenueEl.textContent = formatCurrency(calculateRevenue());
  }
  renderOrders();
};

const unlockDashboard = () => {
  loginPanel?.classList.add('hidden');
  dashboard?.classList.remove('hidden');
  renderDashboard();
};

const handleLogin = (event) => {
  event.preventDefault();
  const value = document.getElementById('adminKeyInput').value.trim();
  if (!value) {
    loginFeedback.textContent = 'Voer het wachtwoord in.';
    loginFeedback.classList.add('feedback--error');
    return;
  }
  if (value !== PASSWORD) {
    loginFeedback.textContent = 'Incorrect wachtwoord';
    loginFeedback.classList.add('feedback--error');
    return;
  }
  loginFeedback.textContent = '';
  loginFeedback.classList.remove('feedback--error');
  unlockDashboard();
};

const updateOrderStatus = (orderId, status) => {
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return;
  orders[index].status = status;
  saveOrdersToStorage();
  renderDashboard();
};

loginForm?.addEventListener('submit', handleLogin);
refreshBtn?.addEventListener('click', renderDashboard);

ordersList?.addEventListener('change', (event) => {
  const select = event.target.closest('.status-select');
  if (!select) return;
  updateOrderStatus(select.dataset.id, select.value);
});

window.addEventListener('storage', (event) => {
  if (event.key === ORDER_STORAGE_KEY && !dashboard?.classList.contains('hidden')) {
    renderDashboard();
  }
});
