/* Browser-side interactions for the static examination system demo. */
(() => {
  const storage = {
    get(key, fallback = []) { try { return JSON.parse(localStorage.getItem(`oes:${key}`)) ?? fallback; } catch { return fallback; } },
    set(key, value) { localStorage.setItem(`oes:${key}`, JSON.stringify(value)); }
  };
  const page = location.pathname.toLowerCase();
  const notify = (message) => {
    let node = document.querySelector('[data-notice]');
    if (!node) {
      node = document.createElement('div'); node.dataset.notice = '';
      Object.assign(node.style, { position:'fixed', right:'20px', bottom:'20px', zIndex:9999, background:'#17233a', color:'#fff', padding:'12px 18px', borderRadius:'8px', boxShadow:'0 4px 18px #0003' });
      document.body.append(node);
    }
    node.textContent = message; clearTimeout(node._timer); node._timer = setTimeout(() => node.remove(), 3200);
  };
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const publicPage = page.endsWith('/index.html') || page.endsWith('/login.html') || page.endsWith('/registration.html') || page.endsWith('/') || page === '';
  let session = storage.get('session', null);
  if (session && !storage.get('registeredUsers').some(user => user.email.toLowerCase() === String(session.email || '').toLowerCase())) {
    localStorage.removeItem('oes:session'); session = null;
  }
  if (!publicPage && !session) {
    location.replace(page.includes('/') ? '../login.html' : 'login.html');
    return;
  }
  if (session) {
    const userBox = document.querySelector('.user-box');
    if (userBox) {
      userBox.innerHTML = `<strong>${safe(session.name || session.role || 'User')}</strong><br><span>${safe(session.email || '')}</span><br><button type="button" data-sign-out>Sign out</button>`;
      userBox.querySelector('[data-sign-out]').addEventListener('click', () => { localStorage.removeItem('oes:session'); location.href = page.includes('/') ? '../login.html' : 'login.html'; });
    }
  }

  // Live table search and filters; apply to the existing prototype rows.
  document.querySelectorAll('form.toolbar').forEach(form => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    if (!rows.length) return;
    const filter = () => {
      const values = [...form.querySelectorAll('input,select')].map(el => [el.type === 'search' ? el.value.trim().toLowerCase() : '', el.tagName === 'SELECT' ? el.value.trim().toLowerCase() : '']);
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const matches = values.every(([search, selected]) => (!search || text.includes(search)) && (!selected || text.includes(selected)));
        row.hidden = !matches;
      });
    };
    form.addEventListener('input', filter); form.addEventListener('change', filter);
    form.addEventListener('submit', event => { event.preventDefault(); filter(); notify('Results updated.'); });
  });

  // Remove prototype rows and any browser-saved records.
  document.addEventListener('click', event => {
    const link = event.target.closest('a'); if (!link) return;
    if (link.getAttribute('href') === '#') { event.preventDefault(); notify('This action is not available on this page.'); }
    if (link.classList.contains('btn-danger')) {
      event.preventDefault();
      if (confirm('Remove this item?')) { link.closest('tr')?.remove(); notify('Item removed.'); }
    }
  });

  const formData = (form) => Object.fromEntries(new FormData(form).entries());
  const addRecord = (key, record) => { const list = storage.get(key); list.push(record); storage.set(key, list); };
  const addTableRow = (values) => {
    const tbody = document.querySelector('table tbody'); if (!tbody) return;
    const row = document.createElement('tr'); row.innerHTML = values.map(value => `<td>${safe(value)}</td>`).join(''); tbody.prepend(row);
  };

  // Sign-in is a demo role switch, not an authentication system.
  const login = document.querySelector('.auth-panel form #role')?.closest('form');
  login?.addEventListener('submit', event => {
    event.preventDefault(); const data = formData(login);
    const account = storage.get('registeredUsers').find(user => user.email.toLowerCase() === data.email.trim().toLowerCase());
    if (!account) {
      location.href = `registration.html?email=${encodeURIComponent(data.email.trim())}&role=${encodeURIComponent(data.role)}`;
      return;
    }
    if (account.role !== data.role) { notify(`This email is registered as ${account.role}. Select that role to continue.`); return; }
    storage.set('session', { email:account.email, role:data.role, name:account.name });
    location.href = data.role === 'student' ? 'exams/exam-paper.html' : data.role === 'admin' ? 'admin/admin.html' : 'exams/exams.html';
  });
  const registration = document.querySelector('#registration-form');
  if (registration) {
    const emailField = registration.querySelector('#email');
    const requestedEmail = new URLSearchParams(location.search).get('email');
    const requestedRole = new URLSearchParams(location.search).get('role');
    if (requestedEmail && emailField) emailField.value = requestedEmail;
    const roleField = registration.querySelector('#role');
    if (requestedRole && roleField && [...roleField.options].some(option => option.value === requestedRole)) roleField.value = requestedRole;
  }
  registration?.addEventListener('submit', event => {
    event.preventDefault(); const data = formData(registration);
    if (data.password !== data.confirm_password) { registration.querySelector('#confirm-password').setCustomValidity('Passwords do not match.'); registration.reportValidity(); registration.querySelector('#confirm-password').setCustomValidity(''); return; }
    const users = storage.get('registeredUsers');
    if (users.some(user => user.email.toLowerCase() === data.email.toLowerCase())) { notify('An account with this email already exists in this browser.'); return; }
    // Do not retain passwords in local storage. This is registration UI only, not authentication.
    users.push({ name:data.full_name, email:data.email, role:data.role }); storage.set('registeredUsers', users);
    notify('Demo account created. You can now sign in.'); setTimeout(() => location.href='login.html', 700);
  });

  // Persist settings in this browser and restore them on return.
  const settings = document.querySelector('form') && page.endsWith('/settings.html') ? document.querySelector('form') : null;
  if (settings) {
    const saved = storage.get('settings', null);
    if (saved) settings.querySelectorAll('[name]').forEach(input => {
      const value = saved[input.name];
      if (input.type === 'checkbox') input.checked = Array.isArray(value) && value.includes(input.value || 'on');
      else if (input.type === 'radio') input.checked = value === input.value;
      else if (value !== undefined) input.value = value;
    });
    settings.addEventListener('submit', event => {
      event.preventDefault(); const values = {};
      [...settings.elements].filter(input => input.name).forEach(input => {
        const named = [...settings.querySelectorAll(`[name="${CSS.escape(input.name)}"]`)];
        if (input.type === 'checkbox') values[input.name] = named.filter(item => item.checked).map(item => item.value || 'on');
        else if (input.type === 'radio') values[input.name] = named.find(item => item.checked)?.value || '';
        else values[input.name] = input.value;
      });
      storage.set('settings', values); notify('Settings saved in this browser.');
    });
  }

  // Create exam and question forms write demo records locally.
  if (page.endsWith('/create-exam.html')) {
    const form = document.querySelector('main form');
    form?.addEventListener('submit', event => {
      event.preventDefault(); const data = formData(form); const action = event.submitter?.value === 'draft' ? 'Draft' : 'Scheduled';
      addRecord('exams', {...data, status:action});
      notify(`${action === 'Draft' ? 'Draft saved' : 'Exam published'} in this browser.`); setTimeout(() => location.href = 'exams.html', 500);
    });
  }
  if (page.endsWith('/add-question.html')) {
    const form = document.querySelector('main form');
    form?.addEventListener('submit', event => { event.preventDefault(); const data=formData(form); addRecord('questions', data); notify('Question saved in this browser.'); if (event.submitter?.value === 'save-another') form.reset(); else setTimeout(() => location.href='question-bank.html', 500); });
  }
  if (page.endsWith('/manage-users.html')) {
    const form = [...document.querySelectorAll('form')].find(item => item.querySelector('#full-name'));
    form?.addEventListener('submit', event => { event.preventDefault(); const d=formData(form); addRecord('users', d); addTableRow([d.full_name,d.email,d.role,d.group || '—',d.status || 'Active','New']); form.reset(); notify('User added in this browser.'); });
  }
  // Restore user-created records in their matching lists.
  if (page.endsWith('/exams.html')) storage.get('exams').forEach(d => addTableRow([d.title,d.subject,d.date || 'Not set',`${d.duration || '—'} min`,d.total_marks || '—',d.status,'View']));
  if (page.endsWith('/question-bank.html')) storage.get('questions').forEach(d => addTableRow([d.question,d.subject || '—',d.type || '—',d.difficulty || '—','—','New']));
  if (page.endsWith('/manage-users.html')) storage.get('users').forEach(d => addTableRow([d.full_name,d.email,d.role,d.group || '—',d.status || 'Active','New']));

  // Timed quiz: answer palette, countdown, and local score summary.
  const quiz = document.querySelector('form.exam-layout');
  if (quiz) {
    const questions=[...quiz.querySelectorAll('.question')], palette=[...quiz.querySelectorAll('.palette-grid a')];
    questions.forEach((question,index) => question.addEventListener('change', () => palette[index]?.classList.add('done')));
    const timer=document.querySelector('.timer strong'); let remaining=30*60;
    if(timer){ const tick=()=>{ const m=Math.floor(remaining/60),s=remaining%60; timer.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; if(remaining--<=0){quiz.requestSubmit();return;} setTimeout(tick,1000); }; tick(); }
    quiz.addEventListener('submit', event => {
      event.preventDefault(); const correct=['b','b','c','c','b','c','b','a','c','b']; let score=0;
      questions.forEach((question,index)=>{if(question.querySelector('input:checked')?.value===correct[index])score++;});
      storage.set('latestResult',{score,total:questions.length,submittedAt:new Date().toISOString()});
      notify(`Exam submitted. Demo score: ${score}/${questions.length}.`);
      setTimeout(()=>location.href='../results/result-detail.html',700);
    });
  }
  const latest=storage.get('latestResult',null);
  if(latest && page.endsWith('/result-detail.html')) { const heading=document.querySelector('h1'); if(heading) heading.insertAdjacentHTML('afterend',`<p class="lead" data-latest-result>Your latest demo score: <strong>${safe(latest.score)}/${safe(latest.total)}</strong></p>`); }

  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click',()=>window.print()));
  document.querySelectorAll('.pagination a').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();notify('All sample records are shown on this page.');}));
  document.querySelectorAll('form[action="#"]').forEach(form => form.addEventListener('submit', event => {
    if (!event.defaultPrevented) { event.preventDefault(); notify('Form submitted in this demo.'); }
  }));
})();
