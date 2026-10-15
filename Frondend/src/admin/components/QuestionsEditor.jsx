import { Plus, Trash2 } from "lucide-react";

export default function QuestionsEditor({ value = [], onChange }) {
  function update(index, change) {
    onChange(
      value.map((question, position) =>
        position === index ? { ...question, ...change } : question,
      ),
    );
  }
  return (
    <div className="questions-editor">
      <div className="questions-heading">
        <h3>Questions de l’évaluation</h3>
        <button
          type="button"
          className="button button-outline"
          onClick={() =>
            onChange([
              ...value,
              { prompt: "", choices: ["", "", "", ""], correctIndex: 0 },
            ])
          }
        >
          <Plus size={15} />
          Ajouter une question
        </button>
      </div>
      {value.map((question, index) => (
        <fieldset key={index}>
          <legend>Question {index + 1}</legend>
          <label>
            Énoncé
            <input
              value={question.prompt}
              minLength={5}
              maxLength={500}
              required
              onChange={(event) =>
                update(index, { prompt: event.target.value })
              }
            />
          </label>
          <div className="admin-form-grid">
            {question.choices.map((choice, option) => (
              <label key={option}>
                Réponse {option + 1}
                <input
                  value={choice}
                  required
                  maxLength={300}
                  onChange={(event) =>
                    update(index, {
                      choices: question.choices.map((item, position) =>
                        position === option ? event.target.value : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="question-bottom">
            <label>
              Bonne réponse
              <select
                value={question.correctIndex}
                onChange={(event) =>
                  update(index, { correctIndex: Number(event.target.value) })
                }
              >
                {question.choices.map((choice, option) => (
                  <option key={option} value={option}>
                    Réponse {option + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="admin-danger-link"
              onClick={() =>
                onChange(value.filter((_, position) => position !== index))
              }
            >
              <Trash2 size={15} />
              Retirer
            </button>
          </div>
        </fieldset>
      ))}
      {!value.length && (
        <p>Ajoutez au moins une question avant d’enregistrer.</p>
      )}
    </div>
  );
}
