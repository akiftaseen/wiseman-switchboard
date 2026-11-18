const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatTime(value) { return timestamp.format(new Date(value)); }
export function ticketId(id) { return 'REQ-' + String(id).padStart(3, '0'); }
