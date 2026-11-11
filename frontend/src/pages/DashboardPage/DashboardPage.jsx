import './DashboardPage.css'
import DashboardStats from '../../components/DashboardStats/DashboardStats'
import ApplicationRows from '../../components/ApplicationRows/ApplicationRows'
export default function DashboardPage({ jobs, actions }) {
  return (
    <>
      <DashboardStats jobs={jobs} onOpenJob={actions.onDetails} />
      <section className="paper recent">
        <div className="section-heading">
          <div>
            <h2>Tuoreimmat hakemukset</h2>
            <p>Muuta tietoja, katso historiaa tai päivitä vaihetta</p>
          </div>
          <button className="see-all" onClick={actions.onSeeAll}>
            Koko lista →
          </button>
        </div>
        <ApplicationRows jobs={jobs.slice(0, 4)} {...actions} />
      </section>
    </>
  )
}
