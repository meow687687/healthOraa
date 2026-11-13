// Statutory details shown in the app. The grievance officer and the contact channel must be confirmed
// before any store release. They are placeholders here, not real contact details.
export const GRIEVANCE_OFFICER = {
  name: 'To be confirmed before release',
  email: 'To be confirmed before release',
  responseWindow: 'Complaints are acknowledged within 48 hours, as the DPDP rules require.',
} as const;

export const MEDICAL_DISCLAIMERS: readonly string[] = [
  'Consultations are with registered medical practitioners. Diet programmes are nutrition guidance, not a substitute for treatment.',
  'Do not stop or change prescribed medicine without speaking to your doctor.',
  'Healthoraa is not an emergency service. In an emergency call 112 (India).',
];
