// Test blockers for the matching, based on the Volta data pack.
// expect: the story (by person key) that should match, a list of acceptable stories,
// or null when no shared story fits. Many are reworded on purpose, to test matching by meaning.

export const evalPairs = [
  // "Stuck on" items from the data pack
  { blocker: 'Applying for a first IRAP grant', expect: 'leah-morin' },
  { blocker: 'Applying for first grants: IRAP and provincial funding', expect: 'leah-morin' },
  { blocker: 'Choosing an HR and payroll platform (still on spreadsheets at 14 staff)', expect: 'colm-byrne' },
  { blocker: 'Choosing an HR and payroll platform that handles US staff', expect: ['colm-byrne', 'sofia-martel'] },
  { blocker: 'First sales hire: commission or salary', expect: 'desmond-achebe' },
  { blocker: 'First sales hire: who to hire and how to pay them', expect: ['desmond-achebe', 'leila-rahimi'] },
  { blocker: 'Whether to quit his job and go full-time', expect: 'felix-arsenault' },
  { blocker: 'Security questionnaires from larger clinic groups', expect: ['anjali-raman', 'theo-marchand'] },
  { blocker: 'Enterprise procurement: security review and legal at a large insurer', expect: ['anjali-raman', 'theo-marchand', 'luc-thibodeau'] },
  { blocker: 'Enterprise procurement with port authorities', expect: ['anjali-raman', 'luc-thibodeau'] },
  { blocker: 'Enterprise procurement: school board RFPs and approvals', expect: ['anjali-raman', 'luc-thibodeau'] },
  { blocker: 'US expansion: hiring and paying staff in the US', expect: 'sofia-martel' },
  { blocker: 'US expansion: cross-border tax and contracts', expect: 'sofia-martel' },
  { blocker: 'Fundraising: a first institutional round after growing on revenue', expect: ['mira-kowalczyk', 'kiran-desai'] },
  { blocker: 'Fundraising: explaining hardware timelines to pre-seed investors', expect: ['mira-kowalczyk', 'kiran-desai'] },
  { blocker: 'Fundraising: writing investor updates and finding a lead investor', expect: ['mira-kowalczyk', 'kiran-desai'] },

  // Reworded versions
  { blocker: 'Which payroll software should a 15-person team use?', expect: 'colm-byrne' },
  { blocker: 'How do we hire our first developer without much money?', expect: 'ana-lund' },
  { blocker: 'Getting our first engineer on a tight budget', expect: 'ana-lund' },
  { blocker: 'Writing a privacy impact assessment for health software', expect: 'theo-marchand' },
  { blocker: 'Raising a Series A with US investors', expect: 'mira-kowalczyk' },
  { blocker: 'Should our first salesperson be paid on commission?', expect: 'desmond-achebe' },
  { blocker: 'Hiring several salespeople at once', expect: ['leila-rahimi', 'desmond-achebe'] },
  { blocker: 'Moving production to a co-packer', expect: 'rosalie-cormier' },
  { blocker: 'Getting a hardware prototype built by a local shop', expect: 'arjun-sethi' },
  { blocker: 'Convincing customers to switch from monthly to annual plans', expect: 'tomasz-nowak' },
  { blocker: 'Claiming SR&ED tax credits', expect: 'leah-morin' },
  { blocker: 'Selling to engineering consultancies', expect: 'siobhan-walsh' },
  { blocker: 'Running a crowdfunding campaign', expect: 'josie-langille' },
  { blocker: 'Getting real value out of a pilot with a big company', expect: 'ewan-reid' },
  { blocker: 'Setting up a US subsidiary', expect: 'sofia-martel' },
  { blocker: 'Launching our game on Steam', expect: 'mateo-ruiz' },
  { blocker: 'Building a waitlist before launch without paid ads', expect: 'grace-oduya' },
  { blocker: 'Selling to a utility company', expect: 'luc-thibodeau' },
  { blocker: 'Getting through health authority procurement', expect: 'anjali-raman' },
  { blocker: 'Closing our seed round quickly', expect: 'kiran-desai' },
  { blocker: 'Leaving a corporate job to start a company', expect: 'felix-arsenault' },

  // No shared story fits these
  { blocker: 'Finding an affordable office lease in Moncton', expect: null },
  { blocker: 'Registering a trademark for our brand name', expect: null },
  { blocker: 'Translating our app into French', expect: null },
  { blocker: 'Cash flow before large grocery orders', expect: null },
  { blocker: 'Revenue gaps between game releases', expect: null },
  { blocker: 'Choosing a CRM for our sales team', expect: null },
];
