const STORAGE_KEYS = {
  user: 'boeUser',
  draft: 'boeDraft',
  records: 'boeRecords'
};

const sampleRecords = [
  {
    id: 'sample-1',
    aluno: 'Aluno A',
    turma: '2º Ano B',
    data: '2026-06-02',
    horario: '14:30',
    local: 'Pátio da escola',
    tipo: 'Conflito grave',
    descricao: 'Registro demonstrativo com descrição objetiva dos fatos ocorridos no ambiente escolar.',
    providencia: 'Comunicação à coordenação pedagógica.',
    status: 'Pendente',
    criadoEm: '2026-06-02T14:40:00.000Z'
  },
  {
    id: 'sample-2',
    aluno: 'Aluno B',
    turma: '1º Ano A',
    data: '2026-05-30',
    horario: '10:15',
    local: 'Sala de aula',
    tipo: 'Ameaça',
    descricao: 'Registro demonstrativo para compor o histórico de ocorrências.',
    providencia: 'Orientação inicial e registro para acompanhamento.',
    status: 'Registrado',
    criadoEm: '2026-05-30T10:25:00.000Z'
  },
  {
    id: 'sample-3',
    aluno: 'Aluno C',
    turma: '3º Ano C',
    data: '2026-05-28',
    horario: '16:00',
    local: 'Corredor',
    tipo: 'Outro caso grave',
    descricao: 'Registro demonstrativo encaminhado conforme orientação da escola.',
    providencia: 'Encaminhamento à equipe responsável.',
    status: 'Encaminhado',
    criadoEm: '2026-05-28T16:20:00.000Z'
  }
];

const routesWithoutAuth = ['index.html', '', '/'];

document.addEventListener('DOMContentLoaded', () => {
  protectRoute();
  initLogin();
  initLogout();
  initOccurrenceForm();
  initReviewPage();
  initDashboard();
  initHistory();
});

function getCurrentPage() {
  return window.location.pathname.split('/').pop();
}

function protectRoute() {
  const page = getCurrentPage();
  const isPublic = routesWithoutAuth.includes(page);
  const hasUser = Boolean(localStorage.getItem(STORAGE_KEYS.user));

  if (!isPublic && !hasUser) {
    window.location.href = 'index.html';
  }

  if (page === 'index.html' && hasUser) {
    window.location.href = 'painel.html';
  }
}

function initLogin() {
  const form = document.querySelector('#loginForm');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const email = form.email.value.trim();
    const senha = form.senha.value.trim();
    let hasError = false;

    if (!isValidEmail(email)) {
      showError('email', 'Informe um e-mail válido.');
      hasError = true;
    }

    if (senha.length < 4) {
      showError('senha', 'A senha precisa ter pelo menos 4 caracteres.');
      hasError = true;
    }

    if (hasError) return;

    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ email, loginAt: new Date().toISOString() }));
    ensureSampleRecords();
    window.location.href = 'painel.html';
  });
}

function initLogout() {
  const button = document.querySelector('#logoutBtn');
  if (!button) return;

  button.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.user);
    window.location.href = 'index.html';
  });
}

function initOccurrenceForm() {
  const form = document.querySelector('#occurrenceForm');
  if (!form) return;

  setDefaultDateTime(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors(form);

    const data = Object.fromEntries(new FormData(form).entries());
    const errors = validateOccurrence(data);

    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, message]) => showError(field, message));
      return;
    }

    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(data));
    window.location.href = 'revisao.html';
  });
}

function initReviewPage() {
  const box = document.querySelector('#reviewBox');
  const button = document.querySelector('#confirmSaveBtn');
  if (!box || !button) return;

  const draft = getDraft();
  if (!draft) {
    box.innerHTML = '<div class="empty-state">Nenhum boletim em revisão. Volte e preencha uma nova ocorrência.</div>';
    button.disabled = true;
    return;
  }

  box.innerHTML = renderReview(draft);

  button.addEventListener('click', () => {
    const records = getRecords();
    const newRecord = {
      ...draft,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      status: 'Registrado',
      criadoEm: new Date().toISOString()
    };

    records.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
    localStorage.removeItem(STORAGE_KEYS.draft);
    window.location.href = 'historico.html';
  });
}

function initDashboard() {
  const recentList = document.querySelector('#recentList');
  if (!recentList) return;

  ensureSampleRecords();
  const records = getRecords();
  const counts = countByStatus(records);

  setText('#statPendentes', counts.Pendente || 0);
  setText('#statRegistradas', records.length);
  setText('#statEncaminhadas', counts.Encaminhado || 0);

  recentList.innerHTML = records.slice(0, 3).map(renderRecordCard).join('') || renderEmptyState('Nenhuma ocorrência cadastrada.');
}

function initHistory() {
  const list = document.querySelector('#historyList');
  if (!list) return;

  ensureSampleRecords();
  const searchInput = document.querySelector('#searchInput');
  const statusFilter = document.querySelector('#statusFilter');
  const clearButton = document.querySelector('#clearRecordsBtn');

  const render = () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const records = getRecords().filter((record) => {
      const text = `${record.aluno} ${record.turma} ${record.local} ${record.tipo}`.toLowerCase();
      const matchesSearch = text.includes(searchTerm);
      const matchesStatus = status === 'todos' || record.status === status;
      return matchesSearch && matchesStatus;
    });

    list.innerHTML = records.map(renderRecordCard).join('') || renderEmptyState('Nenhum registro encontrado para o filtro informado.');
  };

  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);
  clearButton.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([]));
    render();
  });

  render();
}

function validateOccurrence(data) {
  const errors = {};
  const requiredFields = ['aluno', 'turma', 'data', 'horario', 'local', 'tipo', 'descricao', 'providencia'];

  requiredFields.forEach((field) => {
    if (!data[field] || !data[field].trim()) {
      errors[field] = 'Este campo é obrigatório.';
    }
  });

  if (data.descricao && data.descricao.trim().length < 20) {
    errors.descricao = 'A descrição deve ter pelo menos 20 caracteres.';
  }

  if (data.providencia && data.providencia.trim().length < 10) {
    errors.providencia = 'A providência deve ter pelo menos 10 caracteres.';
  }

  return errors;
}

function renderReview(draft) {
  const rows = [
    ['Aluno', draft.aluno],
    ['Turma', draft.turma],
    ['Data e horário', `${formatDate(draft.data)} - ${draft.horario}`],
    ['Local', draft.local],
    ['Tipo', draft.tipo],
    ['Descrição', draft.descricao],
    ['Providência inicial', draft.providencia]
  ];

  return rows.map(([label, value]) => `
    <div class="review-row">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `).join('');
}

function renderRecordCard(record) {
  return `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(record.aluno)} - ${escapeHtml(record.turma)}</h3>
        <div class="record-meta">
          ${escapeHtml(record.tipo)} • ${formatDate(record.data)} às ${escapeHtml(record.horario)} • ${escapeHtml(record.local)}
        </div>
        <p>${escapeHtml(record.providencia)}</p>
      </div>
      <span class="badge ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span>
    </article>
  `;
}

function renderEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function ensureSampleRecords() {
  if (!localStorage.getItem(STORAGE_KEYS.records)) {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(sampleRecords));
  }
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.records)) || [];
  } catch {
    return [];
  }
}

function getDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
  } catch {
    return null;
  }
}

function countByStatus(records) {
  return records.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});
}

function setDefaultDateTime(form) {
  const now = new Date();
  form.data.value = now.toISOString().slice(0, 10);
  form.horario.value = now.toTimeString().slice(0, 5);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function clearErrors(form) {
  form.querySelectorAll('.error-message').forEach((element) => {
    element.textContent = '';
  });
}

function showError(field, message) {
  const element = document.querySelector(`[data-error="${field}"]`);
  if (element) element.textContent = message;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
