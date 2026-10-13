// 40 invented blockers for testing the matching.
// expect: the story key that should match (see data/sample.js), or null when no shared story fits.
// Most are worded differently from the story on purpose, to test matching by meaning.

export const evalPairs = [
  // Hiring
  { blocker: "We can't find developers willing to work in Halifax", expect: 'first-engineer' },
  { blocker: 'Recruiting our first software developer', expect: 'first-engineer' },
  { blocker: 'Our interview process for engineers takes too long', expect: 'first-engineer' },
  { blocker: 'Should we use a recruitment agency to find a developer?', expect: 'recruiter-vs-referrals' },
  { blocker: 'Agency fees for hiring are too high', expect: 'recruiter-vs-referrals' },
  { blocker: "Candidates don't understand what the role involves", expect: 'scope-the-role' },
  // Tools and costs
  { blocker: 'Which payroll software should a small team use?', expect: 'hr-payroll' },
  { blocker: 'Paying contractors and part-time staff is a mess', expect: 'hr-payroll' },
  { blocker: 'Our AWS bill doubled this quarter', expect: 'cloud-costs' },
  { blocker: 'Server costs are eating our runway', expect: 'cloud-costs' },
  // Pricing and sales
  { blocker: 'How much should we charge for a pilot project?', expect: 'pilot-pricing' },
  { blocker: 'Customers want a free trial before committing', expect: 'pilot-pricing' },
  { blocker: 'Not sure how to structure our pricing plans', expect: 'saas-tiers' },
  { blocker: 'Deciding between per-seat and usage-based pricing', expect: 'saas-tiers' },
  { blocker: "We haven't made a single sale yet", expect: 'first-paying-customer' },
  { blocker: 'Struggling to land our first customer', expect: 'first-paying-customer' },
  { blocker: 'Selling our software to a health authority', expect: 'hospital-procurement' },
  { blocker: 'The hospital vendor approval process is slow', expect: 'hospital-procurement' },
  { blocker: 'Bidding on a provincial government contract', expect: 'government-rfp' },
  { blocker: 'We keep losing public sector tenders', expect: 'government-rfp' },
  // Funding
  { blocker: 'Raising our first round of funding', expect: 'pre-seed-angels' },
  { blocker: 'Angel investors are not replying to our emails', expect: 'pre-seed-angels' },
  { blocker: 'Getting tax credits for our R&D spending', expect: 'sred-credits' },
  { blocker: 'Applying for government innovation funding', expect: 'irap-grant' },
  // Team
  { blocker: 'My co-founder and I disagree about ownership', expect: 'cofounder-equity' },
  { blocker: 'How should we split shares between founders?', expect: 'cofounder-equity' },
  // Operations and compliance
  { blocker: 'Our finances are a mess in spreadsheets', expect: 'bookkeeping' },
  { blocker: 'Getting ready for year-end with our accountant', expect: 'bookkeeping' },
  { blocker: 'Does anyone actually need what we are building?', expect: 'customer-interviews' },
  { blocker: 'How do we validate product-market fit?', expect: 'customer-interviews' },
  { blocker: 'Growing our audience before launch', expect: 'linkedin-content' },
  { blocker: 'Apple rejected our app update', expect: 'app-store-rejection' },
  { blocker: 'What privacy laws apply to patient information?', expect: 'health-privacy' },
  { blocker: 'Collecting sales tax from American customers', expect: 'us-sales-tax' },
  // No shared story fits these (the burnout and contractor stories are private and must never match)
  { blocker: 'Finding an affordable office lease in Moncton', expect: null },
  { blocker: 'Registering a trademark for our brand name', expect: null },
  { blocker: 'Translating our app into French', expect: null },
  { blocker: 'Choosing a CRM for our sales team', expect: null },
  { blocker: 'I am exhausted and working every weekend', expect: null },
  { blocker: 'Getting our product certified for export to Europe', expect: null },
];
