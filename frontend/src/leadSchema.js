// The lead review form's sections and dropdown choices, mirroring the
// production Zoho Leads layout (Individual and Company). The same lists live in
// backend/app/services/lead_schema.py - keep the two in sync.

export const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
export const TYPES_OF_CUSTOMER = ['Individual', 'Company'];
export const LEAD_SOURCES = [
  'Associations', 'Channel Partnership', 'Cold Call', 'Customer Referral',
  'Employee Referral', 'External Referral', 'Facebook', 'Field Activity',
  'Flyer', 'Hoardings', 'Partner', 'Sunpack Board', 'Trade Show',
];
export const LEAD_STATUSES = [
  'New', 'In-Progress', 'Enquiry', 'Pre Qualified', 'Not Qualified',
  'Junk', 'Cold', 'Cancelled',
];
export const OCCUPATIONS = ['Home Maker', 'Pensioner', 'Salaried', 'Self Employed', 'Student', 'Un-Employed'];
export const COMPANY_TYPES = [
  'General Partnership', 'Limited Liability Partnership', 'One Person Company',
  'Private Limited Company', 'Section 8 Company', 'Sole Proprietorship',
];
export const MSME_OPTIONS = ['Yes', 'No'];
export const LOAN_TYPES = [
  'Business Loan', 'Commercial Loan - Commercial Land / Property',
  'Commercial Real Estate Loan', 'Home Loan - Balance + Top Up',
  'Home Loan - Balance Transfer', 'Home Loan - Construction',
  'Home Loan - Extension/ Improvement', 'Home Loan - New Purchase',
  'Home Loan - Plot', 'Home Loan - Short Term Bridge', 'Home Loan - Top Up',
  'Loan Against Property', 'MSME - BG', 'MSME - CC', 'MSME - CGTMSE',
  'MSME - LAP', 'MSME - LC', 'MSME - OD / Working Capital', 'MSME - Term Loan',
  'Other Loan', 'Personal Loan', 'Vehicle Loan',
];
export const PROPERTY_TYPES = [
  'Commercial Property', 'Farm Lands', 'Fund Based', 'Residential Cum Commercial',
  'Residential-Let Out', 'Residential-Self Occupancy', 'Stock & Debtors',
  'Unsecure', 'Vacant Land-Commercial', 'Vacant Land-Residential', 'Vehicle',
];

// kind: text | select | amount | date | textarea | record_select | name (first name + title dropdown)
const text = (key, label, extra = {}) => ({ key, label, kind: 'text', ...extra });
const select = (key, label, options, extra = {}) => ({ key, label, kind: 'select', options, ...extra });
// Dropdown of every current record in that field's Zoho module (Users, Field
// Sales Operators, Vendors, Campaigns) - can't be typo'd since it only ever holds a real value.
const recordSelect = (key, label) => ({ key, label, kind: 'record_select' });

const basicInfo = {
  title: 'Basic Info',
  fields: [
    select('Type_of_Customer', 'Type of Customer', TYPES_OF_CUSTOMER, { blank: false }),
    recordSelect('Lead_Owner', 'Lead Owner'),
    recordSelect('Assigned_To', 'Assigned To'),
    recordSelect('Campaign_Source', 'Campaign Source'),
    select('Lead_Source', 'Lead Source', LEAD_SOURCES),
    select('Lead_Status', 'Lead Status', LEAD_STATUSES, { blank: false }),
    recordSelect('Referred_By', 'Referred By'),
    text('Last_Name', 'Last Name', { required: true }),
  ],
};

const individual = {
  title: 'Individual',
  fields: [
    { key: 'First_Name', label: 'First Name', kind: 'name', titleKey: 'Salutation', titleOptions: SALUTATIONS },
    text('Email', 'Email'),
    { key: 'Date_of_Birth', label: 'Date of Birth', kind: 'date' },
    text('Mobile', 'Mobile'),
    text('PAN', 'PAN'),
    select('Occupation', 'Occupation', OCCUPATIONS),
    text('Aadhar_No', 'Aadhar No'),
    text('Profession', 'Profession'),
    { key: 'Monthly_Income', label: 'Monthly Income', kind: 'amount' },
    text('Organisation', 'Organisation'),
  ],
};

const company = {
  title: 'Company',
  fields: [
    text('Company_Name', 'Company Name'),
    select('Company_Type', 'Company Type', COMPANY_TYPES),
    text('Company_PAN', 'Company PAN'),
    { key: 'Date_of_Incorporation', label: 'Date of Incorporation', kind: 'date' },
    text('POC_Name', 'POC Name'),
    text('POC_Contact_Mobile', 'POC Contact Mobile'),
    text('POC_Designation', 'POC Designation'),
    text('POC_Email_Id', 'POC Email id'),
    select('MSME_Registered', 'MSME Registered', MSME_OPTIONS),
    text('Company_GST', 'Company GST'),
    { key: 'Annual_Turnover', label: 'Annual Turnover', kind: 'amount' },
    text('Company_Industry', 'Company Industry'),
  ],
};

const address = {
  title: 'Address Information',
  fields: [
    text('Street', 'Street'),
    text('City', 'City'),
    text('State', 'State'),
    text('ZIP', 'ZIP'),
    text('Country', 'Country'),
  ],
};

const propertyLoan = {
  title: 'Property-Loan Information',
  fields: [
    select('Loan_Type', 'Loan Type', LOAN_TYPES),
    select('Property_Type', 'Type', PROPERTY_TYPES),
    { key: 'Requested_Loan_Amount', label: 'Requested Loan Amount', kind: 'amount' },
    text('Location', 'Location'),
  ],
};

const description = {
  title: 'Description Information',
  fields: [{ key: 'Note', label: 'Note', kind: 'textarea', wide: true }],
};

export const leadSections = (customerType) => [
  basicInfo,
  customerType === 'Company' ? company : individual,
  address,
  propertyLoan,
  description,
];

// Every form key shown for a customer type (including the title dropdown next
// to First Name) - anything else is blanked before sync so a hidden section's
// leftover values never reach Zoho.
export const visibleKeys = (customerType) => {
  const keys = new Set();
  leadSections(customerType).forEach((section) =>
    section.fields.forEach((f) => {
      keys.add(f.key);
      if (f.titleKey) keys.add(f.titleKey);
    })
  );
  return keys;
};
