export const statuses = ['Operational', 'Degraded', 'Down'];
export const issueTypes = ['Email', 'VPN', 'File Share', 'Hardware', 'Other'];
export const limits = { name: 80, description: 2000 };

export function requestErrors(input = {}) {
  const errors = {};
  if (typeof input.name !== 'string' || !input.name.trim()) {
    errors.name = 'Enter your name.';
  } else if (input.name.trim().length > limits.name) {
    errors.name = 'Use 80 characters or fewer.';
  }
  if (!issueTypes.includes(input.issueType)) errors.issueType = 'Choose an issue type.';
  if (typeof input.description !== 'string' || !input.description.trim()) {
    errors.description = 'Describe the issue so IT can help.';
  } else if (input.description.trim().length > limits.description) {
    errors.description = 'Use 2,000 characters or fewer.';
  }
  return errors;
}
