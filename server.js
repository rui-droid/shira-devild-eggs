const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const NOTIFICATION_LOG = path.join(DATA_DIR, 'notifications.log');
const ADMIN_KEY = process.env.ADMIN_KEY || 'shira-golden-key';
const ORDER_STATUSES = ['Nieuw', 'In behandeling', 'Klaar', 'Afgerond'];
const MIN_BATCH_SIZE = 5;

app.use(express.json());
app.use(express.static(__dirname));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  if (!fs.existsSync(STORE_PATH)) {
    const defaultData = {
      menu: [
        {
          id: 'signature-devild-eggs',
          title: "Signature Devil'd Eggs",
          description: 'Onze iconische klassieker met gele mosterd, bieslook en een vleugje peper.',
          pricePerBatch: 100,
          batchSize: 5,
          pricePerUnit: 20,
          displayPrice: 'SRD 20 per stuk | SRD 200 per 10 stuks',
          minQuantity: 20,
          maxQuantity: 100,
          stepQuantity: 5,
          unitLabel: 'stuks'
        },
        {
          id: 'huzarensalade-heaven',
          title: 'Huzarensalade from Heaven (A4)',
          description: 'A4-plank vol huisgemaakte huzarensalade met truffel en ingelegde groentjes.',
          pricePerBatch: 1800,
          batchSize: 1,
          pricePerUnit: 1800,
          displayPrice: 'SRD 1800',
          minQuantity: 1,
          maxQuantity: 1,
          stepQuantity: 1,
          fixedQuantity: 1
        },
        {
          id: 'koude-schotel',
          title: 'Koude Schotel',
          description: 'Retro-chic koude schotel met smoked chicken, cassave en citrus.',
          pricePerBatch: 1500,
          batchSize: 1,
          pricePerUnit: 1500,
          displayPrice: 'SRD 1500',
          minQuantity: 1,
          maxQuantity: 1,
          stepQuantity: 1,
          fixedQuantity: 1
        },
        {
          id: 'xmas-tree-eggs',
          title: 'Xmas-Tree Eggs (Christmas Special)',
          description: 'Feestelijke towers met pistache, cranberry en bladgoud.',
          pricePerBatch: 100,
          batchSize: 5,
          pricePerUnit: 20,
          displayPrice: 'SRD 20 per stuk | SRD 200 per 10 stuks',
          minQuantity: 20,
          maxQuantity: 100,
          stepQuantity: 5,
          unitLabel: 'stuks'
        }
      ],
      orders: []
    };

    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
  }

  if (!fs.existsSync(NOTIFICATION_LOG)) {
    fs.writeFileSync(NOTIFICATION_LOG, '', 'utf-8');
  }
}

ensureDataFiles();

const readStore = () => {
  const payload = fs.readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(payload);
};

const writeStore = (data) => {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const requireAdmin = (req, res, next) => {
  const headerKey = req.header('x-admin-key');
  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({ message: 'Niet geautoriseerd' });
  }
  return next();
};

const logNotification = (order) => {
  const logLine = `[${new Date().toISOString()}] Nieuwe bestelling voor ${order.customer.name} (${order.fulfillmentType}) - SRD ${order.financials.total}\n`;
  fs.appendFile(NOTIFICATION_LOG, logLine, (err) => {
    if (err) {
      console.error('Kan notificatie niet bewaren', err);
    }
  });
};

app.get('/api/menu', (_, res) => {
  const store = readStore();
  res.json(store.menu || []);
});

app.put('/api/menu', requireAdmin, (req, res) => {
  const menu = req.body.menu;

  if (!Array.isArray(menu)) {
    return res.status(400).json({ message: 'Menu moet een lijst zijn' });
  }

  const sanitized = menu.map((item) => {
    if (!item.title || typeof item.title !== 'string') {
      throw new Error('Elk item heeft een titel nodig');
    }
    const id = item.id || item.title.toLowerCase().trim().replace(/\s+/g, '-');
    const pricePerBatch = toNumberOrNull(item.pricePerBatch);
    const batchSize = toNumberOrNull(item.batchSize);
    const minQuantity = toNumberOrNull(item.minQuantity);
    const maxQuantity = toNumberOrNull(item.maxQuantity);
    const stepQuantity = toNumberOrNull(item.stepQuantity);
    const fixedQuantity = toNumberOrNull(item.fixedQuantity);
    const pricePerUnit = toNumberOrNull(item.pricePerUnit);

    return {
      id,
      title: item.title.trim(),
      description: (item.description || '').trim(),
      pricePerBatch: pricePerBatch ?? 0,
      batchSize: batchSize && batchSize > 0 ? batchSize : MIN_BATCH_SIZE,
      minQuantity: minQuantity && minQuantity > 0 ? minQuantity : null,
      maxQuantity: maxQuantity && maxQuantity > 0 ? maxQuantity : null,
      stepQuantity: stepQuantity && stepQuantity > 0 ? stepQuantity : null,
      fixedQuantity: fixedQuantity && fixedQuantity > 0 ? fixedQuantity : null,
      pricePerUnit: pricePerUnit && pricePerUnit > 0 ? pricePerUnit : null,
      displayPrice: (item.displayPrice || '').trim(),
      unitLabel: (item.unitLabel || '').trim()
    };
  });

  const store = readStore();
  store.menu = sanitized;
  writeStore(store);
  res.json(store.menu);
});

app.get('/api/orders', requireAdmin, (_, res) => {
  const store = readStore();
  const orders = store.orders || [];
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

const getStepValue = (item) => {
  const values = [item.stepQuantity, item.batchSize, MIN_BATCH_SIZE];
  for (const value of values) {
    const parsed = toNumberOrNull(value);
    if (parsed && parsed > 0) {
      return parsed;
    }
  }
  return MIN_BATCH_SIZE;
};

const getMinValue = (item) => {
  const parsed = toNumberOrNull(item.minQuantity);
  return parsed && parsed > 0 ? parsed : getStepValue(item);
};

const getMaxValue = (item) => {
  const parsed = toNumberOrNull(item.maxQuantity);
  return parsed && parsed > 0 ? parsed : Infinity;
};

const getFixedValue = (item) => {
  const parsed = toNumberOrNull(item.fixedQuantity);
  return parsed && parsed > 0 ? parsed : null;
};

const getUnitPriceValue = (item) => {
  const parsed = toNumberOrNull(item.pricePerUnit);
  if (parsed && parsed > 0) {
    return parsed;
  }
  const pricePerBatch = toNumberOrNull(item.pricePerBatch) ?? 0;
  const batchSize = toNumberOrNull(item.batchSize) ?? 1;
  return batchSize > 0 ? pricePerBatch / batchSize : pricePerBatch;
};

const validateOrderPayload = (payload, menu) => {
  if (!payload) {
    throw new Error('Geen bestelling ontvangen.');
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Selecteer minimaal een gerecht.');
  }

  const menuMap = new Map(menu.map((item) => [item.id, item]));
  const normalizedItems = payload.items.map((item) => {
    if (!item.id || !menuMap.has(item.id)) {
      throw new Error('Onbekend menu item.');
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Ongeldige hoeveelheid opgegeven.');
    }

    const menuItem = menuMap.get(item.id);
    const step = getStepValue(menuItem);
    const min = getMinValue(menuItem);
    const max = getMaxValue(menuItem);
    const fixed = getFixedValue(menuItem);

    if (fixed) {
      if (quantity !== fixed) {
        throw new Error(`${menuItem.title} kan alleen in een vaste hoeveelheid van ${fixed} worden besteld.`);
      }
    } else {
      if (quantity < min) {
        throw new Error(`${menuItem.title} heeft een minimum van ${min}.`);
      }
      if (quantity > max) {
        throw new Error(`${menuItem.title} heeft een maximum van ${max}.`);
      }
      if ((quantity - min) % step !== 0) {
        throw new Error(`${menuItem.title} moet in stappen van ${step} worden besteld.`);
      }
    }

    const unitPrice = getUnitPriceValue(menuItem);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    return {
      id: item.id,
      label: menuItem.title,
      quantity,
      pricing: {
        unitPrice,
        currency: 'SRD'
      },
      lineTotal
    };
  });

  const customer = payload.customer || {};
  ['name', 'email', 'phone'].forEach((field) => {
    if (!customer[field] || typeof customer[field] !== 'string') {
      throw new Error('Vul alle klantgegevens in.');
    }
  });

  const fulfillmentType = payload.fulfillmentType;
  if (!['afhalen', 'bezorgen'].includes(fulfillmentType)) {
    throw new Error('Selecteer afhalen of bezorgen.');
  }

  if (fulfillmentType === 'bezorgen' && (!customer.address || !customer.address.trim())) {
    throw new Error('Adres is nodig voor bezorging.');
  }

  const requestedDatetime = payload.requestedDatetime;
  if (!requestedDatetime) {
    throw new Error('Kies een datum en tijd.');
  }
  const requested = dayjs(requestedDatetime);
  if (!requested.isValid()) {
    throw new Error('Ongeldige datum/tijd.');
  }
  if (requested.diff(dayjs(), 'hour', true) < 24) {
    throw new Error('Bestellen kan minimaal 24 uur vooruit.');
  }

  const paymentMethod = payload.paymentMethod;
  if (!['Contant', 'Bankoverschrijving'].includes(paymentMethod)) {
    throw new Error('Ongeldige betaalmethode.');
  }

  return {
    items: normalizedItems,
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      address: customer.address ? customer.address.trim() : '',
      notes: customer.notes ? customer.notes.trim() : ''
    },
    fulfillmentType,
    requestedDatetime: requested.toISOString(),
    paymentMethod
  };
};

app.post('/api/orders', (req, res) => {
  try {
    const store = readStore();
    const normalized = validateOrderPayload(req.body, store.menu);
    const totalPrice = normalized.items.reduce((sum, item) => sum + item.lineTotal, 0);

    const order = {
      id: uuid(),
      items: normalized.items,
      customer: normalized.customer,
      fulfillmentType: normalized.fulfillmentType,
      requestedDatetime: normalized.requestedDatetime,
      paymentMethod: normalized.paymentMethod,
      status: 'Nieuw',
      createdAt: new Date().toISOString(),
      financials: {
        currency: 'SRD',
        total: totalPrice
      }
    };

    store.orders.unshift(order);
    writeStore(store);
    logNotification(order);
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/orders/:orderId/status', requireAdmin, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Ongeldige status' });
  }

  const store = readStore();
  const idx = store.orders.findIndex((order) => order.id === orderId);
  if (idx === -1) {
    return res.status(404).json({ message: 'Bestelling niet gevonden' });
  }

  store.orders[idx].status = status;
  store.orders[idx].updatedAt = new Date().toISOString();
  writeStore(store);
  res.json(store.orders[idx]);
});

app.post('/api/login', (req, res) => {
  const { key } = req.body;
  if (key && key === ADMIN_KEY) {
    return res.json({ authorized: true });
  }
  return res.status(401).json({ message: 'Sleutel onjuist' });
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Shira's Devil'd Eggs draait op http://localhost:${PORT}`);
});

