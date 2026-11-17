// Statutory details shown in the app.
//
// Every value marked TODO_CLIENT_LEGAL is a placeholder. The founders must replace it with the official details
// before any store release. A development build shows a warning while any placeholder remains.
export const TODO_MARKER = 'TODO_CLIENT_LEGAL';

export const GRIEVANCE_OFFICER = {
  // TODO_CLIENT_LEGAL: full legal name of the appointed Grievance Officer.
  name: 'TODO_CLIENT_LEGAL: Grievance Officer name',
  // TODO_CLIENT_LEGAL: monitored mailbox for grievances.
  email: 'TODO_CLIENT_LEGAL: grievance email address',
  // TODO_CLIENT_LEGAL: postal address for written grievances.
  address: 'TODO_CLIENT_LEGAL: registered postal address',
  // TODO_CLIENT_LEGAL: hours the officer is available.
  hours: 'TODO_CLIENT_LEGAL: availability hours',
  // TODO_CLIENT_LEGAL: the response commitment, as approved by counsel.
  responseWindow: 'TODO_CLIENT_LEGAL: response commitment',
} as const;

// TODO_CLIENT_LEGAL: counsel must approve every line of the medical disclaimers before release.
export const MEDICAL_DISCLAIMERS: readonly string[] = [
  'Consultations are with registered medical practitioners. Diet programmes are nutrition guidance, not a substitute for treatment.',
  'Do not stop or change prescribed medicine without speaking to your doctor.',
  'Healthoraa is not an emergency service. In an emergency call 112 (India).',
];

export const hasPendingLegalDetails = (): boolean =>
  Object.values(GRIEVANCE_OFFICER).some((value) => value.startsWith(TODO_MARKER));
