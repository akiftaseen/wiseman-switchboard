export const UP = 'Up';
export const OPEN = 'Open';
export const RESOLVED = 'Resolved';
export const statuses = [UP, 'Degraded', 'Down'];
export const requestStates = [OPEN, RESOLVED];
export const issueTypes = ['Email', 'VPN', 'File Share', 'Hardware', 'Other'];
export const limits = { name: 80, description: 2000 };

export function requestErrors(input = {}) {
  const errors = {};
  if (typeof input.name !== 'string' || !input.name.trim()) {
    errors.name = 'Enter your name.';
  } else if (input.name.trim().length > limits.name) {
    errors.name = `Use ${limits.name} characters or fewer.`;
  }
  if (!issueTypes.includes(input.issueType)) errors.issueType = 'Choose an issue type.';
  if (typeof input.description !== 'string' || !input.description.trim()) {
    errors.description = 'Describe the issue so IT can help.';
  } else if (input.description.trim().length > limits.description) {
    errors.description = `Use ${limits.description.toLocaleString('en-US')} characters or fewer.`;
  }
  return errors;
}
