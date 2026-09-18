// =============================================
//  Expense & Budget Visualizer — app.js
//  Vanilla JS + LocalStorage + Chart.js
// =============================================

// ---------- Constants ----------
const STORAGE_KEY = 'ebv_transactions';

const CATEGORY_COLORS = {
  Gaji:      '#10b981',
  Makanan:   '#f59e0b',
  Transport: '#3b82f6',
  Belanja:   '#8b5cf6',
  Hiburan:   '#ec4899',
  Kesehatan: '#06b6d4',
  Lainnya:   '#94a3b8',
};

// ---------- State ----------
let transactions = loadFromStorage();
let categoryChart = null;
let balanceChart  = null;

// ---------- DOM References ----------
const form            = document.getElementById('transaction-form');
const descInput       = document.getElementById('description');
const amountInput     = document.getElementById('amount');
const typeSelect      = document.getElementById('type');
const categorySelect  = document.getElementById('category');
const dateInput       = document.getElementById('date');
const transactionList = document.getElementById('transaction-list');
const clearAllBtn     = document.getElementById('clear-all');
const totalIncomeEl   = document.getElementById('total-income');
const totalExpenseEl  = document.getElementById('total-expense');
const balanceEl       = document.getElementById('balance');

// ---------- Init ----------
function init() {
  dateInput.value = getTodayISO();
  renderAll();
}

// ---------- LocalStorage ----------
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ---------- Event Listeners ----------
form.addEventListener('submit', function (e) {
  e.preventDefault();

  const description = descInput.value.trim();
  const amount      = parseFloat(amountInput.value);
  const type        = typeSelect.value;
  const category    = categorySelect.value;
  const date        = dateInput.value;

  if (!description || isNaN(amount) || amount <= 0 || !date) {
    alert('Mohon lengkapi semua field dengan benar.');
    return;
  }

  const transaction = {
    id: Date.now().toString(),
    description,
    amount,
    type,
    category,
    date,
  };

  transactions.unshift(transaction); // newest first
  saveToStorage();
  renderAll();

  // Reset input fields, keep date & type
  descInput.value   = '';
  amountInput.value = '';
  descInput.focus();
});

clearAllBtn.addEventListener('click', function () {
  if (transactions.length === 0) return;
  if (!confirm('Hapus semua transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
  transactions = [];
  saveToStorage();
  renderAll();
});

// ---------- Render Pipeline ----------
function renderAll() {
  renderSummary();
  renderTransactionList();
  renderCharts();
}

// ---------- Summary ----------
function renderSummary() {
  const totals  = calcTotals();
  const balance = totals.income - totals.expense;

  totalIncomeEl.textContent  = formatRupiah(totals.income);
  totalExpenseEl.textContent = formatRupiah(totals.expense);
  balanceEl.textContent      = formatRupiah(balance);

  // Turn saldo red when negative
  balanceEl.style.color = balance < 0
    ? 'var(--expense-color)'
    : 'var(--balance-color)';
}

function calcTotals() {
  return transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income  += t.amount;
      else                      acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

// ---------- Transaction List ----------
function renderTransactionList() {
  if (transactions.length === 0) {
    transactionList.innerHTML =
      '<p class="empty-state">Belum ada transaksi. Tambahkan transaksi pertama Anda!</p>';
    return;
  }

  transactionList.innerHTML = transactions
    .map((t) => buildTransactionHTML(t))
    .join('');

  // Attach per-item delete listeners
  transactionList.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', function () {
      deleteTransaction(this.dataset.id);
    });
  });
}

function buildTransactionHTML(t) {
  const sign  = t.type === 'income' ? '+' : '-';
  const label = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  return `
    <div class="transaction-item ${t.type}">
      <div class="transaction-info">
        <span class="transaction-desc">${escapeHTML(t.description)}</span>
        <span class="transaction-meta">
          ${formatDate(t.date)} &middot; ${escapeHTML(t.category)} &middot; ${label}
        </span>
      </div>
      <div class="transaction-right">
        <span class="transaction-amount">${sign} ${formatRupiah(t.amount)}</span>
        <button class="btn-delete" data-id="${t.id}" title="Hapus transaksi">🗑</button>
      </div>
    </div>`;
}

function deleteTransaction(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  transactions = transactions.filter((t) => t.id !== id);
  saveToStorage();
  renderAll();
}

// ---------- Charts ----------
function renderCharts() {
  renderCategoryChart();
  renderBalanceChart();
}

// Doughnut — pengeluaran per kategori
function renderCategoryChart() {
  const ctx = document.getElementById('category-chart').getContext('2d');

  const expenseByCategory = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      expenseByCategory[t.category] =
        (expenseByCategory[t.category] || 0) + t.amount;
    });

  const labels = Object.keys(expenseByCategory);
  const data   = Object.values(expenseByCategory);
  const colors = labels.map((l) => CATEGORY_COLORS[l] || '#94a3b8');

  if (categoryChart) categoryChart.destroy();

  // Empty state placeholder
  if (labels.length === 0) {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Tidak ada data'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }],
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { enabled: false },
        },
        cutout: '60%',
      },
    });
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatRupiah(item.raw)}`,
          },
        },
      },
      cutout: '55%',
    },
  });
}

// Bar — pemasukan vs pengeluaran per bulan
function renderBalanceChart() {
  const ctx     = document.getElementById('balance-chart').getContext('2d');
  const monthly = buildMonthlyData();

  if (balanceChart) balanceChart.destroy();

  balanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: monthly.income,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Pengeluaran',
          data: monthly.expense,
          backgroundColor: 'rgba(239, 68, 68, 0.75)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) =>
              ` ${item.dataset.label}: ${formatRupiah(item.raw)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => 'Rp ' + val.toLocaleString('id-ID'),
          },
        },
      },
    },
  });
}

// Aggregate transactions into monthly buckets (last 6 months)
function buildMonthlyData() {
  const monthSet = new Set(
    transactions.map((t) => t.date.substring(0, 7))
  );
  const months = Array.from(monthSet).sort().slice(-6);

  const income = months.map((m) =>
    transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  );

  const expense = months.map((m) =>
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  );

  const labels = months.map((m) => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleDateString('id-ID', {
      month: 'short',
      year: 'numeric',
    });
  });

  return { labels, income, expense };
}

// ---------- Utilities ----------
function formatRupiah(amount) {
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID');
}

function formatDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

// Prevent XSS from user input rendered as innerHTML
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Bootstrap ----------
init();
