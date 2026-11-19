import { requestStates } from '../../shared/domain.js';

export default function Badge({ value }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {requestStates.includes(value) && <i aria-hidden="true" />}
      {value}
    </span>
  );
}
