// Smart Household Budget - Google Apps Script backend

var CONFIG = {
  BOT_TOKEN: 'TG_BOT_TOKEN',
  OWNER_CHAT_ID: 'OWNER_CHAT_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  MINI_APP_URL: 'MINI_APP_URL',
  GAS_WEBAPP_URL: 'GAS_WEBAPP_URL',
  APP_SHARED_SECRET: 'APP_SHARED_SECRET',
  WEBHOOK_SECRET: 'WEBHOOK_SECRET',
  MAX_INITDATA_AGE_SECONDS: 'MAX_INITDATA_AGE_SECONDS',
  AUTH_DISABLED: 'AUTH_DISABLED'
};

var DEFAULT_PROPERTIES = {
  OWNER_CHAT_ID: '8958254633',
  SPREADSHEET_ID: '1h1qhOeeWEDF_doYncAd2eBhXADj18MaM6DX9XTheqf4',
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbyjA1YADkipF30Kwcm1Hxobnjf3zEaZrfVj-4ERb5LPvMyDwbOUsloBNJJzU-sPqQp_jQ/exec',
  MINI_APP_URL: 'https://weida6610.github.io/smart-householdbudget/?api=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FAKfycbyjA1YADkipF30Kwcm1Hxobnjf3zEaZrfVj-4ERb5LPvMyDwbOUsloBNJJzU-sPqQp_jQ%2Fexec'
};

var SHEETS = {
  TRANSACTIONS: 'Transactions',
  CATEGORIES: 'Categories'
};

var HEADERS = {
  TRANSACTIONS: [
    'id',
    'timestamp',
    'date',
    'type',
    'category',
    'account',
    'amount',
    'currency',
    'note',
    'payee',
    'source',
    'chat_id',
    'updated_at'
  ],
  CATEGORIES: ['type', 'name', 'budget_monthly', 'active', 'sort']
};

var DEFAULT_CATEGORIES = [
  ['expense', '餐飲', 0, true, 10],
  ['expense', '交通', 0, true, 20],
  ['expense', '日用品', 0, true, 30],
  ['expense', '住家', 0, true, 40],
  ['expense', '醫療', 0, true, 50],
  ['expense', '學習', 0, true, 60],
  ['expense', '娛樂', 0, true, 70],
  ['expense', '未分類', 0, true, 999],
  ['income', '薪資', 0, true, 10],
  ['income', '獎金', 0, true, 20],
  ['income', '其他收入', 0, true, 999]
];

function doGet() {
  return jsonResponse({
    ok: true,
    app: 'smart-householdbudget',
    message: 'Apps Script backend is running.'
  });
}

function doPost(e) {
  try {
    var body = parseBody(e);
    if (isTelegramUpdate(body)) {
      requireValidWebhookSecret(e);
      if (isDuplicateTelegramUpdate(body)) return jsonResponse({ ok: true, duplicate: true });
      handleTelegramUpdate(body);
      return jsonResponse({ ok: true });
    }
    return handleApiRequest(body);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function isTelegramUpdate(body) {
  return body && (body.update_id || body.message || body.callback_query);
}

function isDuplicateTelegramUpdate(update) {
  if (!update || update.update_id === undefined || update.update_id === null) return false;

  var props = getProps();
  var currentId = Number(update.update_id);
  var lastId = Number(props.getProperty('LAST_TG_UPDATE_ID') || '-1');
  if (currentId <= lastId) return true;

  props.setProperty('LAST_TG_UPDATE_ID', String(currentId));
  return false;
}

function requireValidWebhookSecret(e) {
  var expectedSecret = getProp(CONFIG.WEBHOOK_SECRET);
  if (!expectedSecret) throw new Error('WEBHOOK_SECRET is not configured. Run setupTelegramWebhook() first.');

  var actualSecret = e && e.parameter ? e.parameter.webhook_secret : '';
  if (!actualSecret || !constantTimeEquals(actualSecret, expectedSecret)) {
    throw new Error('Invalid Telegram webhook secret');
  }
}

function handleApiRequest(body) {
  var action = body.action;
  var actor = requireAuthorizedActor(body);

  if (action === 'setup') return jsonResponse({ ok: true, data: setup() });
  if (action === 'categories') return jsonResponse({ ok: true, data: listCategories() });
  if (action === 'listTransactions') return jsonResponse({ ok: true, data: listTransactions(body.payload || {}, actor) });
  if (action === 'summary') return jsonResponse({ ok: true, data: getSummary(body.payload || {}, actor) });
  if (action === 'createTransaction') return jsonResponse({ ok: true, data: createTransaction(body.payload || {}, actor) });
  if (action === 'updateTransaction') return jsonResponse({ ok: true, data: updateTransaction(body.payload || {}, actor) });
  if (action === 'deleteTransaction') return jsonResponse({ ok: true, data: deleteTransaction(body.payload || {}, actor) });

  throw new Error('Unknown action: ' + action);
}

function setup() {
  ensureTransactionSheet();
  ensureCategorySheet();
  return {
    spreadsheetUrl: getSpreadsheet().getUrl(),
    sheets: [SHEETS.TRANSACTIONS, SHEETS.CATEGORIES]
  };
}

function getProps() {
  return PropertiesService.getScriptProperties();
}

function getProp(name) {
  return getProps().getProperty(name) || DEFAULT_PROPERTIES[name] || '';
}

function isAuthDisabled() {
  return String(getProp(CONFIG.AUTH_DISABLED)).toLowerCase() === 'true';
}

function requireAuthorizedActor(body) {
  var ownerChatId = getProp(CONFIG.OWNER_CHAT_ID);

  if (isAuthDisabled()) {
    return { chatId: ownerChatId || 'local-dev', user: { id: ownerChatId || 'local-dev' }, method: 'disabled' };
  }

  var actor = null;
  if (body.initData) {
    actor = verifyTelegramInitData(body.initData);
  }

  if (!actor && body.appKey) {
    var expectedKey = getProp(CONFIG.APP_SHARED_SECRET);
    if (expectedKey && constantTimeEquals(String(body.appKey), String(expectedKey))) {
      actor = { chatId: ownerChatId || 'browser', user: { id: ownerChatId || 'browser' }, method: 'appKey' };
    }
  }

  if (!actor) throw new Error('Unauthorized request');
  if (ownerChatId && String(actor.chatId) !== String(ownerChatId)) throw new Error('Unauthorized owner. Current chat_id: ' + actor.chatId);
  return actor;
}

function verifyTelegramInitData(initData) {
  var botToken = getProp(CONFIG.BOT_TOKEN);
  if (!botToken) throw new Error('TG_BOT_TOKEN is not configured');

  var pairs = parseQueryString(initData);
  var hash = pairs.hash;
  if (!hash) throw new Error('Telegram initData hash missing');

  var keys = Object.keys(pairs).filter(function(key) { return key !== 'hash'; }).sort();
  var dataCheckString = keys.map(function(key) { return key + '=' + pairs[key]; }).join('\n');
  var secret = hmacSha256Bytes(utf8Bytes(botToken), utf8Bytes('WebAppData'));
  var computed = bytesToHex(hmacSha256Bytes(utf8Bytes(dataCheckString), secret));
  if (!constantTimeEquals(computed, hash)) throw new Error('Telegram initData validation failed');

  var maxAge = parseInt(getProp(CONFIG.MAX_INITDATA_AGE_SECONDS) || '86400', 10);
  if (maxAge > 0 && pairs.auth_date) {
    var ageSeconds = Math.floor(Date.now() / 1000) - parseInt(pairs.auth_date, 10);
    if (ageSeconds > maxAge) throw new Error('Telegram initData expired');
  }

  var user = pairs.user ? JSON.parse(pairs.user) : {};
  if (!user.id) throw new Error('Telegram user missing');
  return { chatId: String(user.id), user: user, method: 'telegram' };
}

function parseQueryString(query) {
  return query.split('&').reduce(function(acc, part) {
    var index = part.indexOf('=');
    var key = index >= 0 ? part.slice(0, index) : part;
    var value = index >= 0 ? part.slice(index + 1) : '';
    acc[decodeQueryComponent(key)] = decodeQueryComponent(value);
    return acc;
  }, {});
}

function decodeQueryComponent(value) {
  return decodeURIComponent(String(value || '').replace(/\+/g, '%20'));
}

function bytesToHex(bytes) {
  return bytes.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function utf8Bytes(text) {
  return Utilities.newBlob(String(text || '')).getBytes().map(function(byte) {
    return byte < 0 ? byte + 256 : byte;
  });
}

function hmacSha256Bytes(messageBytes, keyBytes) {
  var blockSize = 64;
  var key = keyBytes.slice();
  if (key.length > blockSize) key = sha256Bytes(key);
  while (key.length < blockSize) key.push(0);

  var outerKey = [];
  var innerKey = [];
  for (var i = 0; i < blockSize; i++) {
    outerKey[i] = key[i] ^ 0x5c;
    innerKey[i] = key[i] ^ 0x36;
  }

  return sha256Bytes(outerKey.concat(sha256Bytes(innerKey.concat(messageBytes))));
}

function sha256Bytes(bytes) {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var bitLength = bytes.length * 8;
  var msg = bytes.slice();
  msg.push(0x80);
  while ((msg.length % 64) !== 56) msg.push(0);
  for (var i = 7; i >= 0; i--) msg.push((bitLength / Math.pow(2, i * 8)) & 0xff);

  var h0 = 0x6a09e667;
  var h1 = 0xbb67ae85;
  var h2 = 0x3c6ef372;
  var h3 = 0xa54ff53a;
  var h4 = 0x510e527f;
  var h5 = 0x9b05688c;
  var h6 = 0x1f83d9ab;
  var h7 = 0x5be0cd19;

  for (var chunk = 0; chunk < msg.length; chunk += 64) {
    var w = new Array(64);
    for (var j = 0; j < 16; j++) {
      var offset = chunk + j * 4;
      w[j] = ((msg[offset] << 24) | (msg[offset + 1] << 16) | (msg[offset + 2] << 8) | msg[offset + 3]) >>> 0;
    }
    for (j = 16; j < 64; j++) {
      var s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      var s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    var a = h0;
    var b = h1;
    var c = h2;
    var d = h3;
    var e = h4;
    var f = h5;
    var g = h6;
    var h = h7;

    for (j = 0; j < 64; j++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return wordsToBytes([h0, h1, h2, h3, h4, h5, h6, h7]);
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function wordsToBytes(words) {
  var bytes = [];
  words.forEach(function(word) {
    bytes.push((word >>> 24) & 0xff);
    bytes.push((word >>> 16) & 0xff);
    bytes.push((word >>> 8) & 0xff);
    bytes.push(word & 0xff);
  });
  return bytes;
}

function constantTimeEquals(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getSpreadsheet() {
  var spreadsheetId = getProp(CONFIG.SPREADSHEET_ID);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  var ss = SpreadsheetApp.create('Smart Household Budget');
  getProps().setProperty(CONFIG.SPREADSHEET_ID, ss.getId());
  return ss;
}

function ensureTransactionSheet() {
  return getSheetWithHeaders(SHEETS.TRANSACTIONS, HEADERS.TRANSACTIONS);
}

function ensureCategorySheet() {
  var sheet = getSheetWithHeaders(SHEETS.CATEGORIES, HEADERS.CATEGORIES);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, DEFAULT_CATEGORIES.length, HEADERS.CATEGORIES.length).setValues(DEFAULT_CATEGORIES);
  }
  return sheet;
}

function getSheetWithHeaders(name, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var missing = headers.filter(function(header) { return currentHeaders.indexOf(header) === -1; });
  if (missing.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.reduce(function(acc, header, index) {
    acc[header] = index;
    return acc;
  }, {});
}

function listCategories() {
  var sheet = ensureCategorySheet();
  var map = getHeaderMap(sheet);
  if (sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
    .map(function(row) {
      return {
        type: row[map.type],
        name: row[map.name],
        budgetMonthly: Number(row[map.budget_monthly] || 0),
        active: row[map.active] !== false,
        sort: Number(row[map.sort] || 999)
      };
    })
    .filter(function(category) { return category.active; })
    .sort(function(a, b) {
      if (a.type !== b.type) return a.type > b.type ? 1 : -1;
      return a.sort - b.sort;
    });
}

function createTransaction(payload, actor) {
  var tx = normalizeTransactionPayload(payload, actor);
  var sheet = ensureTransactionSheet();
  var now = new Date();
  tx.id = makeId();
  tx.timestamp = now;
  tx.updated_at = now;
  sheet.appendRow(HEADERS.TRANSACTIONS.map(function(header) { return tx[header]; }));
  return serializeTransaction(tx);
}

function updateTransaction(payload, actor) {
  if (!payload.id) throw new Error('Missing transaction id');
  var sheet = ensureTransactionSheet();
  var found = findTransactionRow(sheet, payload.id, actor);
  if (!found) throw new Error('Transaction not found');

  var existing = found.transaction;
  var merged = {};
  Object.keys(existing).forEach(function(key) { merged[key] = existing[key]; });
  Object.keys(payload).forEach(function(key) {
    if (payload[key] !== undefined && payload[key] !== null) merged[key] = payload[key];
  });

  var tx = normalizeTransactionPayload(merged, actor);
  tx.id = existing.id;
  tx.timestamp = existing.timestamp || new Date();
  tx.updated_at = new Date();

  sheet.getRange(found.rowNumber, 1, 1, HEADERS.TRANSACTIONS.length)
    .setValues([HEADERS.TRANSACTIONS.map(function(header) { return tx[header]; })]);
  return serializeTransaction(tx);
}

function deleteTransaction(payload, actor) {
  if (!payload.id) throw new Error('Missing transaction id');
  var sheet = ensureTransactionSheet();
  var found = findTransactionRow(sheet, payload.id, actor);
  if (!found) throw new Error('Transaction not found');
  sheet.deleteRow(found.rowNumber);
  return { id: payload.id, deleted: true };
}

function listTransactions(payload, actor) {
  var month = payload.month || currentMonth();
  var sheet = ensureTransactionSheet();
  if (sheet.getLastRow() < 2) return [];

  var map = getHeaderMap(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
    .map(function(row) { return rowToTransaction(row, map); })
    .filter(function(tx) { return canAccess(tx, actor); })
    .filter(function(tx) { return !month || String(tx.date).slice(0, 7) === month; })
    .sort(function(a, b) {
      if (a.date === b.date) return String(b.updated_at).localeCompare(String(a.updated_at));
      return String(b.date).localeCompare(String(a.date));
    })
    .map(serializeTransaction);
}

function getSummary(payload, actor) {
  var month = payload.month || currentMonth();
  var transactions = listTransactions({ month: month }, actor);
  var totals = transactions.reduce(function(acc, tx) {
    var amount = Number(tx.amount || 0);
    if (tx.type === 'income') acc.income += amount;
    if (tx.type === 'expense') acc.expense += amount;
    var key = tx.type + ':' + tx.category;
    acc.byCategory[key] = (acc.byCategory[key] || 0) + amount;
    return acc;
  }, { income: 0, expense: 0, byCategory: {} });

  return {
    month: month,
    income: totals.income,
    expense: totals.expense,
    balance: totals.income - totals.expense,
    count: transactions.length,
    byCategory: totals.byCategory
  };
}

function normalizeTransactionPayload(payload, actor) {
  var type = normalizeType(payload.type);
  var amount = Number(String(payload.amount || '').replace(/,/g, ''));
  if (!amount || amount <= 0) throw new Error('Amount must be greater than 0');

  var date = normalizeDate(payload.date || todayString());
  return {
    id: payload.id || '',
    timestamp: payload.timestamp || new Date(),
    date: date,
    type: type,
    category: String(payload.category || (type === 'income' ? '其他收入' : '未分類')).trim(),
    account: String(payload.account || '現金').trim(),
    amount: amount,
    currency: String(payload.currency || 'TWD').trim(),
    note: String(payload.note || '').trim(),
    payee: String(payload.payee || '').trim(),
    source: String(payload.source || 'web').trim(),
    chat_id: String(actor.chatId || ''),
    updated_at: payload.updated_at || new Date()
  };
}

function normalizeType(type) {
  var value = String(type || 'expense').toLowerCase();
  if (value === 'income' || value === '收入') return 'income';
  if (value === 'expense' || value === '支出') return 'expense';
  throw new Error('Unsupported transaction type');
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  var text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Date must be yyyy-MM-dd');
  var parsed = new Date(text + 'T00:00:00+08:00');
  if (isNaN(parsed.getTime())) throw new Error('Invalid date');
  return text;
}

function findTransactionRow(sheet, id, actor) {
  if (sheet.getLastRow() < 2) return null;
  var map = getHeaderMap(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < rows.length; i++) {
    var tx = rowToTransaction(rows[i], map);
    if (String(tx.id) === String(id) && canAccess(tx, actor)) {
      return { rowNumber: i + 2, transaction: tx };
    }
  }
  return null;
}

function rowToTransaction(row, map) {
  return {
    id: row[map.id],
    timestamp: row[map.timestamp],
    date: normalizeSheetDate(row[map.date]),
    type: row[map.type],
    category: row[map.category],
    account: row[map.account],
    amount: Number(row[map.amount] || 0),
    currency: row[map.currency],
    note: row[map.note],
    payee: row[map.payee],
    source: row[map.source],
    chat_id: row[map.chat_id],
    updated_at: row[map.updated_at]
  };
}

function serializeTransaction(tx) {
  return {
    id: tx.id,
    timestamp: normalizeDateTime(tx.timestamp),
    date: normalizeSheetDate(tx.date),
    type: tx.type,
    category: tx.category,
    account: tx.account,
    amount: Number(tx.amount || 0),
    currency: tx.currency || 'TWD',
    note: tx.note || '',
    payee: tx.payee || '',
    source: tx.source || '',
    chatId: tx.chat_id || '',
    updatedAt: normalizeDateTime(tx.updated_at)
  };
}

function canAccess(tx, actor) {
  var ownerChatId = getProp(CONFIG.OWNER_CHAT_ID);
  if (!ownerChatId) return true;
  return String(tx.chat_id || ownerChatId) === String(actor.chatId);
}

function normalizeSheetDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return String(value || '');
}

function normalizeDateTime(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return String(value || '');
}

function todayString() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

function currentMonth() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM');
}

function makeId() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleTelegramUpdate(update) {
  if (update.message) handleTelegramMessage(update.message);
  if (update.callback_query) answerCallbackQuery(update.callback_query.id, '');
}

function handleTelegramMessage(message) {
  var chatId = String(message.chat.id);
  var text = String(message.text || '').trim();
  if (isRateLimitedTelegramMessage(chatId, text)) return;

  if (isWhoamiCommand(text)) {
    sendTelegramMessage(chatId, '目前 chat_id：' + chatId + '\n請把這個值填到 Script Properties 的 OWNER_CHAT_ID。');
    return;
  }

  var ownerChatId = getProp(CONFIG.OWNER_CHAT_ID);
  if (ownerChatId && chatId !== String(ownerChatId)) {
    return;
  }

  if (!text || text === '/start') {
    sendStartMessage(chatId);
    return;
  }

  if (text === '記一筆' || text === '查詢紀錄' || text === '設定' || text === '/app') {
    sendOpenAppMessage(chatId);
    return;
  }

  if (text === '本月摘要' || text === '/summary') {
    sendMonthlySummary(chatId);
    return;
  }

  var quick = parseQuickTransaction(text);
  if (quick) {
    var tx = createTransaction(quick, { chatId: chatId, method: 'telegram' });
    sendTelegramMessage(chatId, '已新增：' + formatTransactionLine(tx), mainReplyKeyboard());
    return;
  }

  sendTelegramMessage(chatId, '可用下方選單開啟工具，或輸入：支出 餐飲 120 午餐', mainReplyKeyboard());
}

function isWhoamiCommand(text) {
  return /^\/whoami(@[A-Za-z0-9_]+)?$/i.test(String(text || '').trim()) || text === '我的ID';
}

function isRateLimitedTelegramMessage(chatId, text) {
  var normalized = String(text || '').trim();
  if (!normalized) return false;

  var props = getProps();
  var key = 'TG_RATE_' + Utilities.base64EncodeWebSafe(String(chatId) + ':' + normalized).slice(0, 80);
  var now = Date.now();
  var last = Number(props.getProperty(key) || '0');
  if (now - last < 8000) return true;

  props.setProperty(key, String(now));
  return false;
}

function sendStartMessage(chatId) {
  sendTelegramMessage(chatId, '已啟用個人記帳工具。', mainReplyKeyboard());
  sendOpenAppMessage(chatId);
}

function sendOpenAppMessage(chatId) {
  var miniAppUrl = getProp(CONFIG.MINI_APP_URL);
  if (!miniAppUrl) {
    sendTelegramMessage(chatId, 'Mini App URL 尚未設定。請先設定 Script Property: MINI_APP_URL', mainReplyKeyboard());
    return;
  }

  sendTelegramMessage(chatId, '開啟記帳工具：', {
    inline_keyboard: [[
      { text: '開啟記帳工具', web_app: { url: miniAppUrl } }
    ]]
  });
}

function sendMonthlySummary(chatId) {
  var summary = getSummary({ month: currentMonth() }, { chatId: chatId, method: 'telegram' });
  var lines = [
    currentMonth() + ' 摘要',
    '收入：' + formatMoney(summary.income),
    '支出：' + formatMoney(summary.expense),
    '結餘：' + formatMoney(summary.balance),
    '筆數：' + summary.count
  ];
  sendTelegramMessage(chatId, lines.join('\n'), mainReplyKeyboard());
}

function parseQuickTransaction(text) {
  var parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  var type = null;
  if (parts[0] === '支出' || parts[0].toLowerCase() === 'expense') type = 'expense';
  if (parts[0] === '收入' || parts[0].toLowerCase() === 'income') type = 'income';
  if (!type) return null;

  var category = type === 'income' ? '其他收入' : '未分類';
  var amountIndex = 1;
  if (parts.length >= 3 && !isAmount(parts[1]) && isAmount(parts[2])) {
    category = parts[1];
    amountIndex = 2;
  }
  if (!isAmount(parts[amountIndex])) return null;

  return {
    type: type,
    category: category,
    amount: Number(parts[amountIndex]),
    note: parts.slice(amountIndex + 1).join(' '),
    date: todayString(),
    source: 'telegram-quick'
  };
}

function isAmount(value) {
  return /^\d+(\.\d+)?$/.test(String(value || ''));
}

function formatTransactionLine(tx) {
  var label = tx.type === 'income' ? '收入' : '支出';
  var note = tx.note ? ' ' + tx.note : '';
  return label + ' ' + tx.category + ' ' + formatMoney(tx.amount) + note;
}

function formatMoney(value) {
  return 'NT$' + Math.round(Number(value || 0)).toLocaleString('en-US');
}

function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '記一筆' }, { text: '本月摘要' }],
      [{ text: '查詢紀錄' }, { text: '設定' }]
    ],
    resize_keyboard: true
  };
}

function telegramApi(method, payload) {
  var botToken = getProp(CONFIG.BOT_TOKEN);
  if (!botToken) throw new Error('TG_BOT_TOKEN is not configured');

  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  return JSON.parse(response.getContentText());
}

function sendTelegramMessage(chatId, text, replyMarkup) {
  var payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi('sendMessage', payload);
}

function answerCallbackQuery(callbackQueryId, text) {
  return telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || ''
  });
}

function setupTelegramWebhook() {
  var url = getProp(CONFIG.GAS_WEBAPP_URL);
  if (!url) throw new Error('GAS_WEBAPP_URL is not configured');
  var webhookSecret = getOrCreateWebhookSecret();
  var webhookUrl = appendQuery(url, 'webhook_secret', webhookSecret);

  return telegramApi('setWebhook', {
    url: webhookUrl,
    drop_pending_updates: true
  });
}

function setupTelegramMenu() {
  var miniAppUrl = getProp(CONFIG.MINI_APP_URL);
  if (!miniAppUrl) throw new Error('MINI_APP_URL is not configured');

  telegramApi('setMyCommands', {
    commands: [
      { command: 'start', description: '開啟記帳選單' },
      { command: 'summary', description: '查看本月摘要' },
      { command: 'app', description: '開啟記帳工具' }
    ]
  });

  return telegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '記帳工具',
      web_app: { url: miniAppUrl }
    }
  });
}

function diagnoseTelegramSetup() {
  var botToken = getProp(CONFIG.BOT_TOKEN);
  var gasWebAppUrl = getProp(CONFIG.GAS_WEBAPP_URL);
  var miniAppUrl = getProp(CONFIG.MINI_APP_URL);
  var ownerChatId = getProp(CONFIG.OWNER_CHAT_ID);
  var webhookSecret = getProps().getProperty(CONFIG.WEBHOOK_SECRET);
  var result = {
    hasBotToken: Boolean(botToken),
    ownerChatId: ownerChatId || '',
    gasWebAppUrl: gasWebAppUrl || '',
    miniAppUrl: miniAppUrl || '',
    hasWebhookSecret: Boolean(webhookSecret),
    expectedWebhookBase: gasWebAppUrl || '',
    bot: null,
    webhook: null
  };

  if (!botToken) return result;

  try {
    result.bot = telegramApi('getMe', {});
  } catch (err) {
    result.bot = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  try {
    result.webhook = telegramApi('getWebhookInfo', {});
  } catch (err2) {
    result.webhook = { ok: false, error: String(err2 && err2.message ? err2.message : err2) };
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function configureDeploymentUrls(gasWebAppUrl, miniAppUrl) {
  if (!gasWebAppUrl) throw new Error('gasWebAppUrl is required');
  if (!miniAppUrl) throw new Error('miniAppUrl is required');

  getProps().setProperties({
    GAS_WEBAPP_URL: gasWebAppUrl,
    MINI_APP_URL: miniAppUrl
  }, false);

  return {
    gasWebAppUrl: gasWebAppUrl,
    miniAppUrl: miniAppUrl
  };
}

function configureKnownDeploymentUrls() {
  var gasWebAppUrl = 'https://script.google.com/macros/s/AKfycbyjA1YADkipF30Kwcm1Hxobnjf3zEaZrfVj-4ERb5LPvMyDwbOUsloBNJJzU-sPqQp_jQ/exec';
  var miniAppUrl = 'https://weida6610.github.io/smart-householdbudget/?api=' + encodeURIComponent(gasWebAppUrl);
  return configureDeploymentUrls(gasWebAppUrl, miniAppUrl);
}

function getOrCreateWebhookSecret() {
  var props = getProps();
  var secret = props.getProperty(CONFIG.WEBHOOK_SECRET);
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(CONFIG.WEBHOOK_SECRET, secret);
  }
  return secret;
}

function appendQuery(url, key, value) {
  var separator = url.indexOf('?') === -1 ? '?' : '&';
  return url + separator + encodeURIComponent(key) + '=' + encodeURIComponent(value);
}
