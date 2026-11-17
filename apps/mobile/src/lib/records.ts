// Health records live in this private bucket. Files are only read through links that expire after 60 seconds.
export const RECORD_BUCKET = 'patient-reports';
export const RECORD_LINK_SECONDS = 60;
