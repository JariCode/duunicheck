import './Sidebar.css'
import { useDialog } from '../../utils/useDialog.js'

const navigation = [
  ['home', 'Yleiskatsaus', '01'],
  ['jobs', 'Hakemukset', '02'],
  ['board', 'Eteneminen', '03'],
  ['calendar', 'Kalenteri', '04'],
  ['materials', 'CV & pohjat', '05'],
  ['assistant', 'AI-chat', '06'],
]
export default function Sidebar({ active, onNavigate, count, isOpen, onClose, onToggle }) {
  // The mobile menu behaves like a dialog: Escape closes it and Tab stays in the menu.
  const menuRef = useDialog({ open: isOpen, onClose, initialFocus: '.nav-link.current' })
  return (
    <aside ref={menuRef} className={'sidebar ' + (isOpen ? 'menu-open' : '')}>
      <div className="brand-row">
        <button className="brand" onClick={() => onNavigate('home')}>
          <span className="brand-icon">D</span>
          <span>
            DuuniCheck<span className="brand-period">.</span>
          </span>
        </button>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label={isOpen ? 'Sulje valikko' : 'Avaa valikko'}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? '×' : '☰'}
        </button>
      </div>
      <p className="side-label">OMA TYÖPÖYTÄ</p>
      <nav aria-label="Päänavigaatio">
        {navigation.map(([key, label, number]) => (
          <button key={key} className={'nav-link ' + (active === key ? 'current' : '')} onClick={() => onNavigate(key)}>
            <span className="nav-number">{number}</span>
            {label}
            {key === 'jobs' && <small>{count}</small>}
          </button>
        ))}
      </nav>
      {isOpen && <button className="mobile-nav-backdrop" aria-label="Sulje valikko" onClick={onClose} />}
      <div className="sidebar-bottom">
        <div className="sticky-note">
          <span>✳</span>
          <b>OMA TYÖNHAUN TILA</b>
          <p>Hakemukset, CV-versiot ja työnhaun materiaalit yhdessä paikassa.</p>
        </div>
      </div>
    </aside>
  )
}
