import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import { useRemote } from "../hooks/useRemote.js";
import { useAdmin } from "../context/AdminContext.jsx";
import { downloadCsv } from "../lib/format.js";
import FormDialog from "./FormDialog.jsx";
import { Alert, Empty, Forbidden, PageHeading } from "./ui.jsx";

// Page de liste générique des modules RH et finances : recherche, filtres,
// pagination, ajout / modification / suppression selon les droits du compte.
export default function ListPage({
  kicker,
  title,
  description,
  endpoint,
  section,
  query = {},
  filters = [],
  search = "Rechercher…",
  columns,
  form,
  createLabel = "Ajouter",
  creatable = true,
  editable = () => true,
  deletable = () => true,
  deleteConfirm = () => "Supprimer cet élément ?",
  actions,
  headerActions,
  exportName,
  selectable,
  children,
  heading = true,
  pageSize = 25,
  createDefaults,
  autoCreate = false,
  onChanged,
}) {
  const admin = useAdmin();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [values, setValues] = useState(() =>
    Object.fromEntries(filters.map((filter) => [filter.key, filter.default ?? ""])),
  );
  const [editor, setEditor] = useState(autoCreate ? { record: null, defaults: createDefaults } : null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState([]);
  const params = useMemo(() => {
    const search = new URLSearchParams({ ...query, page: String(page), limit: String(pageSize) });
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(values)) if (value) search.set(key, value);
    return search.toString();
  }, [JSON.stringify(query), page, pageSize, q, values]);
  const allowed = admin.can(section, "view");
  const { data, error: loadError, busy, reload } = useRemote(allowed ? `${endpoint}?${params}` : null, { delay: 150 });
  useEffect(() => setSelected([]), [params]);
  if (!allowed) return <Forbidden />;
  const items = data?.items || [];
  const pages = data?.pages || 1;
  const canCreate = form && creatable && admin.can(section, "create");
  const canUpdate = form && admin.can(section, "update");
  const canDelete = admin.can(section, "delete");
  const done = (message) => {
    setSuccess(message);
    setError("");
    reload();
    onChanged?.();
  };
  const ctx = {
    reload,
    setError: (message) => {
      setError(message);
      setSuccess("");
    },
    done,
    openCreate: (defaults) => setEditor({ record: null, defaults }),
    openEdit: (record) => setEditor({ record }),
    can: admin.can,
    selected,
    filters: values,
    clearSelection: () => setSelected([]),
    // Action ponctuelle (valider, annuler…) : message de réussite puis rechargement.
    run: (task, message) => run(task, message),
  };
  async function run(task, message) {
    try {
      await task();
      done(message);
    } catch (failure) {
      ctx.setError(failure.message);
    }
  }
  async function remove(item) {
    if (!window.confirm(deleteConfirm(item))) return;
    await run(() => adminApi(`${endpoint}/${item._id}`, { method: "DELETE" }), "Élément supprimé.");
  }
  async function exportCsv() {
    try {
      const all = new URLSearchParams(params);
      all.set("all", "1");
      all.delete("page");
      const result = await adminApi(`${endpoint}?${all}`);
      const exported = columns.filter((column) => column.csv);
      downloadCsv(
        exportName,
        result.items.map((item) => Object.fromEntries(exported.map((column) => [column.label, column.csv(item)]))),
      );
    } catch (failure) {
      ctx.setError(failure.message);
    }
  }
  const rowActions = (item) => (actions ? actions(item, ctx).filter((action) => action && action.show !== false) : []);
  const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]));
  const selectableItems = selectable ? items.filter((item) => selectable.can?.(item) ?? true) : [];
  const record = editor?.record;
  const buttons = (
    <>
      {headerActions?.(ctx)}
      {exportName && (
        <button className="button button-outline" onClick={exportCsv} disabled={!items.length}>
          <Download size={16} /> Exporter (CSV)
        </button>
      )}
      {canCreate && (
        <button className="button" onClick={() => setEditor({ record: null, defaults: createDefaults })}>
          <Plus size={17} /> {createLabel}
        </button>
      )}
    </>
  );
  return (
    <>
      {heading ? (
        <PageHeading kicker={kicker} title={title} description={description}>
          {buttons}
        </PageHeading>
      ) : (
        <div className="list-toolbar admin-heading-actions">{buttons}</div>
      )}
      <Alert error={error || loadError} success={success} />
      {typeof children === "function" ? children(ctx, data) : children}
      <div className="admin-resource-bar">
        <div>
          <strong>{data?.total ?? items.length}</strong>
          <span>résultat{(data?.total ?? items.length) > 1 ? "s" : ""}</span>
        </div>
        {search && (
          <label className="admin-search">
            <Search size={17} />
            <input
              value={q}
              placeholder={search}
              aria-label={search}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </label>
        )}
        {filters.map((filter) =>
          filter.options ? (
            <select
              key={filter.key}
              value={values[filter.key]}
              aria-label={filter.label}
              onChange={(event) => {
                setValues((current) => ({ ...current, [filter.key]: event.target.value }));
                setPage(1);
              }}
            >
              {filter.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <label key={filter.key} className="filter-input">
              <span>{filter.label}</span>
              <input
                type={filter.type || "date"}
                value={values[filter.key]}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [filter.key]: event.target.value }));
                  setPage(1);
                }}
              />
            </label>
          ),
        )}
      </div>
      {selectable && selected.length > 0 && (
        <div className="selection-bar" role="status">
          <span>
            {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
          </span>
          {selectable.actions
            .filter((action) => action.show !== false)
            .map((action) => (
              <button key={action.label} className="button button-small" onClick={() => action.onClick(selected, ctx)}>
                {action.icon && <action.icon size={16} />} {action.label}
              </button>
            ))}
          <button className="button button-small button-outline" onClick={() => setSelected([])}>
            Désélectionner
          </button>
        </div>
      )}
      <div className={`admin-table-panel ${busy && data ? "is-refreshing" : ""}`}>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" className="select-cell">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={selectableItems.length > 0 && selectableItems.every((item) => selected.includes(item._id))}
                      onChange={(event) => setSelected(event.target.checked ? selectableItems.map((item) => item._id) : [])}
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th key={column.label} scope="col" className={column.align === "right" ? "num" : ""}>
                    {column.label}
                  </th>
                ))}
                <th scope="col" className="actions-head">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className={selected.includes(item._id) ? "is-selected" : ""}>
                  {selectable && (
                    <td className="select-cell">
                      {(selectable.can?.(item) ?? true) && (
                        <input
                          type="checkbox"
                          aria-label="Sélectionner la ligne"
                          checked={selected.includes(item._id)}
                          onChange={() => toggle(item._id)}
                        />
                      )}
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.label} className={column.align === "right" ? "num" : column.className || ""}>
                      {column.render(item)}
                    </td>
                  ))}
                  <td>
                    <div className="admin-actions">
                      {rowActions(item).map((action) => (
                        <button
                          key={action.label}
                          title={action.label}
                          aria-label={action.label}
                          className={action.tone ? `action-${action.tone}` : ""}
                          onClick={() => action.onClick(item, ctx)}
                        >
                          <action.icon size={16} />
                        </button>
                      ))}
                      {canUpdate && editable(item) && (
                        <button title="Modifier" aria-label="Modifier" onClick={() => setEditor({ record: item })}>
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && deletable(item) && (
                        <button className="action-delete" title="Supprimer" aria-label="Supprimer" onClick={() => remove(item)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <Empty
            title={busy ? "Chargement…" : "Aucun élément pour le moment."}
            text={busy ? undefined : canCreate ? `Utilisez « ${createLabel} » pour commencer.` : undefined}
          />
        )}
        {data?.pages !== undefined && (
          <div className="admin-table-footer">
            <span>
              Page {page} sur {Math.max(1, pages)}
            </span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Page précédente">
                <ChevronLeft size={17} />
              </button>
              <button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} aria-label="Page suivante">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
      {editor && form && (
        <FormDialog
          title={record ? `Modifier · ${form.title}` : `Ajouter · ${form.title}`}
          intro={form.intro}
          fields={typeof form.fields === "function" ? form.fields(record) : form.fields}
          initial={record ? (form.initial ? form.initial(record) : record) : editor.defaults || {}}
          wide={form.wide}
          onClose={() => setEditor(null)}
          onSubmit={async (body, values) => {
            const payload = form.toBody ? form.toBody(body, values, record) : body;
            await adminApi(record ? `${endpoint}/${record._id}` : endpoint, {
              method: record ? "PATCH" : "POST",
              body: payload,
            });
            setEditor(null);
            done(record ? "Modifications enregistrées." : "Élément ajouté.");
          }}
        >
          {form.footer}
        </FormDialog>
      )}
    </>
  );
}
