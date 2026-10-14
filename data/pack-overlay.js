// Made-up details the data pack doesn't include, keyed by name.
// Everything about each person (company, role, location, "Stuck on", "Lived through")
// comes from Volta-demo-data-pack.csv; this file only adds:
//   helped:  a short invented "what helped" line for their "Lived through" story
//   share:   how they chose to share that story ('email' | 'anonymous' | 'private')
//   consent: whether they turned on matching for their "Stuck on" blocker
//   livedAgo / stuckAgo: invented months, so Laura's summary has a history
// The demo hero (see DEMO_HERO) is seeded differently; see scripts/seed.js.

export const DEMO_HERO = 'Jordan Gallant';

export const overlay = {
  'Ana Lund':          { share: 'email',     consent: true,  livedAgo: 5, stuckAgo: 1,
    helped: 'We hired a final-year computer science student part-time and paired them with a freelance senior developer for code reviews two hours a week.' },
  'Theo Marchand':     { share: 'email',     consent: true,  livedAgo: 0, stuckAgo: 1,
    helped: 'We used the province\'s privacy impact assessment template, answered every section in plain language, and booked a one-hour review with a privacy lawyer before submitting.' },
  'Mira Kowalczyk':    { share: 'email',     consent: false, livedAgo: 6, stuckAgo: 2,
    helped: 'We ran US and Canadian investor meetings in the same three-week window and shared one data room. Having a Canadian lead first made the US investors move faster.' },
  'Desmond Achebe':    { share: 'email',     consent: true,  livedAgo: 7, stuckAgo: 1,
    helped: 'As the first sales hire I asked for a base salary plus commission paid on cash collected, and I wrote the sales playbook in my first 60 days before we hired anyone else.' },
  'Leila Rahimi':      { share: 'anonymous', consent: true,  livedAgo: 5, stuckAgo: 2,
    helped: 'We hired salespeople two at a time so they could learn from each other, and gave each one a single region and a 90-day ramp target.' },
  'Colm Byrne':        { share: 'email',     consent: true,  livedAgo: 3, stuckAgo: 1,
    helped: 'We trialled two HR and payroll platforms for a week each with our part-timers. The cheaper one could not handle three provinces, so we paid a little more. Ask for the startup discount.' },
  'Jordan Gallant':    { share: 'email',     consent: true,  livedAgo: 1, stuckAgo: 0,
    helped: 'We stopped calling growers one by one and presented at the co-op\'s quarterly meeting. One trial grower vouching for us did more than any sales call.' },
  'Anjali Raman':      { share: 'email',     consent: true,  livedAgo: 4, stuckAgo: 1,
    helped: 'We found a clinical champion inside the health authority first, then filled in their vendor security questionnaire before procurement asked for it.' },
  'Owen MacIsaac':     { share: 'anonymous', consent: true,  livedAgo: 8, stuckAgo: 1,
    helped: 'Years of quoting jobs by hand taught me what contractors actually check: materials prices and the subcontractor list. I would start any tool there.' },
  'Luc Thibodeau':     { share: 'email',     consent: true,  livedAgo: 6, stuckAgo: 2,
    helped: 'The utility\'s procurement took 12 months, so we offered a small paid pilot through their innovation team, which used a faster approval path.' },
  'Grace Oduya':       { share: 'email',     consent: true,  livedAgo: 4, stuckAgo: 1,
    helped: 'We posted short videos of kids reading with the app in parent groups and asked every early family to invite one friend. That built the waitlist without paid ads.' },
  'Rosalie Cormier':   { share: 'email',     consent: false, livedAgo: 5, stuckAgo: 2,
    helped: 'We ran three small trial batches with the co-packer before signing, and kept our commercial kitchen lease for two extra months as a backup.' },
  'Arjun Sethi':       { share: 'email',     consent: true,  livedAgo: 4, stuckAgo: 1,
    helped: 'We picked a machine shop that had built marine parts before and paid for a two-day design review up front. It saved two rebuilds.' },
  'Tomasz Nowak':      { share: 'anonymous', consent: true,  livedAgo: 3, stuckAgo: 1,
    helped: 'We offered two months free for switching to an annual contract and moved half our customers in one quarter.' },
  'Leah Morin':        { share: 'email',     consent: true,  livedAgo: 6, stuckAgo: 0,
    helped: 'For IRAP, talk to an industrial technology advisor before writing anything. They tell you which project to put forward. Keep a simple log of experiments from day one for SR&ED.' },
  'Siobhan Walsh':     { share: 'email',     consent: true,  livedAgo: 5, stuckAgo: 0,
    helped: 'Engineering firms buy from people they have worked with, so we offered a free data report on one of their past projects. Two of five became customers.' },
  'Felix Arsenault':   { share: 'anonymous', consent: true,  livedAgo: 7, stuckAgo: 1,
    helped: 'I kept my job for six months while testing the idea on weekends, and quit only after a university partner agreed to run lab tests with us.' },
  'Imani Brooks':      { share: 'private',   consent: true,  livedAgo: 9, stuckAgo: 1,
    helped: 'Private note: years of night shifts showed me what nurses need.' },
  'Kiran Desai':       { share: 'email',     consent: true,  livedAgo: 0, stuckAgo: 1,
    helped: 'We set a firm closing date, asked our lead investor to make introductions, and ran all meetings in two weeks. The deadline did most of the work.' },
  'Josie Langille':    { share: 'email',     consent: true,  livedAgo: 6, stuckAgo: 2,
    helped: 'We built an email list of 1,500 people before the campaign and launched to them first. Most of the money came in the first 48 hours.' },
  'Ewan Reid':         { share: 'anonymous', consent: true,  livedAgo: 0, stuckAgo: 1,
    helped: 'We agreed one success measure with the fishing company before the pilot started and charged a small fee. Paying made them take it seriously.' },
  'Sofia Martel':      { share: 'email',     consent: true,  livedAgo: 4, stuckAgo: 1,
    helped: 'We used a registered agent to set up a Delaware company and our payment provider\'s tax tool for US sales tax. Our accountant checks it every quarter.' },
  'Mateo Ruiz':        { share: 'email',     consent: false, livedAgo: 5, stuckAgo: 2,
    helped: 'We launched a demo on Steam three months early to collect wishlists, which decided our launch date and price.' },
  'Amara Nwosu':       { share: 'private',   consent: true,  livedAgo: 4, stuckAgo: 1,
    helped: 'Private note: tested app store screenshots every week.' },
};

// The hero's open blocker from last month: their "Lived through" item, so they can mark it
// solved during the demo and share what helped. Their "Stuck on" item is typed live.
export const HERO_PAST_BLOCKER_AGO = 1;
