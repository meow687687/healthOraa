// New health records use the private bucket; the legacy bucket stays read-compatible during migration.
export const RECORD_BUCKET = 'medical-records';
export const LEGACY_RECORD_BUCKET = 'patient-reports';
export const DIET_CHART_BUCKET = 'diet-charts';
export const RECORD_LINK_SECONDS = 60;
