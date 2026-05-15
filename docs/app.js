(function() {
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  var params = new URLSearchParams(window.location.search);
  var state = {
    apiUrl: params.get('api') || localStorage.getItem('shb.apiUrl') || '',
    appKey: localStorage.getItem('shb.appKey') || '',
    month: params.get('month') || currentMonth(),
    categories: [],
    transactions: [],
    summary: null,
    activeTab: 'entry',
    loading: false
  };

  var fallbackCategories = [
    { type: 'expense', name: '餐飲' },
    { type: 'expense', name: '交通' },
    { type: 'expense', name: '日用品' },
    { type: 'expense', name: '住家' },
    { type: 'expense', name: '醫療' },
    { type: 'expense', name: '娛樂' },
    { type: 'expense', name: '未分類' },
    { type: 'income', name: '薪資' },
    { type: 'income', name: '獎金' },
    { type: 'income', name: '其他收入' }
  ];

  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindElements();
    bindEvents();
    setDefaults();
    renderAll();
    if (state.apiUrl) {
      loadData();
    } else {
      setStatus('請先到設定填入 Apps Script API URL。');
      switchTab('settings');
    }
  }

  function bindElements() {
    [
      'monthInput',
      'incomeValue',
      'expenseValue',
      'balanceValue',
      'transactionForm',
      'transactionId',
      'dateInput',
      'amountInput',
      'categoryInput',
      'accountInput',
      'payeeInput',
      'noteInput',
      'submitButton',
      'resetButton',
      'recordCount',
      'refreshButton',
      'recordsList',
      'categorySummary',
      'settingsForm',
      'apiUrlInput',
      'appKeyInput',
      'statusBar'
    ].forEach(function(id) {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    document.querySelectorAll('.tab-button').forEach(function(button) {
      button.addEventListener('click', function() {
        switchTab(button.dataset.tab);
      });
    });

    els.monthInput.addEventListener('change', function() {
      state.month = els.monthInput.value || currentMonth();
      loadData();
    });

    document.querySelectorAll('input[name="type"]').forEach(function(input) {
      input.addEventListener('change', renderCategoryOptions);
    });

    els.transactionForm.addEventListener('submit', saveTransaction);
    els.resetButton.addEventListener('click', resetForm);
    els.refreshButton.addEventListener('click', loadData);
    els.settingsForm.addEventListener('submit', saveSettings);
  }

  function setDefaults() {
    els.monthInput.value = state.month;
    els.dateInput.value = todayString();
    els.apiUrlInput.value = state.apiUrl;
    els.appKeyInput.value = state.appKey;
  }

  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-button').forEach(function(button) {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function(panel) {
      panel.classList.toggle('active', panel.id === tab + 'Tab');
    });
  }

  async function loadData() {
    if (!state.apiUrl) return;
    setLoading(true, '正在讀取 Google Sheet...');
    try {
      var results = await Promise.all([
        apiRequest('categories', {}),
        apiRequest('summary', { month: state.month }),
        apiRequest('listTransactions', { month: state.month })
      ]);
      state.categories = results[0].data && results[0].data.length ? results[0].data : fallbackCategories;
      state.summary = results[1].data;
      state.transactions = results[2].data || [];
      renderAll();
      setStatus('已同步 ' + state.month + ' 資料。');
    } catch (err) {
      setStatus('讀取失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function apiRequest(action, payload) {
    var response = await fetch(state.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        source: 'smart-householdbudget-web',
        action: action,
        payload: payload || {},
        initData: tg ? tg.initData : '',
        appKey: state.appKey
      })
    });

    var data = await response.json();
    if (!data.ok) throw new Error(data.error || 'API request failed');
    return data;
  }

  async function saveTransaction(event) {
    event.preventDefault();
    if (!state.apiUrl) {
      switchTab('settings');
      setStatus('請先填入 Apps Script API URL。');
      return;
    }

    var id = els.transactionId.value;
    var payload = {
      id: id,
      date: els.dateInput.value,
      type: getSelectedType(),
      category: els.categoryInput.value,
      account: els.accountInput.value,
      amount: els.amountInput.value,
      payee: els.payeeInput.value,
      note: els.noteInput.value,
      source: tg ? 'telegram-mini-app' : 'browser'
    };

    setLoading(true, id ? '正在更新...' : '正在新增...');
    try {
      await apiRequest(id ? 'updateTransaction' : 'createTransaction', payload);
      resetForm();
      await loadData();
      switchTab('records');
    } catch (err) {
      setStatus('儲存失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTransaction(id) {
    if (!window.confirm('刪除這筆紀錄？')) return;
    setLoading(true, '正在刪除...');
    try {
      await apiRequest('deleteTransaction', { id: id });
      await loadData();
    } catch (err) {
      setStatus('刪除失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function editTransaction(tx) {
    els.transactionId.value = tx.id;
    els.dateInput.value = tx.date;
    setSelectedType(tx.type);
    renderCategoryOptions();
    els.categoryInput.value = tx.category;
    els.accountInput.value = tx.account || '現金';
    els.amountInput.value = tx.amount;
    els.payeeInput.value = tx.payee || '';
    els.noteInput.value = tx.note || '';
    els.submitButton.textContent = '更新這筆';
    switchTab('entry');
  }

  function resetForm() {
    els.transactionId.value = '';
    els.dateInput.value = todayString();
    setSelectedType('expense');
    renderCategoryOptions();
    els.accountInput.value = '現金';
    els.amountInput.value = '';
    els.payeeInput.value = '';
    els.noteInput.value = '';
    els.submitButton.textContent = '新增一筆';
  }

  function saveSettings(event) {
    event.preventDefault();
    state.apiUrl = els.apiUrlInput.value.trim();
    state.appKey = els.appKeyInput.value.trim();
    localStorage.setItem('shb.apiUrl', state.apiUrl);
    localStorage.setItem('shb.appKey', state.appKey);
    setStatus('設定已儲存。');
    if (state.apiUrl) loadData();
  }

  function renderAll() {
    renderSummary();
    renderCategoryOptions();
    renderRecords();
    renderCategorySummary();
  }

  function renderSummary() {
    var summary = state.summary || { income: 0, expense: 0, balance: 0 };
    els.incomeValue.textContent = formatMoney(summary.income);
    els.expenseValue.textContent = formatMoney(summary.expense);
    els.balanceValue.textContent = formatMoney(summary.balance);
  }

  function renderCategoryOptions() {
    var type = getSelectedType();
    var options = (state.categories.length ? state.categories : fallbackCategories)
      .filter(function(category) { return category.type === type; });
    els.categoryInput.innerHTML = options.map(function(category) {
      return '<option value="' + escapeHtml(category.name) + '">' + escapeHtml(category.name) + '</option>';
    }).join('');
  }

  function renderRecords() {
    els.recordCount.textContent = state.transactions.length + ' 筆';
    if (!state.transactions.length) {
      els.recordsList.innerHTML = '<div class="empty">這個月份還沒有紀錄</div>';
      return;
    }

    els.recordsList.innerHTML = state.transactions.map(function(tx) {
      var amountClass = tx.type === 'income' ? 'income' : 'expense';
      var sign = tx.type === 'income' ? '+' : '-';
      var title = tx.note || tx.payee || tx.category;
      var meta = [tx.date, tx.category, tx.account].filter(Boolean).join(' · ');
      return [
        '<article class="record-item">',
        '  <div class="record-main">',
        '    <div class="record-title">',
        '      <strong>' + escapeHtml(title) + '</strong>',
        '      <span class="record-meta">' + escapeHtml(meta) + '</span>',
        '    </div>',
        '    <div class="record-amount ' + amountClass + '">' + sign + formatMoney(tx.amount) + '</div>',
        '  </div>',
        '  <div class="record-actions">',
        '    <button type="button" data-action="edit" data-id="' + escapeHtml(tx.id) + '">修改</button>',
        '    <button type="button" data-action="delete" data-id="' + escapeHtml(tx.id) + '">刪除</button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');

    els.recordsList.querySelectorAll('button[data-action]').forEach(function(button) {
      button.addEventListener('click', function() {
        var tx = state.transactions.find(function(item) { return item.id === button.dataset.id; });
        if (!tx) return;
        if (button.dataset.action === 'edit') editTransaction(tx);
        if (button.dataset.action === 'delete') deleteTransaction(tx.id);
      });
    });
  }

  function renderCategorySummary() {
    var summary = state.summary;
    if (!summary || !summary.byCategory) {
      els.categorySummary.innerHTML = '<div class="empty">尚無分析資料</div>';
      return;
    }

    var entries = Object.keys(summary.byCategory)
      .map(function(key) {
        var parts = key.split(':');
        return { type: parts[0], category: parts.slice(1).join(':'), amount: summary.byCategory[key] };
      })
      .filter(function(row) { return row.amount > 0; })
      .sort(function(a, b) { return b.amount - a.amount; });

    if (!entries.length) {
      els.categorySummary.innerHTML = '<div class="empty">尚無分析資料</div>';
      return;
    }

    var max = entries.reduce(function(value, row) { return Math.max(value, row.amount); }, 1);
    els.categorySummary.innerHTML = entries.map(function(row) {
      var width = Math.max(4, Math.round(row.amount / max * 100));
      var label = row.type === 'income' ? '收入' : '支出';
      return [
        '<article class="category-row">',
        '  <header><strong>' + escapeHtml(row.category) + '</strong><span>' + label + ' ' + formatMoney(row.amount) + '</span></header>',
        '  <div class="bar"><span style="width:' + width + '%"></span></div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function getSelectedType() {
    var checked = document.querySelector('input[name="type"]:checked');
    return checked ? checked.value : 'expense';
  }

  function setSelectedType(type) {
    document.querySelectorAll('input[name="type"]').forEach(function(input) {
      input.checked = input.value === type;
    });
  }

  function setLoading(loading, message) {
    state.loading = loading;
    els.submitButton.disabled = loading;
    els.refreshButton.disabled = loading;
    if (message) setStatus(message);
  }

  function setStatus(message) {
    els.statusBar.textContent = message;
  }

  function currentMonth() {
    return todayString().slice(0, 7);
  }

  function todayString() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function formatMoney(value) {
    return 'NT$' + Math.round(Number(value || 0)).toLocaleString('en-US');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();

