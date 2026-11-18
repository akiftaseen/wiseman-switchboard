export default function Badge({ value }) {
  return <span className={'badge ' + value.toLowerCase()}><i aria-hidden="true" />{value}</span>;
}
