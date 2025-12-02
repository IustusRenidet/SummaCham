(() => {
  const tbody = document.getElementById('summaryCityAggregates');
  const catalog = window.SUMMARY_CATALOG;
  if (!tbody || !catalog) {
    return;
  }

  const formatCurrency = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const sanitize = (code) => {
    const digits = (code || '').toString().replace(/[^0-9]/g, '');
    if (!digits) return '';
    return digits.padEnd(21, '0').slice(0, 21);
  };

  const buildDetalleMap = (detalle = []) => {
    const map = new Map();
    detalle.forEach((row) => {
      const codigo = sanitize(row.codigo || row.codigoCuenta || row.code);
      if (!codigo) return;
      map.set(codigo, {
        actual: Number(row.acumuladoActual || row.ytdActual || 0),
        plan: Number(row.acumuladoPlan || row.ytdPlan || 0),
        prev: Number(row.acumuladoAnterior || row.ytdAnterior || 0)
      });
    });
    return map;
  };

  const sumMetrics = (codes, map, field) => {
    return codes.reduce((acc, code) => {
      const registro = map.get(sanitize(code));
      if (!registro) return acc;
      return acc + (registro[field] || 0);
    }, 0);
  };

  const aggregateMajor = (major, map) => {
    return ['actual', 'plan', 'prev'].reduce((acc, key) => {
      acc[key] += sumMetrics(major.codes || [], map, key);
      return acc;
    }, { actual: 0, plan: 0, prev: 0 });
  };

  const computeCityMetrics = (cityKey, map) => {
    const city = catalog.cities[cityKey];
    if (!city) return null;
    const majors = city.majors || {};
    const metrics = {
      income: { actual: 0, plan: 0, prev: 0 },
      expense: { actual: 0, plan: 0, prev: 0 },
      other: { actual: 0, plan: 0, prev: 0 }
    };
    Object.values(majors).forEach((major) => {
      const tipo = major.type || 'income';
      const sum = aggregateMajor(major, map);
      if (tipo === 'income') {
        metrics.income.actual += sum.actual;
        metrics.income.plan += sum.plan;
        metrics.income.prev += sum.prev;
      } else if (tipo === 'expense') {
        metrics.expense.actual += sum.actual;
        metrics.expense.plan += sum.plan;
        metrics.expense.prev += sum.prev;
      } else if (tipo === 'other') {
        metrics.other.actual += sum.actual;
        metrics.other.plan += sum.plan;
        metrics.other.prev += sum.prev;
      }
    });
    metrics.operating = {
      actual: metrics.income.actual - metrics.expense.actual,
      plan: metrics.income.plan - metrics.expense.plan,
      prev: metrics.income.prev - metrics.expense.prev
    };
    metrics.net = {
      actual: metrics.operating.actual + metrics.other.actual,
      plan: metrics.operating.plan + metrics.other.plan,
      prev: metrics.operating.prev + metrics.other.prev
    };
    return metrics;
  };

  const variation = (actual, base) => {
    if (!Number.isFinite(base) || base === 0) return 0;
    return ((actual - base) / Math.abs(base)) * 100;
  };

  const renderCurrencyCell = (value, plan = null, prev = null) => {
    const cell = document.createElement('td');
    cell.innerHTML = `
      <div>${formatCurrency.format(value)}</div>
      ${plan != null ? `<small class="text-muted">Plan ${formatCurrency.format(plan)}</small>` : ''}
      ${prev != null ? `<small class="text-muted d-block">Prev ${formatCurrency.format(prev)}</small>` : ''}
    `;
    return cell;
  };

  const renderRow = (label, metrics, highlight = false) => {
    const tr = document.createElement('tr');
    if (highlight) {
      tr.className = 'table-success fw-semibold';
    }
    const incomeCell = renderCurrencyCell(metrics.income.actual, metrics.income.plan, metrics.income.prev);
    const expenseCell = document.createElement('td');
    expenseCell.textContent = formatCurrency.format(metrics.expense.actual);
    const operatingCell = document.createElement('td');
    operatingCell.textContent = formatCurrency.format(metrics.operating.actual);
    const otherCell = document.createElement('td');
    otherCell.textContent = formatCurrency.format(metrics.other.actual);
    const netCell = document.createElement('td');
    netCell.textContent = formatCurrency.format(metrics.net.actual);

    tr.appendChild(Object.assign(document.createElement('td'), { textContent: label }));
    tr.appendChild(incomeCell);
    tr.appendChild(renderCurrencyCell(metrics.income.plan, metrics.income.plan, metrics.income.prev));
    tr.appendChild(renderCurrencyCell(metrics.income.prev, null, null));
    tr.appendChild(expenseCell);
    tr.appendChild(operatingCell);
    tr.appendChild(otherCell);
    tr.appendChild(netCell);
    return tr;
  };

  const renderAggregates = (cities) => {
    tbody.innerHTML = '';
    const consolidated = {
      income: { actual: 0, plan: 0, prev: 0 },
      expense: { actual: 0, plan: 0, prev: 0 },
      other: { actual: 0, plan: 0, prev: 0 },
      operating: { actual: 0, plan: 0, prev: 0 },
      net: { actual: 0, plan: 0, prev: 0 }
    };

    cities.forEach(({ label, metrics }) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${label}</td>
        <td>${formatCurrency.format(metrics.income.actual)}</td>
        <td>${formatCurrency.format(metrics.income.plan)}</td>
        <td>${formatCurrency.format(metrics.income.prev)}</td>
        <td>${formatCurrency.format(metrics.expense.actual)}</td>
        <td>${formatCurrency.format(metrics.operating.actual)}</td>
        <td>${formatCurrency.format(metrics.other.actual)}</td>
        <td>${formatCurrency.format(metrics.net.actual)}</td>
      `;
      tbody.appendChild(row);
      Object.keys(consolidated).forEach((key) => {
        consolidated[key].actual += metrics[key].actual || 0;
        consolidated[key].plan += metrics[key].plan || 0;
        consolidated[key].prev += metrics[key].prev || 0;
      });
    });

    const consolidatedRow = document.createElement('tr');
    consolidatedRow.className = 'table-info fw-semibold';
    consolidatedRow.innerHTML = `
      <td>Consolidated</td>
      <td>${formatCurrency.format(consolidated.income.actual)}</td>
      <td>${formatCurrency.format(consolidated.income.plan)}</td>
      <td>${formatCurrency.format(consolidated.income.prev)}</td>
      <td>${formatCurrency.format(consolidated.expense.actual)}</td>
      <td>${formatCurrency.format(consolidated.operating.actual)}</td>
      <td>${formatCurrency.format(consolidated.other.actual)}</td>
      <td>${formatCurrency.format(consolidated.net.actual)}</td>
    `;
    tbody.appendChild(consolidatedRow);
  };

  window.addEventListener('summary:data-ready', (event) => {
    const detalle = event.detail.detalle || [];
    const map = buildDetalleMap(detalle);
    const rows = catalog.order
      .map((cityKey) => {
        const metrics = computeCityMetrics(cityKey, map);
        return metrics ? { label: cityKey, metrics } : null;
      })
      .filter(Boolean);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay información añadida.</td></tr>';
      return;
    }
    renderAggregates(rows);
  });
})();
