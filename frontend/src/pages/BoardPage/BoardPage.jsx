import './BoardPage.css'
import ApplicationCard from '../../components/ApplicationCard/ApplicationCard'
import { stages, tone } from '../../utils'
export default function BoardPage({ jobs, actions }) {
  return <div className="board">{stages.map((stage) => <section className="board-column" key={stage}><h2><i className={tone(stage)} />{stage}<small>{jobs.filter((job) => job.status === stage).length}</small></h2>{jobs.filter((job) => job.status === stage).map((job) => <ApplicationCard job={job} key={job.id} {...actions} />)}<button className="add-card" onClick={actions.onAdd}>＋ Lisää hakemus</button></section>)}</div>
}
