// Frontend for the Been There, Done That demo.
// All user text is inserted with textContent, never as HTML.

const state = { people: [], me: null, page: null, summaryStartup: '' };
const $ = (id) => document.getElementById(id);

// ---------- Helpers ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Demo-User': String(state.me?.id ?? ''), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Remembers who you were viewing as. Storage can be unavailable, so failures are ignored.
function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function recall(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

const SHARE_LABELS = {
  email: 'Share with my email',
  anonymous: 'Share anonymously',
  private: 'Keep private',
};

// ---------- Story card (used on Matches and after submitting) ----------
function storyCard(m, me) {
  const actions = el('div', { class: 'actions' });
  let by;
  if (m.author) {
    by = el('div', { class: 'by' }, el('strong', {}, m.author.name), ` · ${m.author.title}, ${m.author.startup} · ${m.author.location} · shared ${m.author.solved}`);
    const first = m.author.name.split(' ')[0];
    actions.append(
      el('button', { class: 'btn primary', type: 'button', onclick: () => openEmailWindow(m, me) }, `Write to ${first}`),
      el('span', { class: 'email' }, m.author.email),
    );
  } else {
    by = el('div', { class: 'by' }, 'A Volta resident · shared anonymously, no contact details');
  }
  return el('article', { class: 'story' },
    el('div', { class: 'problem' }, `Solved: ${m.problem}`),
    el('blockquote', {}, m.text),
    by,
    m.author ? actions : null,
  );
}

async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); return true; }
  catch { toast('Copy not available. Select the text instead.'); return false; }
}

// Records that the founder reached out (no message content is sent to the server).
function logOutreach(storyId, method) {
  api('/api/outreach', { method: 'POST', body: { storyId, method } }).catch(() => {});
}

// "Write to ..." opens this window with a ready-to-send email the founder can edit,
// then send through Gmail, Outlook on the web, their email app, or by copying it.
function openEmailWindow(m, me) {
  const first = m.author.name.split(' ')[0];
  const to = m.author.email;
  const enc = encodeURIComponent;
  const subject = el('input', { type: 'text', id: 'mail-subject', value: `Fellow Volta resident: your note on "${m.problem}"` });
  const body = el('textarea', { id: 'mail-body', rows: '8' });
  body.value = `Hi ${first},\n\nI'm ${me.name}, also in the Volta residency. I read how you handled "${m.problem}", and I'm working through something similar.\n\nCould you spare 15 minutes to share what you learned?\n\nThanks,\n${me.name.split(' ')[0]}`;

  const openWeb = (method, url, label) => () => {
    logOutreach(m.id, method);
    window.open(url(), '_blank', 'noopener');
    toast(`Opening ${label} in a new tab`);
  };
  const appLink = el('a', { class: 'btn', href: '#' }, 'Open in my email app');
  appLink.addEventListener('click', () => {
    appLink.href = `mailto:${enc(to)}?subject=${enc(subject.value)}&body=${enc(body.value)}`;
    logOutreach(m.id, 'app');
    toast('Opening your email app');
  });

  const dialog = el('dialog', { class: 'mail', 'aria-labelledby': 'mail-title' },
    el('div', { class: 'mail-head' },
      el('h2', { id: 'mail-title' }, `Write to ${m.author.name}`),
      el('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Close')),
    el('p', { class: 'hint' }, 'Edit anything you like. Nothing is sent until you send it from your own email.'),
    el('div', { class: 'field' }, 'To'), el('div', { class: 'email' }, to),
    el('label', { class: 'field', for: 'mail-subject' }, 'Subject'), subject,
    el('label', { class: 'field', for: 'mail-body' }, 'Message'), body,
    el('div', { class: 'actions' },
      el('button', { class: 'btn primary', type: 'button',
        onclick: openWeb('gmail', () => `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject.value)}&body=${enc(body.value)}`, 'Gmail') }, 'Open in Gmail'),
      el('button', { class: 'btn', type: 'button',
        onclick: openWeb('outlook', () => `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject.value)}&body=${enc(body.value)}`, 'Outlook') }, 'Open in Outlook'),
      appLink,
      el('button', { class: 'btn', type: 'button', onclick: async () => {
        if (await copy(`To: ${to}\nSubject: ${subject.value}\n\n${body.value}`, 'Email copied')) logOutreach(m.id, 'copy');
      } }, 'Copy email')),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function matchesBlock(matches, me) {
  if (!matches || !matches.length) {
    return el('p', { class: 'empty' }, 'No resident has shared a story about this yet.');
  }
  return el('div', {}, matches.map((m) => storyCard(m, me)));
}

// ---------- Page: Monthly update ----------
async function pageUpdate(main) {
  const data = await api('/api/update');
  const choices = new Map(); // blocker id -> { status, text, share }

  const pastList = data.pastBlockers.map((b) => {
    const entry = { status: null, text: '', share: '', storyHelped: undefined };
    choices.set(b.id, entry);

    const preview = el('div', { class: 'preview' });
    const body = el('div', { hidden: true });
    const text = el('textarea', { id: `helped-${b.id}`, placeholder: 'What worked, and what you learned.', maxlength: '1500' });
    const share = el('select', { id: `share-${b.id}` },
      el('option', { value: '' }, 'Choose how to share…'),
      Object.entries(SHARE_LABELS).map(([v, l]) => el('option', { value: v }, l)));

    const updatePreview = () => {
      entry.text = text.value.trim();
      entry.share = share.value;
      preview.replaceChildren();
      if (!entry.text) { preview.append('Nothing will be shared unless you write something.'); return; }
      if (!entry.share) { preview.append('Choose how to share to see how others will see it.'); return; }
      if (entry.share === 'private') { preview.append('Only you will see this story.'); return; }
      preview.append('Others will see: ', el('strong', {}, `Solved: ${b.text}`), ` — "${entry.text}" — `,
        entry.share === 'email' ? `${state.me.name}, with your email so they can contact you` : 'as "A Volta resident", with no name or contact details');
    };
    text.addEventListener('input', updatePreview);
    share.addEventListener('change', updatePreview);
    updatePreview();

    const helpedYes = el('input', { type: 'radio', name: `story-helped-${b.id}`, value: 'yes' });
    const helpedNo = el('input', { type: 'radio', name: `story-helped-${b.id}`, value: 'no' });
    helpedYes.addEventListener('change', () => { entry.storyHelped = true; });
    helpedNo.addEventListener('change', () => { entry.storyHelped = false; });

    body.append(
      el('fieldset', { class: 'helped-q' },
        el('legend', {}, "Did a resident's story help you solve this?"),
        el('label', { class: 'pill' }, helpedYes, 'Yes'),
        el('label', { class: 'pill' }, helpedNo, 'No')),
      el('label', { class: 'field', for: `helped-${b.id}` }, 'What helped? (optional)'),
      text,
      el('div', { class: 'note' }, 'Leave out confidential details such as customer names, numbers or contracts.'),
      el('label', { class: 'field', for: `share-${b.id}` }, 'Share this with other residents?'),
      share,
      preview,
    );

    const solvedBtn = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Solved');
    const openBtn = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Still working on it');
    const pick = (status) => {
      entry.status = status;
      solvedBtn.setAttribute('aria-pressed', String(status === 'solved'));
      openBtn.setAttribute('aria-pressed', String(status === 'open'));
      body.hidden = status !== 'solved';
    };
    solvedBtn.addEventListener('click', () => pick('solved'));
    openBtn.addEventListener('click', () => pick('open'));

    return el('div', { class: 'item' },
      el('div', { class: 'item-head' },
        el('div', {}, el('div', { class: 'item-title' }, b.text), el('div', { class: 'meta' }, `From your ${b.reported} update`)),
        el('div', { class: 'seg', role: 'group', 'aria-label': `Status of ${b.text}` }, openBtn, solvedBtn)),
      body);
  });

  const newText = el('textarea', { id: 'stuck', placeholder: "Describe what's blocking you this month.", maxlength: '1000' });
  const consent = el('input', { type: 'checkbox', id: 'consent' });
  const error = el('div', { class: 'error', role: 'alert' });
  const results = el('div');
  const submit = el('button', { class: 'btn primary', type: 'button' }, 'Submit update');

  submit.addEventListener('click', async () => {
    error.textContent = '';
    const pastBlockers = [];
    for (const [id, c] of choices) {
      if (!c.status) { error.textContent = 'Mark each blocker from past months as solved or still working on it.'; return; }
      if (c.status === 'solved' && c.text && !c.share) { error.textContent = 'Choose how to share each story you wrote.'; return; }
      pastBlockers.push({
        id, status: c.status,
        storyHelped: c.status === 'solved' ? c.storyHelped : undefined,
        story: c.status === 'solved' && c.text ? { text: c.text, share: c.share } : undefined,
      });
    }
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    try {
      const res = await api('/api/update', {
        method: 'POST',
        body: { pastBlockers, newBlocker: newText.value.trim() ? { text: newText.value.trim(), matchConsent: consent.checked } : undefined },
      });
      toast('Update submitted');
      await render('update');
      $('results')?.append(
        el('section', { class: 'card new' },
          el('span', { class: 'tag new' }, 'NEW'),
          el('h2', {}, 'Residents who\'ve been there'),
          res.matches === null
            ? el('p', { class: 'hint' }, newText.value.trim()
                ? 'You kept this month\'s blocker private, so no matching was done. You can turn matching on in My stories and blockers.'
                : 'No new blocker this month.')
            : [el('p', { class: 'hint' }, 'Stories from residents who solved something similar. Experience, not advice.'), matchesBlock(res.matches, state.me)]));
      $('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      error.textContent = e.message;
      submit.disabled = false;
      submit.textContent = 'Submit update';
    }
  });

  main.append(
    el('h1', {}, `${data.month} update`),
    el('section', { class: 'card dim', 'aria-label': 'Existing fields' },
      el('span', { class: 'tag existing' }, 'EXISTS TODAY'),
      el('h2', {}, 'Numbers this month'),
      el('div', { class: 'row' },
        el('div', {}, el('label', { class: 'field' }, 'Monthly revenue'), el('input', { type: 'text', value: '$4,200', disabled: true })),
        el('div', {}, el('label', { class: 'field' }, 'Paying customers'), el('input', { type: 'text', value: '3', disabled: true })))),
    el('section', { class: 'card new' },
      el('span', { class: 'tag new' }, 'NEW'),
      el('h2', {}, 'Blockers from past months: still stuck, or solved?'),
      el('p', { class: 'hint' }, 'Solved something? A few lines could save another resident weeks.'),
      pastList.length ? pastList : el('p', { class: 'empty' }, 'No open blockers from past months.')),
    el('section', { class: 'card' },
      el('span', { class: 'tag existing' }, 'EXISTS TODAY'),
      el('h2', {}, 'Key obstacles'),
      el('label', { class: 'field', for: 'stuck' }, 'Where are you stuck this month?'),
      newText,
      el('label', { class: 'check', for: 'consent' }, consent,
        el('span', {}, el('span', { class: 'tag new' }, 'NEW'), ' Use this privately to find residents who\'ve solved something similar. Nobody else sees what you write here.'))),
    el('div', { class: 'submit-row' }, submit),
    error,
    el('div', { id: 'results' }, results),
  );
}

// ---------- Page: My matches ----------
async function pageMatches(main) {
  const groups = await api('/api/my-matches');
  main.append(
    el('h1', {}, 'Residents who\'ve been there'),
    el('p', { class: 'sub' }, 'Matches for your open blockers where you turned matching on. Experience, not advice.'),
    ...(groups.length
      ? groups.map((g) => el('section', { class: 'card' },
          el('h2', {}, g.blocker.text),
          el('div', { class: 'meta' }, `Reported ${g.blocker.reported}`),
          matchesBlock(g.matches, state.me)))
      : [el('p', { class: 'empty' }, 'Turn on matching for a blocker in My stories and blockers to see stories here.')]),
  );
}

// ---------- Page: My stories and blockers ----------
async function pageMine(main) {
  const data = await api('/api/mine');

  const storyItems = data.stories.map((s) => {
    const select = el('select', { 'aria-label': `How "${s.problem}" is shared` },
      Object.entries(SHARE_LABELS).map(([v, l]) => el('option', { value: v, selected: v === s.share }, l)));
    select.addEventListener('change', async () => {
      try { await api(`/api/stories/${s.id}`, { method: 'PATCH', body: { share: select.value } }); toast('Sharing updated'); }
      catch (e) { toast(e.message); select.value = s.share; }
    });
    const del = el('button', { class: 'btn danger', type: 'button' }, 'Delete');
    const confirmRow = el('span', { hidden: true }, 'Delete this story for good? ',
      el('button', { class: 'btn danger', type: 'button', onclick: async () => {
        try { await api(`/api/stories/${s.id}`, { method: 'DELETE' }); toast('Story deleted'); render('mine'); }
        catch (e) { toast(e.message); }
      } }, 'Yes, delete'),
      ' ',
      el('button', { class: 'btn', type: 'button', onclick: () => { confirmRow.hidden = true; del.hidden = false; } }, 'Keep it'));
    del.addEventListener('click', () => { del.hidden = true; confirmRow.hidden = false; });
    return el('div', { class: 'item' },
      el('div', { class: 'item-title' }, `Solved: ${s.problem}`),
      el('div', { class: 'meta' }, `Shared ${s.shared}`),
      el('p', {}, s.text),
      el('div', { class: 'actions' }, select, del, confirmRow));
  });

  const blockerItems = data.blockers.map((b) => {
    const box = el('input', { type: 'checkbox', id: `match-${b.id}`, checked: b.matchConsent });
    box.addEventListener('change', async () => {
      try {
        await api(`/api/blockers/${b.id}`, { method: 'PATCH', body: { matchConsent: box.checked } });
        toast(box.checked ? 'Matching turned on' : 'Matching turned off');
      } catch (e) { toast(e.message); box.checked = !box.checked; }
    });
    return el('div', { class: 'item' },
      el('div', { class: 'item-title' }, b.text),
      el('div', { class: 'meta' }, `Reported ${b.reported} · private`),
      el('label', { class: 'check', for: `match-${b.id}` }, box, el('span', {}, 'Use this privately to find matching stories')));
  });

  main.append(
    el('h1', {}, 'My stories and blockers'),
    el('p', { class: 'sub' }, 'You decide how each one is used. Changes apply straight away.'),
    el('section', { class: 'card new' }, el('span', { class: 'tag new' }, 'NEW'), el('h2', {}, 'Stories I\'ve shared'),
      storyItems.length ? storyItems : el('p', { class: 'empty' }, 'You haven\'t written any stories yet. Mark a blocker solved in your monthly update to add one.')),
    el('section', { class: 'card new' }, el('span', { class: 'tag new' }, 'NEW'), el('h2', {}, 'My open blockers'),
      el('p', { class: 'hint' }, 'Never shown to anyone. Matching only uses the ones you tick.'),
      blockerItems.length ? blockerItems : el('p', { class: 'empty' }, 'No open blockers.')),
  );
}

// ---------- Page: Laura's summary ----------
// Change since last month, shown the same way in every tile: green when it improved,
// red when it got worse, muted grey when it didn't change.
function trendBadge(t) {
  if (t === undefined || t === null) {
    return el('span', { class: 'trend none', title: 'Not enough data to compare with last month' }, '–');
  }
  const sign = t.change > 0 ? '+' : t.change < 0 ? '−' : '±';
  const amount = Math.abs(t.change);
  const label = t.unit === 'points' ? `${sign}${amount} pts` : `${sign}${amount}`;
  const tone = t.good === null ? 'flat' : t.good ? 'up' : 'down';
  const words = t.good === null ? 'No change since last month' : `${t.good ? 'Better' : 'Worse'} than last month`;
  return el('span', { class: `trend ${tone}`, title: words, 'aria-label': `${label}, ${words.toLowerCase()}` }, label);
}

function tile(value, label, trend) {
  return el('div', { class: 'tile' },
    el('div', { class: 'tile-top' }, el('div', { class: 'num' }, value), trendBadge(trend)),
    el('div', { class: 'lbl' }, label));
}

// "This month": startups moving forward and startups worth a look, each with its reason.
function tickerSection(ticker, picker) {
  const open = (id) => { picker.value = String(id); picker.dispatchEvent(new Event('change')); };
  const column = (title, tone, arrow, list, empty) => el('div', { class: `ticker-col ${tone}` },
    el('h3', {}, el('span', { class: 'arrow', 'aria-hidden': 'true' }, arrow), title),
    list.items.length
      ? el('ul', {}, list.items.map((it) => el('li', {},
          el('span', { class: 'arrow', 'aria-hidden': 'true' }, arrow),
          el('button', { class: 'linklike', type: 'button', onclick: () => open(it.id) }, it.name),
          el('span', { class: 'reason' }, it.reason))))
      : el('p', { class: 'empty' }, empty),
    list.more ? el('p', { class: 'more' }, `and ${list.more} more`) : null);
  return el('section', { class: 'card ticker', 'aria-label': 'This month' },
    el('h2', {}, 'This month'),
    el('div', { class: 'ticker-cols' },
      column('Moving forward', 'up', '▲', ticker.movingForward, 'Nothing solved or shared yet this month.'),
      column('Worth a look', 'down', '▼', ticker.worthALook, 'Nothing open for long.')));
}

async function pageSummary(main) {
  const startups = await api('/api/startups');
  const chosen = state.summaryStartup || '';
  const s = await api(`/api/summary${chosen ? `?startup=${encodeURIComponent(chosen)}` : ''}`);
  const val = (v) => (v === null || v === undefined ? el('span', { class: 'hidden-val' }, 'hidden') : String(v));
  const t = s.trends || {};

  const picker = el('select', { id: 'startup-picker', 'aria-label': 'Startup to show' },
    el('option', { value: '' }, 'All startups'),
    startups.map((st) => el('option', { value: String(st.id), selected: String(st.id) === chosen }, `${st.name} (${st.people})`)));
  picker.addEventListener('change', () => { state.summaryStartup = picker.value; render('summary'); });

  main.append(
    el('div', { class: 'summary-head' },
      el('h1', {}, s.startup ? s.startup.name : 'How fast founders get unstuck'),
      el('label', { class: 'viewas' }, 'Show', picker)),
    el('div', { class: 'tiles' },
      tile(val(s.averageMonthsToSolve), 'Average months to solve a blocker', t.averageMonthsToSolve),
      tile(val(s.openNow), 'Blockers open now', t.openNow),
      tile(val(s.sharedStories), 'Stories shared with other residents', t.sharedStories),
      tile(val(s.reachedOut), 'Founders who reached out to a resident (last 6 months)', t.reachedOut),
      tile(s.storyHelped ? `${s.storyHelped.yes} of ${s.storyHelped.answered}` : val(null),
        "Solved blockers where a resident's story helped (last 6 months)", t.storyHelped)),
    s.ticker ? tickerSection(s.ticker, picker) : null,
    el('section', { class: 'card' },
      el('h2', {}, 'Blockers by month'),
      el('div', { class: 'table-wrap' },
        el('table', {},
          el('thead', {}, el('tr', {}, el('th', {}, 'Month'), el('th', { class: 'num' }, 'Reported'), el('th', { class: 'num' }, 'Solved'))),
          el('tbody', {}, s.months.map((m) => el('tr', {}, el('td', {}, m.month), el('td', { class: 'num' }, val(m.opened)), el('td', { class: 'num' }, val(m.solved)))))))),
  );

  if (!s.startup) return;

  const shareText = { email: 'Shared with email', anonymous: 'Shared anonymously', private: 'Private' };
  main.append(
    el('section', { class: 'card' },
      el('h2', {}, 'Team'),
      el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Role'), el('th', {}, 'Location'), el('th', {}, 'Comes into Volta'))),
        el('tbody', {}, s.team.map((p) => el('tr', {}, el('td', {}, p.name), el('td', {}, p.title || ''), el('td', {}, p.location || ''), el('td', {}, p.comes_in || ''))))))),
    el('section', { class: 'card' },
      el('h2', {}, 'Open blockers'),
      s.openBlockers.length
        ? el('div', { class: 'table-wrap' }, el('table', {},
            el('thead', {}, el('tr', {}, el('th', {}, 'Blocker'), el('th', {}, 'Who'), el('th', {}, 'Reported'), el('th', { class: 'num' }, 'Months open'), el('th', {}, 'Matching'))),
            el('tbody', {}, s.openBlockers.map((b) => el('tr', {},
              el('td', {}, b.text), el('td', {}, b.person), el('td', {}, b.reported), el('td', { class: 'num' }, String(b.monthsOpen)), el('td', {}, b.matching ? 'On' : 'Off'))))))
        : el('p', { class: 'empty' }, 'No open blockers.')),
    el('section', { class: 'card' },
      el('h2', {}, 'Solved blockers'),
      s.solvedBlockers.length
        ? el('div', { class: 'table-wrap' }, el('table', {},
            el('thead', {}, el('tr', {}, el('th', {}, 'Blocker'), el('th', {}, 'Who'), el('th', {}, 'Solved'), el('th', { class: 'num' }, 'Months to solve'), el('th', {}, 'A story helped?'))),
            el('tbody', {}, s.solvedBlockers.map((b) => el('tr', {},
              el('td', {}, b.text), el('td', {}, b.person), el('td', {}, b.solved), el('td', { class: 'num' }, String(b.monthsToSolve)),
              el('td', {}, b.storyHelped === null ? 'Not answered' : b.storyHelped ? 'Yes' : 'No'))))))
        : el('p', { class: 'empty' }, 'No solved blockers yet.')),
    el('section', { class: 'card' },
      el('h2', {}, 'Stories'),
      s.stories.length
        ? el('div', { class: 'table-wrap' }, el('table', {},
            el('thead', {}, el('tr', {}, el('th', {}, 'Problem it solved'), el('th', {}, 'Who'), el('th', {}, 'Sharing'), el('th', {}, 'Shared'))),
            el('tbody', {}, s.stories.map((st) => el('tr', {},
              el('td', {}, st.problem), el('td', {}, st.person), el('td', {}, shareText[st.share]), el('td', {}, st.shared))))))
        : el('p', { class: 'empty' }, 'No stories yet.')),
  );
}

// ---------- Navigation ----------
const PAGES = {
  update: { label: 'Monthly update', role: 'founder', render: pageUpdate },
  matches: { label: 'My matches', role: 'founder', render: pageMatches },
  mine: { label: 'My stories and blockers', role: 'founder', render: pageMine },
  summary: { label: 'Unstuck summary', role: 'admin', render: pageSummary },
};

function renderTabs() {
  const tabs = $('tabs');
  const pages = Object.entries(PAGES).filter(([, p]) => p.role === state.me.role);
  // With only one page (Laura), there's nothing to switch between, so hide the bar.
  tabs.hidden = pages.length < 2;
  tabs.replaceChildren(...pages.map(([key, p]) =>
    el('button', { type: 'button', 'aria-current': key === state.page ? 'page' : null, onclick: () => render(key) }, p.label)));
}

async function render(page) {
  state.page = page;
  renderTabs();
  const main = $('main');
  main.replaceChildren(el('p', { class: 'empty' }, 'Loading…'));
  const fresh = el('div');
  try {
    await PAGES[page].render(fresh);
    main.replaceChildren(...fresh.childNodes);
  } catch (e) {
    main.replaceChildren(el('p', { class: 'error' }, e.message));
  }
}

async function switchPerson(id) {
  state.me = state.people.find((p) => p.id === Number(id)) || state.people[0];
  store('viewas', String(state.me.id));
  $('viewas').value = String(state.me.id);
  await render(state.me.role === 'admin' ? 'summary' : 'update');
}

async function start() {
  state.people = await (await fetch('/api/people')).json();
  const select = $('viewas');
  select.replaceChildren(...state.people.map((p) =>
    el('option', { value: String(p.id) }, p.role === 'admin' ? `${p.name} (admin)` : `${p.name} · ${p.startup} · ${p.location}`)));
  select.addEventListener('change', () => switchPerson(select.value));
  await switchPerson(recall('viewas') || state.people.find((p) => p.role === 'founder')?.id);
}

start().catch((e) => { $('main').replaceChildren(el('p', { class: 'error' }, `Could not load the demo: ${e.message}`)); });
