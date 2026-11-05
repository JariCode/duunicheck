import './PrintSheet.css'
export default function PrintSheet({ document }) {
  if (!document) return null
  return <article className="print-document"><header><strong>DuuniCheck</strong><small>Työnhaun materiaalit</small></header><h1>{document.title}</h1>{document.blocks.map((block, index) => <section key={index}><h2>{block.title}</h2><p>{block.body}</p></section>)}</article>
}
