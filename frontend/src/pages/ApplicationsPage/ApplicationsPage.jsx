import './ApplicationsPage.css'
import ApplicationRows from '../../components/ApplicationRows/ApplicationRows'
export default function ApplicationsPage({ jobs, actions, term, setTerm, stage, setStage, stages }) {
  return (
    <section className="paper list-paper">
      <div className="list-tools">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Etsi yritystä tai tehtävää"
          />
        </label>
        <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Suodata vaiheen mukaan">
          <option>Kaikki vaiheet</option>
          {stages.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <ApplicationRows jobs={jobs} {...actions} />
    </section>
  )
}
