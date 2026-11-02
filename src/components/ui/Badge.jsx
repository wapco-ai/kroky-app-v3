import { BADGE_CLASS } from '../../data/store.js'

export default function Badge({ status, label }) {
  return (
    <span className={`badge ${BADGE_CLASS[status] || 'b-reviewing'}`}>
      {label}
    </span>
  )
}
