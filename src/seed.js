/**
 * First-run content. Built from the existing DOCX resume and portfolio in
 * ~/Documents so the app opens with real, editable content instead of a
 * lorem-ipsum placeholder.
 */
export function seedResume() {
  const data = {
    basics: {
      name: 'Jagana Ritvik',
      headline: 'Data Analyst · B.Tech Computer Science & Engineering',
      email: 'ritvikjagana655@gmail.com',
      phone: '+91 88853 60071',
      location: 'Visakhapatnam, Andhra Pradesh, India',
      website: 'https://portfolio-jagana-ritvik.vercel.app',
      photo: '',
      links: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/jagana-ritvik-a755113aa/' },
        { label: 'GitHub', url: 'https://github.com/pu7nit' },
      ],
    },
    summary:
      'Data analyst with a B.Tech in Computer Science and hands-on experience cleaning, modelling and visualising real-world datasets. I work in SQL, Python (Pandas, NumPy, Matplotlib), Power BI and Excel, and I build the tools I need — from a MERN attendance system to an interactive Power BI dashboard. Looking for a role where messy data becomes decisions.',
    experience: [
      {
        id: 'exp-cognifyz',
        role: 'Junior Data Analyst',
        company: 'Cognifyz Technologies',
        location: 'Remote',
        start: 'Mar 2026',
        end: '',
        current: true,
        bullets: [
          'Cleaned, transformed and analysed raw datasets to surface patterns used in data-driven decisions.',
          'Wrote SQL queries for extraction and contributed to recurring reports and dashboard deliverables.',
          'Used Python and Excel for data manipulation, feature engineering and insight generation.',
        ],
      },
      {
        id: 'exp-codtech',
        role: 'Front End Development Intern',
        company: 'Codtech PVT LTD',
        location: 'Virtual',
        start: 'May 2025',
        end: 'Jun 2025',
        current: false,
        bullets: [
          'Built responsive web interfaces and led UI/UX design reviews.',
          'Applied advanced CSS layout techniques to match design specs across screen sizes.',
        ],
      },
      {
        id: 'exp-skittles',
        role: 'Content Writing Intern',
        company: 'Skittles News',
        location: 'Virtual',
        start: 'Mar 2023',
        end: 'Jul 2023',
        current: false,
        bullets: [
          'Wrote sports articles across NBA, MLB and NFL coverage.',
          'Sustained a four-articles-per-day publishing cadence through the internship.',
        ],
      },
    ],
    projects: [
      {
        id: 'prj-dashboard',
        name: 'Smartphone Usage & Productivity Dashboard',
        tech: 'Power BI, DAX',
        url: 'https://github.com/pu7nit/Smartphone-Usage-Productivity-Insights-Dashboard',
        start: 'Nov 2025',
        end: 'Dec 2025',
        bullets: [
          'Interactive Power BI dashboard relating smartphone usage to productivity, stress and lifestyle patterns.',
          'KPI cards plus interactive filters for segment-level exploration.',
        ],
      },
      {
        id: 'prj-securevault',
        name: 'SecureVault — Password Manager',
        tech: 'Web app, Security',
        url: '',
        start: 'Jun 2025',
        end: 'Aug 2025',
        bullets: [
          'Personal password vault with a generator, security dashboard and a modern interface.',
          'Designed around safe storage and quick retrieval of credentials.',
        ],
      },
      {
        id: 'prj-pixo',
        name: 'Pixo.io — Image Compressor',
        tech: 'HTML5, CSS3, JavaScript',
        url: 'https://pixo-r.vercel.app',
        start: 'May 2025',
        end: 'Jun 2025',
        bullets: [
          'Browser-based compressor for JPEG, PNG and WebP that cuts file size with minimal visible quality loss.',
          'Zero-install tool aimed at faster page loads and smaller asset bundles for developers.',
        ],
      },
      {
        id: 'prj-attendance',
        name: 'Attendance Management System',
        tech: 'MERN (MongoDB, Express, React, Node.js)',
        url: 'https://github.com/pu7nit/attendance_management_system',
        start: 'Apr 2025',
        end: 'May 2025',
        bullets: [
          'Full-stack app built end to end: Express/Node API for business logic and MongoDB for persistence.',
          'React admin interface for log-in, user management and daily attendance recording.',
        ],
      },
    ],
    education: [
      {
        id: 'edu-btech',
        degree: 'B.Tech, Computer Science & Engineering',
        school: 'Anil Neerukonda Institute of Technology & Sciences',
        location: 'Visakhapatnam',
        start: '2023',
        end: 'Present',
        details: 'CGPA 7.0',
      },
      {
        id: 'edu-xii',
        degree: 'Senior Secondary (XII), Science',
        school: 'Sri Aakash Junior College',
        location: '',
        start: '2023',
        end: '',
        details: '94.0%',
      },
    ],
    skills: [
      { id: 'sk-data', group: 'Data & Analytics', level: 5, items: ['SQL', 'Power BI', 'Pandas', 'NumPy', 'Matplotlib', 'MS Excel', 'DAX'] },
      { id: 'sk-lang', group: 'Languages', level: 4, items: ['Python', 'Java', 'JavaScript', 'C'] },
      { id: 'sk-web', group: 'Web & Tools', level: 4, items: ['React', 'Node.js', 'Express', 'MongoDB', 'Git & GitHub'] },
      { id: 'sk-core', group: 'Foundations', level: 3, items: ['DBMS', 'DSA', 'Machine Learning', 'Operating Systems'] },
    ],
    certifications: [
      {
        id: 'cert-ai',
        name: 'Google AI Essentials Specialization',
        issuer: 'Coursera',
        date: 'Feb 2026',
        url: '',
      },
      {
        id: 'cert-da',
        name: 'Google Data Analytics Professional Certificate',
        issuer: 'Coursera',
        date: 'Dec 2025',
        url: '',
      },
      {
        id: 'cert-kotlin',
        name: 'Android Development with Kotlin',
        issuer: 'GeeksforGeeks',
        date: '',
        url: '',
      },
    ],
    languages: [
      { id: 'lang-en', name: 'English', level: 'Professional' },
      { id: 'lang-te', name: 'Telugu', level: 'Native' },
      { id: 'lang-hi', name: 'Hindi', level: 'Fluent' },
    ],
    references: [],
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

  return { title: 'Jagana Ritvik — Data Analyst', data, settings };
}
