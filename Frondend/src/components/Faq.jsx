import { Plus } from "lucide-react";

export default function Faq({ items }) {
  return (
    <section className="section faq">
      <div className="container faq-grid">
        <div>
          <span className="eyebrow">ON VOUS RÉPOND</span>
          <h2>
            Vos questions,
            <br />
            nos réponses.
          </h2>
          <p>
            Tout commence par une
            <br />
            information claire.
          </p>
        </div>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <Plus size={20} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
