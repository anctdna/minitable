(() => {
  'use strict';

  const STORAGE_KEY = 'minitable_state_v1';
  const THEME_KEY = 'minitable_theme';

  const $ = (sel) => document.querySelector(sel);
  const el = {
    tablesList: $('#tablesList'),
    dataTable: $('#dataTable'),
    addTableBtn: $('#addTableBtn'),
    addRowBtn: $('#addRowBtn'),
    addColumnBtn: $('#addColumnBtn'),
    exportBtn: $('#exportBtn'),
    importInput: $('#importInput'),
    searchInput: $('#searchInput'),
    tableTitle: $('#tableTitle'),
    themeToggle: $('#themeToggle'),
  };

  let state = loadState();
  applyTheme(loadTheme());

  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

  function defaultTable(){
    return {
      id: 'tbl_1',
      name: 'Моя таблица',
      columns: [
        { id: 'c1', name: 'Название', type: 'text' },
        { id: 'c2', name: 'Статус', type: 'select', options: ['Новая','В работе','Готово'] },
        { id: 'c3', name: 'Срок', type: 'date' },
        { id: 'c4', name: 'Готово', type: 'checkbox' },
      ],
      rows: [
        { id: uid('row'), cells: { c1: 'Пример задачи', c2: 'Новая', c3: '', c4: false } }
      ],
      sort: { columnId: null, dir: 'asc' }
    };
  }

  function defaultState(){
    return {
      activeTableId: 'tbl_1',
      tables: [ defaultTable() ]
    };
  }

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if(!parsed.tables || !parsed.tables.length) return defaultState();
      return parsed;
    } catch(e){
      console.warn('Ошибка загрузки состояния, создаю новое', e);
      return defaultState();
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadTheme(){
    return localStorage.getItem(THEME_KEY) || 'light';
  }
  function applyTheme(t){
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme(){
    const next = loadTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function activeTable(){
    return state.tables.find(t => t.id === state.activeTableId) || state.tables[0];
  }

  function renderSidebar(){
    el.tablesList.innerHTML = '';
    state.tables.forEach(t => {
      const li = document.createElement('li');
      li.className = 'table-item' + (t.id === activeTable().id ? ' active' : '');

      const btn = document.createElement('button');
      btn.className = 'table-switch';
      btn.textContent = t.name;
      btn.title = 'Открыть таблицу';
      btn.addEventListener('click', () => {
        state.activeTableId = t.id;
        saveState(); render();
      });

      const del = document.createElement('button');
      del.className = 'table-del';
      del.textContent = '×';
      del.title = 'Удалить таблицу';
      del.addEventListener('click', () => {
        if(state.tables.length === 1){
          alert('Нельзя удалить последнюю таблицу');
          return;
        }
        if(!confirm(`Удалить таблицу "${t.name}"?`)) return;
        state.tables = state.tables.filter(x => x.id !== t.id);
        if(state.activeTableId === t.id){
          state.activeTableId = state.tables[0].id;
        }
        saveState(); render();
      });

      li.append(btn, del);
      el.tablesList.appendChild(li);
    });
  }

  function renderTable(){
    const table = activeTable();
    el.tableTitle.textContent = table.name;

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');

    // Actions column
    const thAct = document.createElement('th');
    thAct.className = 'col-actions';
    thAct.textContent = '#';
    htr.appendChild(thAct);

    table.columns.forEach(col => {
      const th = document.createElement('th');
      th.dataset.colId = col.id;

      const title = document.createElement('span');
      title.className = 'col-title';
      title.textContent = col.name;
      title.title = 'Клик — сортировка, двойной клик — переименовать';

      title.addEventListener('click', () => {
        if(table.sort.columnId === col.id){
          table.sort.dir = table.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          table.sort.columnId = col.id;
          table.sort.dir = 'asc';
        }
        saveState(); renderTable();
      });
      title.addEventListener('dblclick', () => {
        const newName = prompt('Новое имя колонки:', col.name);
        if(newName && newName.trim()){
          col.name = newName.trim();
          saveState(); renderTable();
        }
      });

      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      if(table.sort.columnId === col.id){
        arrow.textContent = table.sort.dir === 'asc' ? ' ▲' : ' ▼';
      }

      const typeBadge = document.createElement('span');
      typeBadge.className = 'type-badge';
      typeBadge.textContent = typeLabel(col.type);
      typeBadge.title = 'Изменить тип';
      typeBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        changeColumnType(col);
      });

      const del = document.createElement('button');
      del.className = 'col-del';
      del.textContent = '×';
      del.title = 'Удалить колонку';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if(!confirm(`Удалить колонку "${col.name}"?`)) return;
        table.rows.forEach(r => { delete r.cells[col.id]; });
        table.columns = table.columns.filter(c => c.id !== col.id);
        if(table.sort.columnId === col.id) table.sort.columnId = null;
        saveState(); renderTable();
      });

      th.append(title, arrow, typeBadge, del);
      htr.appendChild(th);
    });

    const thAdd = document.createElement('th');
    htr.appendChild(thAdd);

    thead.appendChild(htr);

    const tbody = document.createElement('tbody');

    let rows = [...table.rows];

    // search filter
    const q = (el.searchInput.value || '').trim().toLowerCase();
    if(q){
      rows = rows.filter(r => {
        return table.columns.some(c => {
          const v = r.cells[c.id];
          if(c.type === 'checkbox') return (v ? 'true' : 'false').includes(q);
          return String(v ?? '').toLowerCase().includes(q);
        });
      });
    }

    // sort
    if(table.sort.columnId){
      const colId = table.sort.columnId;
      const col = table.columns.find(x => x.id === colId);
      const dir = table.sort.dir;
      rows.sort((a,b) => compareCell(a.cells[colId], b.cells[colId], col.type) * (dir === 'asc' ? 1 : -1));
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');

      const tdAct = document.createElement('td');
      tdAct.className = 'row-actions';

      const dup = document.createElement('button');
      dup.className = 'row-dup';
      dup.title = 'Дублировать строку';
      dup.textContent = '⎘';
      dup.addEventListener('click', () => {
        const nr = { id: uid('row'), cells: {} };
        table.columns.forEach(c => nr.cells[c.id] = deepCopy(r.cells[c.id]));
        table.rows.push(nr);
        saveState(); renderTable();
      });

      const del = document.createElement('button');
      del.className = 'row-del';
      del.title = 'Удалить строку';
      del.textContent = '🗑';
      del.addEventListener('click', () => {
        if(!confirm('Удалить строку?')) return;
        table.rows = table.rows.filter(x => x.id !== r.id);
        saveState(); renderTable();
      });

      tdAct.append(dup, del);
      tr.appendChild(tdAct);

      table.columns.forEach(c => {
        const td = document.createElement('td');
        td.dataset.colId = c.id;

        let input;
        switch(c.type){
          case 'checkbox': {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!r.cells[c.id];
            input.addEventListener('change', () => {
              r.cells[c.id] = input.checked;
              saveState();
            });
            break;
          }
          case 'number': {
            input = document.createElement('input');
            input.type = 'number';
            input.value = r.cells[c.id] ?? '';
            input.addEventListener('change', () => {
              const val = input.value === '' ? '' : Number(input.value);
              r.cells[c.id] = Number.isFinite(val) ? val : '';
              saveState();
            });
            break;
          }
          case 'date': {
            input = document.createElement('input');
            input.type = 'date';
            input.value = r.cells[c.id] ?? '';
            input.addEventListener('change', () => {
              r.cells[c.id] = input.value;
              saveState();
            });
            break;
          }
          case 'select': {
            input = document.createElement('select');
            const empty = document.createElement('option');
            empty.value = ''; empty.textContent = '';
            input.appendChild(empty);
            (c.options || []).forEach(opt => {
              const o = document.createElement('option');
              o.value = opt; o.textContent = opt;
              input.appendChild(o);
            });
            input.value = r.cells[c.id] ?? '';
            input.addEventListener('change', () => {
              r.cells[c.id] = input.value;
              saveState();
            });
            // Быстрый редакт. опций
            input.addEventListener('dblclick', () => {
              const s = prompt('Опции для списка (через запятую):', (c.options || []).join(', '));
              if(s !== null){
                c.options = s.split(',').map(x => x.trim()).filter(Boolean);
                saveState(); renderTable();
              }
            });
            break;
          }
          default: {
            input = document.createElement('input');
            input.type = 'text';
            input.value = r.cells[c.id] ?? '';
            input.addEventListener('input', () => {
              r.cells[c.id] = input.value;
              saveState();
            });
          }
        }
        input.className = 'cell-input';
        td.appendChild(input);
        tr.appendChild(td);
      });

      const tdAdd = document.createElement('td');
      const plus = document.createElement('button');
      plus.className = 'row-add-after';
      plus.title = 'Добавить строку ниже';
      plus.textContent = '+';
      plus.addEventListener('click', () => {
        const idx = table.rows.findIndex(x => x.id === r.id);
        const newRow = emptyRow(table);
        table.rows.splice(idx + 1, 0, newRow);
        saveState(); renderTable();
      });
      tdAdd.appendChild(plus);
      tr.appendChild(tdAdd);

      tbody.appendChild(tr);
    });

    el.dataTable.innerHTML = '';
    el.dataTable.appendChild(thead);
    el.dataTable.appendChild(tbody);
  }

  function emptyRow(table){
    const row = { id: uid('row'), cells: {} };
    table.columns.forEach(c => {
      row.cells[c.id] = (c.type === 'checkbox') ? false : '';
    });
    return row;
  }

  function compareCell(a, b, type){
    if(type === 'number'){
      const an = Number(a), bn = Number(b);
      if(isNaN(an) && isNaN(bn)) return 0;
      if(isNaN(an)) return -1;
      if(isNaN(bn)) return 1;
      return an - bn;
    }
    if(type === 'checkbox'){
      return (a ? 1 : 0) - (b ? 1 : 0);
    }
    if(type === 'date'){
      return String(a || '').localeCompare(String(b || ''));
    }
    // text/select
    return String(a || '').localeCompare(String(b || ''), 'ru', { sensitivity: 'base' });
  }

  function typeLabel(t){
    switch(t){
      case 'text': return 'txt';
      case 'number': return 'num';
      case 'date': return 'date';
      case 'checkbox': return '✓';
      case 'select': return 'list';
      default: return t;
    }
  }

  function changeColumnType(col){
    const allow = ['text','number','date','checkbox','select'];
    const t = prompt('Тип колонки (text, number, date, checkbox, select):', col.type || 'text');
    if(!t) return;
    const v = t.trim().toLowerCase();
    if(!allow.includes(v)){ alert('Неизвестный тип'); return; }
    col.type = v;
    if(v === 'select'){
      const opts = prompt('Опции для списка (через запятую):', (col.options || []).join(', '));
      col.options = (opts || '').split(',').map(s => s.trim()).filter(Boolean);
    } else {
      delete col.options;
    }
    saveState(); renderTable();
  }

  function render(){
    renderSidebar();
    renderTable();
  }

  // Events
  el.addTableBtn.addEventListener('click', () => {
    const name = prompt('Название новой таблицы:', 'Новая таблица');
    if(!name) return;
    const t = {
      id: uid('tbl'),
      name: name.trim(),
      columns: [{ id: uid('col'), name: 'Название', type: 'text' }],
      rows: [],
      sort: { columnId: null, dir: 'asc' }
    };
    state.tables.push(t);
    state.activeTableId = t.id;
    saveState(); render();
  });

  el.addRowBtn.addEventListener('click', () => {
    const t = activeTable();
    t.rows.push(emptyRow(t));
    saveState(); renderTable();
  });

  el.addColumnBtn.addEventListener('click', () => {
    const t = activeTable();
    const name = prompt('Название колонки:', 'Новая колонка');
    if(!name) return;
    const type = prompt('Тип (text, number, date, checkbox, select):', 'text');
    if(!type) return;
    const allow = ['text','number','date','checkbox','select'];
    const v = type.trim().toLowerCase();
    if(!allow.includes(v)){ alert('Неизвестный тип'); return; }
    const col = { id: uid('col'), name: name.trim(), type: v };
    if(v === 'select'){
      const opts = prompt('Опции для списка (через запятую):', 'Новая, В работе, Готово');
      col.options = (opts || '').split(',').map(s => s.trim()).filter(Boolean);
    }
    t.columns.push(col);
    t.rows.forEach(r => r.cells[col.id] = v === 'checkbox' ? false : '');
    saveState(); renderTable();
  });

  el.exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `minitable-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  el.importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const imported = JSON.parse(fr.result);
        if(!imported || !imported.tables) throw new Error('Неверный формат JSON');
        if(!confirm('Заменить текущие данные импортированными?')) return;
        state = imported;
        saveState(); render();
        alert('Импорт завершён');
      } catch(err){
        alert('Ошибка импорта: ' + err.message);
      } finally {
        e.target.value = ''; // сброс input
      }
    };
    fr.readAsText(file);
  });

  el.searchInput.addEventListener('input', () => renderTable());

  el.tableTitle.addEventListener('blur', () => {
    const t = activeTable();
    const newName = el.tableTitle.textContent.trim();
    if(!newName){ el.tableTitle.textContent = t.name; return; }
    t.name = newName;
    saveState(); renderSidebar();
  });

  el.themeToggle.addEventListener('click', toggleTheme);

  function deepCopy(v){ return JSON.parse(JSON.stringify(v)); }

  // Init
  render();
})();
