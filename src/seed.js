/**
 * First-run content: a complete, fictional sample resume so the app opens with
 * something realistic to edit instead of a blank page. Every name, employer,
 * address and contact detail here is invented; nothing in this file belongs to
 * a real person.
 */
export function seedResume() {
  const data = {
    basics: {
      name: 'Alex Morgan',
      headline: 'Data Analyst · B.Sc. Information Systems',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 013-4827',
      location: 'Portland, Oregon',
      website: 'https://alexmorgan.example.com',
      photo: '',
      links: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/example-profile' },
        { label: 'GitHub', url: 'https://github.com/example' },
      ],
    },
    summary:
      'Data analyst with four years of experience turning messy operational data into decisions teams actually act on. I work in SQL, Python (Pandas, scikit-learn) and Power BI, and I care as much about the story a dashboard tells as the query behind it. Comfortable owning a reporting pipeline end to end — from warehouse modelling to the weekly review.',
    experience: [
      {
        id: 'exp-northwind',
        role: 'Data Analyst',
        company: 'Northwind Analytics',
        location: 'Portland, OR',
        start: 'Mar 2024',
        end: '',
        current: true,
        bullets: [
          'Own the weekly revenue and retention reporting pack used by the leadership team, cutting manual preparation from two days to under an hour.',
          'Built 14 Power BI dashboards over a shared semantic model, replacing duplicated spreadsheet reports across three departments.',
          'Modelled 40+ dbt transformations on top of the warehouse, adding tests that caught data-quality regressions before they reached dashboards.',
        ],
      },
      {
        id: 'exp-brightline',
        role: 'Junior Data Analyst',
        company: 'Brightline Retail',
        location: 'Remote',
        start: 'Jun 2022',
        end: 'Feb 2024',
        current: false,
        bullets: [
          'Analysed basket and promotion data across 120 stores to identify discount patterns that were quietly eroding margin.',
          'Automated a daily SQL refresh and exception report, giving merchandising same-day visibility into stockouts.',
          'Partnered with marketing on A/B tests, defining success metrics and sizing results before campaigns were rolled out.',
        ],
      },
      {
        id: 'exp-cascade',
        role: 'Reporting Intern',
        company: 'Cascade Logistics',
        location: 'Portland, OR',
        start: 'Jan 2022',
        end: 'May 2022',
        current: false,
        bullets: [
          'Rebuilt a shipment-tracking workbook in Excel with pivot summaries, reducing a weekly manual reconciliation to a refresh.',
          'Documented the reporting definitions used by the operations team so metrics stopped being redefined per meeting.',
        ],
      },
    ],
    projects: [
      {
        id: 'prj-sales-dashboard',
        name: 'Sales Performance Dashboard',
        tech: 'Power BI, DAX',
        url: '',
        start: 'Nov 2025',
        end: 'Dec 2025',
        bullets: [
          'End-to-end BI model over a synthetic retail dataset: star schema, DAX measures and drill-through pages.',
          'KPI cards for revenue, margin and basket size with filters for region, category and channel.',
        ],
      },
      {
        id: 'prj-churn',
        name: 'Customer Churn Model',
        tech: 'Python, scikit-learn',
        url: '',
        start: 'Jun 2025',
        end: 'Aug 2025',
        bullets: [
          'Compared logistic regression and gradient boosting on subscription data; tuned thresholds against the cost of a false negative.',
          'Packaged the pipeline with feature importance output so retention teams can see why an account is flagged.',
        ],
      },
      {
        id: 'prj-forecast',
        name: 'Inventory Forecasting Notebook',
        tech: 'Python, Pandas, statsmodels',
        url: '',
        start: 'Feb 2025',
        end: 'Apr 2025',
        bullets: [
          'Seasonal baseline forecasts for 60 SKUs, backtested against twelve months of history.',
          'Documented where a simple model beat a complex one, and why that mattered for the store team.',
        ],
      },
      {
        id: 'prj-budget',
        name: 'Open Budget Explorer',
        tech: 'React, D3',
        url: '',
        start: 'Sep 2024',
        end: 'Nov 2024',
        bullets: [
          'Interactive treemap of published municipal budget data with search, breadcrumb drill-down and CSV export.',
          'Handled 18k rows client-side with a virtualised list so filtering stays responsive on a laptop.',
        ],
      },
    ],
    education: [
      {
        id: 'edu-bsc',
        degree: 'B.Sc., Information Systems',
        school: 'State University',
        location: 'Portland, OR',
        start: '2018',
        end: '2022',
        details: 'GPA 3.7/4.0',
      },
      {
        id: 'edu-assoc',
        degree: 'Associate of Science, Computer Science',
        school: 'Riverside Community College',
        location: '',
        start: '2016',
        end: '2018',
        details: 'Dean’s List',
      },
    ],
    skills: [
      { id: 'sk-data', group: 'Data & Analytics', level: 5, items: ['SQL', 'Power BI', 'Tableau', 'Pandas', 'Excel', 'DAX'] },
      { id: 'sk-lang', group: 'Languages', level: 4, items: ['Python', 'R', 'JavaScript', 'Bash'] },
      { id: 'sk-eng', group: 'Data Engineering', level: 4, items: ['dbt', 'PostgreSQL', 'Airflow', 'Git', 'Docker'] },
      { id: 'sk-core', group: 'Foundations', level: 3, items: ['Statistics', 'Data Modelling', 'A/B Testing', 'Data Storytelling'] },
    ],
    certifications: [
      {
        id: 'cert-google',
        name: 'Google Data Analytics Professional Certificate',
        issuer: 'Coursera',
        date: 'Dec 2023',
        url: '',
      },
      {
        id: 'cert-msft',
        name: 'Power BI Data Analyst Associate (PL-300)',
        issuer: 'Microsoft',
        date: 'Aug 2024',
        url: '',
      },
      {
        id: 'cert-dbt',
        name: 'dbt Fundamentals',
        issuer: 'dbt Labs',
        date: 'Feb 2025',
        url: '',
      },
    ],
    languages: [
      { id: 'lang-en', name: 'English', level: 'Native' },
      { id: 'lang-es', name: 'Spanish', level: 'Professional' },
      { id: 'lang-fr', name: 'French', level: 'Basic' },
    ],
    references: [
      {
        id: 'ref-1',
        name: 'Jordan Lee',
        role: 'Analytics Manager',
        company: 'Northwind Analytics',
        contact: 'jordan.lee@example.com',
      },
      {
        id: 'ref-2',
        name: 'Priya Raman',
        role: 'Senior Analyst',
        company: 'Brightline Retail',
        contact: 'priya.raman@example.com',
      },
    ],
  };

  const settings = {
    template: 'modern',
    accent: '#0f766e',
    font: 'sans',
    fontSize: 10.5,
    density: 'regular',
    pageSize: 'a4',
    sectionOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'languages', 'references'],
    hiddenSections: [],
  };

  return { title: 'Alex Morgan — Data Analyst', data, settings };
}
