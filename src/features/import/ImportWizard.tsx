
import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Button from '../../components/Button';
import { bulkImport, ImportMapping, ImportResult } from '../../data/store';
import { formatNumber } from '../../utils/format';
import './ImportWizard.css';

interface Props {
  onImported: () => void;
}

type Step = 'drop' | 'map' | 'importing' | 'done';

type Row = Record<string, unknown>;

// Field metadata for the column-mapping UI.
const FIELDS: { key: keyof ImportMapping; label: string; required: boolean; hints: RegExp }[] = [
  { key: 'invoiceNumber', label: 'N° de facture', required: true, hints: /facture|invoice|n°|numero|num|ref/i },
  { key: 'clientName', label: 'Nom du client', required: true, hints: /client|nom|raison|soci[ée]t[ée]|company|tiers/i },
  { key: 'amount', label: 'Montant', required: true, hints: /montant|amount|total|ttc|prix|solde/i },
  { key: 'dueDate', label: "Date d'échéance", required: true, hints: /[ée]ch[ée]ance|due|limite|paiement/i },
  { key: 'issueDate', label: "Date d'émission", required: false, hints: /[ée]mission|date facture|issue|creat|edit/i },
  { key: 'status', label: 'Statut', required: false, hints: /statut|status|[ée]tat/i },
  { key: 'email', label: 'Email client', required: false, hints: /email|mail|courriel|e-mail/i },
];

export default function ImportWizard({ onImported }: Props) {
  const [step, setStep] = useState<Step>('drop');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Partial<ImportMapping>>({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const autoMap = (hs: string[]): Partial<ImportMapping> => {
    const m: Partial<ImportMapping> = {};
    for (const f of FIELDS) {
      const found = hs.find((h) => f.hints.test(h));
      if (found) m[f.key] = found;
    }
    return m;
  };

  const handleFile = useCallback(async (file: File) => {
    setError('');
    const name = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(name)) {
      setError('Format non supporté. Utilisez un fichier .xlsx, .xls ou .csv.');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      // cellDates converts date cells into JS Date objects for reliable parsing.
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('empty');
      const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: '', raw: true });
      if (json.length === 0) {
        setError('Le fichier ne contient aucune ligne de données.');
        return;
      }
      // Collect the union of all keys (handles ragged rows).
      const hs = Array.from(
        json.reduce((set, r) => {
          Object.keys(r).forEach((k) => set.add(k));
          return set;
        }, new Set<string>())
      );
      setFileName(file.name);
      setHeaders(hs);
      setRows(json);
      setMapping(autoMap(hs));
      setStep('map');
    } catch {
      setError("Impossible de lire ce fichier. Vérifiez qu'il n'est pas corrompu.");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key]).map(
    (f) => f.label
  );

  const startImport = async () => {
    if (missingRequired.length) {
      setError(`Veuillez associer les colonnes obligatoires : ${missingRequired.join(', ')}.`);
      return;
    }
    setError('');
    setStep('importing');
    setProgress(0);
    const res = await bulkImport(rows, mapping as ImportMapping, (r) =>
      setProgress(Math.round(r * 100))
    );
    setResult(res);
    setStep('done');
    onImported();
  };

  const reset = () => {
    setStep('drop');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setError('');
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Importer des factures</h1>
          <p className="page__subtitle">
            Importez en masse vos bases clients et factures depuis Excel ou CSV.
          </p>
        </div>
      </header>

      <div className="import-card">
        <Stepper step={step} />

        {step === 'drop' && (
          <div
            className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="dropzone__icon">📊</div>
            <div className="dropzone__title">Glissez-déposez votre fichier ici</div>
            <div className="dropzone__sub">ou cliquez pour parcourir — .xlsx, .xls, .csv</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === 'map' && (
          <div className="map-step">
            <div className="map-fileinfo">
              <span>📄 <strong>{fileName}</strong></span>
              <span className="map-count">{formatNumber(rows.length)} lignes détectées</span>
              <Button variant="ghost" size="sm" onClick={reset}>
                Changer de fichier
              </Button>
            </div>

            <p className="map-intro">
              Associez les colonnes de votre fichier aux champs de l'application. Les champs
              marqués d'un <span className="req">*</span> sont obligatoires.
            </p>

            <div className="map-grid">
              {FIELDS.map((f) => (
                <div key={f.key} className="map-row">
                  <label className="map-label">
                    {f.label}
                    {f.required && <span className="req"> *</span>}
                  </label>
                  <select
                    value={mapping[f.key] || ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                    }
                    className={f.required && !mapping[f.key] ? 'map-select--missing' : ''}
                  >
                    <option value="">— Ignorer —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="preview">
              <div className="preview__title">Aperçu (5 premières lignes)</div>
              <div className="preview__scroll">
                <table>
                  <thead>
                    <tr>
                      {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key}>{String(r[mapping[f.key] as string] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <div className="import-error">{error}</div>}

            <div className="map-actions">
              <Button variant="secondary" onClick={reset}>
                Annuler
              </Button>
              <Button onClick={startImport} icon={<span>⬆</span>}>
                Importer {formatNumber(rows.length)} factures
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="importing">
            <div className="importing__title">Importation en cours…</div>
            <div className="importing__sub">
              Traitement par lots pour préserver la fluidité — ne fermez pas cette fenêtre.
            </div>
            <div className="progress-big">
              <div className="progress-big__bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-pct">{progress}%</div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="done">
            <div className="done__icon">{result.failed === 0 ? '✅' : '⚠️'}</div>
            <h2 className="done__title">Importation terminée</h2>
            <div className="done__stats">
              <div className="done-stat done-stat--green">
                <span className="done-stat__n">{formatNumber(result.created)}</span>
                <span className="done-stat__l">Factures importées</span>
              </div>
              <div className="done-stat done-stat--blue">
                <span className="done-stat__n">{formatNumber(result.clientsCreated)}</span>
                <span className="done-stat__l">Nouveaux clients</span>
              </div>
              <div className={`done-stat ${result.failed ? 'done-stat--red' : ''}`}>
                <span className="done-stat__n">{formatNumber(result.failed)}</span>
                <span className="done-stat__l">Lignes en erreur</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="error-list">
                <div className="error-list__title">Détail des erreurs</div>
                <div className="error-list__scroll">
                  {result.errors.map((e, i) => (
                    <div key={i} className="error-row">
                      <span className="error-line">Ligne {e.line}</span>
                      <span>{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="done__actions">
              <Button variant="secondary" onClick={reset}>
                Importer un autre fichier
              </Button>
            </div>
          </div>
        )}

        {error && step === 'drop' && <div className="import-error">{error}</div>}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { id: 'drop', label: '1. Fichier' },
    { id: 'map', label: '2. Correspondance' },
    { id: 'done', label: '3. Résultat' },
  ];
  const idx = step === 'importing' ? 1 : steps.findIndex((s) => s.id === step);
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={s.id} className={`stepper__item ${i <= idx ? 'stepper__item--active' : ''}`}>
          <span className="stepper__dot">{i + 1}</span>
          {s.label}
        </div>
      ))}
    </div>
  );
}
