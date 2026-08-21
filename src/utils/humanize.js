// Central lookup for all backend key → human label mappings
const LABEL_MAP = {
  // Stages
  new_lead:                 'New Lead',
  auto_message_sent:        'Auto Message Sent',
  booking_pending:          'Booking Pending',
  pre_screening_booked:     'Pre-screening Booked',
  booked_not_called:        'Booked But Not Called',
  called:                   'Called',
  no_answer:                'No Answer',
  call_back_later:          'Call Back Later',
  pre_screening_completed:  'Pre-screening Completed',
  qualified:                'Qualified',
  not_qualified:            'Not Qualified',
  no_show:                  'No Show',
  opted_out:                'Opted Out',

  // Sources
  manual:    'Manual Entry',
  facebook:  'Facebook',
  website:   'Website',
  import:    'Import',
  referral:  'Referral',

  // Booking types
  pre_screening_call: 'Pre-screening Call',
  screening_visit:    'Screening Visit',
  follow_up:          'Follow Up',

  // Booking / task statuses
  scheduled:    'Scheduled',
  completed:    'Completed',
  cancelled:    'Cancelled',
  rescheduled:  'Rescheduled',
  open:         'Open',
  in_progress:  'In Progress',
  overdue:      'Overdue',
  dismissed:    'Dismissed',

  // Task types
  callback:    'Callback',
  alert:       'Alert',
  review:      'Review',
  sla_breach:  'SLA Breach',

  // Call outcomes
  connected:      'Connected',
  voicemail:      'Voicemail',
  missed:         'Missed',
  failed:         'Failed',
  inbound_missed: 'Inbound Missed',

  // Comm types
  sms:   'SMS',
  email: 'Email',
  call:  'Call',

  // Directions / priorities
  inbound:  'Inbound',
  outbound: 'Outbound',
  high:     'High',
  normal:   'Normal',
  low:      'Low',

  // Bool-like
  true:  'Yes',
  false: 'No',

  // Billing / Invoice statuses
  draft:          'Draft',
  sent:           'Sent',
  paid:           'Paid',
  partial:        'Partially Paid',
  no_show:        'No Show',

  // Payment methods
  bank_transfer:  'Bank Transfer',
  bacs:           'BACS',
  cheque:         'Cheque',
  cash:           'Cash',
  card:           'Credit/Debit Card',

  // Study phases
  phase_1:       'Phase I',
  phase_2:       'Phase II',
  phase_3:       'Phase III',
  phase_4:       'Phase IV',
  observational: 'Observational',
  expanded:      'Expanded Access',

  // Study statuses
  planning:   'Planning',
  recruiting: 'Recruiting',
  active:     'Active',
  paused:     'Paused',
  closed:     'Closed',

  // Document categories
  consent:   'Consent Form',
  protocol:  'Protocol',
  sop:       'SOP',
  report:    'Report',
  ethics:    'Ethics / IRB',
  other:     'Other',

  // Document statuses
  approved:        'Approved',
  pending_review:  'Pending Review',
  superseded:      'Superseded',

  // Staff roles
  admin:     'Admin',
  manager:   'Manager',
  recruiter: 'Recruiter',
  viewer:    'Viewer',
};

/**
 * Returns the human-readable label for a backend key.
 * Falls back to converting snake_case → Title Case.
 */
export function humanize(value) {
  if (value === null || value === undefined) return '—';
  const str = String(value);
  if (LABEL_MAP[str] !== undefined) return LABEL_MAP[str];
  // Generic snake_case → Title Case
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Replaces all known backend keys embedded in a freeform string.
 * Useful for audit trail action strings like
 * "Stage changed from booking_pending to pre_screening_booked"
 */
export function humanizeText(text) {
  if (!text) return text;
  return text.replace(/\b([a-z][a-z0-9_]*)\b/g, (match) => {
    return LABEL_MAP[match] ?? match;
  });
}
