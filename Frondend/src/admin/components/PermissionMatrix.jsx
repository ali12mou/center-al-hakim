import { ACTIONS, MODULES, cleanPermissions } from "../../../../Backend/config/permissions.js";

const ORDER = Object.keys(ACTIONS);

// Grille des droits : une ligne par page, une colonne par action.
// Cocher « Ajouter », « Modifier »… coche aussi « Consulter ».
export default function PermissionMatrix({ value, onChange }) {
  const set = new Set(value);
  const update = (next) => onChange(cleanPermissions([...next]));
  const toggle = (section, action) => {
    const next = new Set(set);
    const key = `${section.id}:${action}`;
    if (next.has(key)) {
      next.delete(key);
      // Sans « Consulter », plus aucune autre action sur la page.
      if (action === "view") for (const other of section.actions) next.delete(`${section.id}:${other}`);
    } else next.add(key);
    update(next);
  };
  const all = (sections, on) => {
    const next = new Set(set);
    for (const section of sections)
      for (const action of section.actions) on ? next.add(`${section.id}:${action}`) : next.delete(`${section.id}:${action}`);
    update(next);
  };
  const readOnly = (sections) => {
    const next = new Set(set);
    for (const section of sections) {
      for (const action of section.actions) next.delete(`${section.id}:${action}`);
      next.add(`${section.id}:view`);
    }
    update(next);
  };
  return (
    <div className="permission-matrix">
      {MODULES.map((module) => {
        const granted = module.sections.filter((section) => set.has(`${section.id}:view`)).length;
        return (
          <details key={module.id} open={granted > 0}>
            <summary>
              <strong>{module.label}</strong>
              <span>
                {granted ? `${granted} page${granted > 1 ? "s" : ""} sur ${module.sections.length}` : "Aucun accès"}
              </span>
            </summary>
            <div className="permission-tools">
              <button type="button" onClick={() => all(module.sections, true)}>Tout autoriser</button>
              <button type="button" onClick={() => readOnly(module.sections)}>Consultation seule</button>
              <button type="button" onClick={() => all(module.sections, false)}>Tout retirer</button>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table permission-table">
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    {ORDER.map((action) => (
                      <th key={action} scope="col">{ACTIONS[action]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {module.sections.map((section) => (
                    <tr key={section.id}>
                      <th scope="row">
                        {section.label}
                        {section.hint && <small>{section.hint}</small>}
                      </th>
                      {ORDER.map((action) => (
                        <td key={action}>
                          {section.actions.includes(action) ? (
                            <input
                              type="checkbox"
                              checked={set.has(`${section.id}:${action}`)}
                              onChange={() => toggle(section, action)}
                              aria-label={`${section.label} : ${ACTIONS[action]}`}
                            />
                          ) : (
                            <span className="permission-na" aria-label="Non applicable">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
