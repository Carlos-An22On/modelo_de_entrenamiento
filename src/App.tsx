import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Layers,
  Loader2,
  Play,
  Upload,
} from "lucide-react";

type TrainingRun = {
  id: number;
  model: string;
  dataset: string;
  accuracy: number;
  loss: number;
  status: "En progreso" | "Completado" | "En espera";
  lastUpdate: string;
};

type TrainingStatus = {
  running: boolean;
  progress: number;
  message: string;
};

type ParsedDataset = {
  headers: string[];
  rows: Record<string, string | number | null>[];
};

type XLSXModule = {
  read: (data: ArrayBuffer, options: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(sheet: unknown, options?: Record<string, unknown>) => T[];
  };
};

const baseRuns: TrainingRun[] = [
  {
    id: 1,
    model: "Clasificador base",
    dataset: "Imágenes etiquetadas",
    accuracy: 0.91,
    loss: 0.21,
    status: "Completado",
    lastUpdate: "Hace 2 horas",
  },
  {
    id: 2,
    model: "Detección objetos v2",
    dataset: "Cámaras de almacén",
    accuracy: 0.87,
    loss: 0.28,
    status: "En espera",
    lastUpdate: "Ayer",
  },
  {
    id: 3,
    model: "Segmentación ligera",
    dataset: "Dataset sintético",
    accuracy: 0.83,
    loss: 0.32,
    status: "Completado",
    lastUpdate: "Hace 3 días",
  },
];

const checklist = [
  "Clases balanceadas (±10%)",
  "Sin etiquetas vacías o nulas",
  "Datos de validación separados",
  "Aumentación activada",
  "Revisión visual de ejemplos",
];

function App() {
  const [runs, setRuns] = useState(baseRuns);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    running: false,
    progress: 0,
    message: "Listo para entrenar",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState({
    text: "Arrastra tu Excel o selecciónalo para adjuntarlo",
    tone: "info" as "info" | "success" | "error",
  });
  const [datasetPreview, setDatasetPreview] = useState<ParsedDataset | null>(null);
  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [icfesScores, setIcfesScores] = useState<
    { id: number; estudiante: string; prediccion: number; real?: number | null }[]
  >([]);
  const [form, setForm] = useState({
    datasetName: "Dataset de cámaras",
    samples: 12500,
    learningRate: 0.001,
    epochs: 15,
    optimizer: "Random Forest (fijo)",
    augmentation: true,
    notes: "Revisar labels dudosos de la clase 'caja'.",
  });

  useEffect(() => {
    if (!trainingStatus.running) return;

    const timer = setInterval(() => {
      setTrainingStatus((prev) => {
        const nextProgress = Math.min(prev.progress + 7, 100);
        if (nextProgress === 100) {
          clearInterval(timer);
          setRuns((current) => {
            const updated = [...current];
            if (updated[0]) {
              const qualityBoost = datasetQuality.score / 300;
              updated[0] = {
                ...updated[0],
                status: "Completado",
                accuracy: clampScore(0.78 + qualityBoost + Math.random() * 0.05, 0.65, 0.98),
                loss: clampScore(0.22 - qualityBoost / 2 + Math.random() * 0.05, 0.04, 0.35),
                lastUpdate: "Justo ahora",
              };
            }
            return updated;
          });
        }
        return {
          running: nextProgress !== 100,
          progress: nextProgress,
          message:
            nextProgress === 100
              ? "Entrenamiento con Random Forest completado"
              : "Procesando épocas y métricas...",
        };
      });
    }, 800);

    return () => clearInterval(timer);
  }, [trainingStatus.running]);

  const clampScore = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const cleanHeader = (header: string) => header.trim().replace(/\s+/g, " ");

  const detectTargetColumn = (headers: string[]) => {
    const normalized = headers.map((h) => cleanHeader(h).toLowerCase().replace(/[_\s-]+/g, ""));
    const priorities = [
      "puntglobal",
      "puntajeglobal",
      "punticfes",
      "puntajeicfes",
      "objetivo",
      "target",
      "icfes",
      "puntaje",
      "score",
    ];

    for (const candidate of priorities) {
      const matchIndex = normalized.findIndex((header) => header.includes(candidate));
      if (matchIndex !== -1) {
        return headers[matchIndex];
      }
    }

    return headers[headers.length - 1] ?? null;
  };

  const datasetQuality = useMemo(() => {
    if (!datasetPreview) {
      const completeness = 0.94;
      const classBalance = 0.82;
      const metadata = 0.89;
      const score = Math.round(((completeness + classBalance + metadata) / 3) * 100);
      return { completeness, classBalance, metadata, score };
    }

    const totalCells = datasetPreview.headers.length * Math.max(datasetPreview.rows.length, 1);
    const missingCells = datasetPreview.rows.reduce((acc, row) => {
      return (
        acc +
        datasetPreview.headers.reduce((count, header) => {
          const value = row[header];
          return value === null || value === undefined || value === "" ? count + 1 : count;
        }, 0)
      );
    }, 0);
    const completeness = totalCells ? clampScore(1 - missingCells / totalCells, 0.6, 1) : 0.8;

    const targetValues = targetColumn
      ? datasetPreview.rows
          .map((row) => row[targetColumn])
          .filter((value) => value !== null && value !== undefined)
      : [];
    const numericTarget = targetValues
      .map((value) => {
        if (typeof value === "number") return value;
        const numeric = Number(String(value).replace(",", "."));
        return Number.isFinite(numeric) ? numeric : null;
      })
      .filter((value): value is number => value !== null);
    const averageTarget =
      numericTarget.reduce((acc, value) => acc + value, 0) / Math.max(numericTarget.length, 1);
    const variance =
      numericTarget.reduce((acc, value) => acc + Math.pow(value - averageTarget, 2), 0) /
      Math.max(numericTarget.length, 1);
    const stdDev = Math.sqrt(variance);
    const classBalance = clampScore(1 - (stdDev / Math.max(averageTarget || 1, 1)) * 0.4, 0.65, 0.98);

    const metadata = clampScore(datasetPreview.headers.length / 10, 0.6, 0.95);
    const score = Math.round(((completeness + classBalance + metadata) / 3) * 100);
    return { completeness, classBalance, metadata, score };
  }, [datasetPreview, targetColumn]);

  const loadXLSX = async (): Promise<XLSXModule> => {
    if (typeof window === "undefined") {
      throw new Error("XLSX solo está disponible en el navegador");
    }
    if ((window as unknown as { XLSX?: XLSXModule }).XLSX) {
      return (window as unknown as { XLSX: XLSXModule }).XLSX;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => {
        const lib = (window as unknown as { XLSX?: XLSXModule }).XLSX;
        if (lib) {
          resolve(lib);
        } else {
          reject(new Error("No se pudo inicializar XLSX"));
        }
      };
      script.onerror = () => reject(new Error("No se pudo descargar XLSX desde la CDN"));
      document.body.appendChild(script);
    });
  };

  const normalizeValue = (value: unknown) => {
    if (typeof value === "number") return value;
    if (value === null || value === undefined) return null;
    const numeric = Number(String(value).replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const simulateRandomForest = (data: ParsedDataset, target: string | null) => {
    if (!target) return [];
    const featureColumns = data.headers.filter((header) => header !== target);
    return data.rows.slice(0, 12).map((row, index) => {
      const numericFeatures = featureColumns
        .map((feature) => normalizeValue(row[feature]))
        .filter((value): value is number => value !== null);
      const featureMean =
        numericFeatures.reduce((acc, value) => acc + value, 0) / Math.max(numericFeatures.length, 1);
      const treeVotes = [0.92, 1, 1.04, 0.96, 1.08].map((weight, treeIndex) =>
        featureMean * weight + treeIndex * 0.4,
      );
      const ensembleScore = treeVotes.reduce((acc, vote) => acc + vote, 0) / Math.max(treeVotes.length, 1);
      const predicted = clampScore(260 + ensembleScore * 32 + Math.random() * 14 - 7, 200, 500);
      const real = normalizeValue(row[target]);
      const estudiante =
        (typeof row["estudiante"] === "string" && row["estudiante"]) ||
        (typeof row["nombre"] === "string" && row["nombre"]) ||
        `Estudiante ${index + 1}`;

      return {
        id: index,
        estudiante,
        prediccion: Math.round(predicted),
        real,
      };
    });
  };

  const parseCSVLine = (line: string, delimiter: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === "\"") {
        if (inQuotes && nextChar === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const parseCSV = async (file: File, maxRows: number): Promise<ParsedDataset> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

    if (!lines.length) {
      throw new Error("El archivo CSV está vacío");
    }

    const delimiter = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const headerValues = parseCSVLine(lines[0], delimiter);
    const headers = headerValues.map((h, index) => cleanHeader(h || `columna_${index + 1}`));

    const rows: Record<string, string | number | null>[] = [];
    for (let i = 1; i < Math.min(lines.length, maxRows + 1); i += 1) {
      const values = parseCSVLine(lines[i], delimiter);
      const row: Record<string, string | number | null> = {};
      headers.forEach((header, index) => {
        const value = values[index] ?? null;
        const numeric = Number(String(value).replace(",", "."));
        row[header] = Number.isFinite(numeric) ? numeric : value || null;
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const readDatasetFile = async (file: File) => {
    const MAX_PREVIEW_ROWS = 5000;
    const prettySize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setUploadMessage({
      text: `Procesando archivo (${prettySize}) y detectando columnas...`,
      tone: "info",
    });

    const isCSV = /\.csv$/i.test(file.name);
    const parsed = isCSV
      ? await parseCSV(file, MAX_PREVIEW_ROWS)
      : (() => {
          return loadXLSX()
            .then((XLSX) => file.arrayBuffer().then((buffer) => ({ XLSX, buffer })))
            .then(({ XLSX, buffer }) => {
              const workbook = XLSX.read(buffer, { type: "array", dense: true });
              const firstSheet = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheet];
              const rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(worksheet, {
                defval: null,
                sheetRows: MAX_PREVIEW_ROWS,
              });

              if (!rows.length) {
                throw new Error("El archivo está vacío o no se pudo leer");
              }

              const rawHeaders = Object.keys(rows[0] ?? {});
              const headers = rawHeaders.map((header, index) => cleanHeader(header || `columna_${index + 1}`));
              const normalizedRows = rows.map((row) => {
                const normalizedRow: Record<string, string | number | null> = {};
                headers.forEach((header, index) => {
                  const rawKey = rawHeaders[index];
                  normalizedRow[header] = row[rawKey] ?? null;
                });
                return normalizedRow;
              });

              return { headers, rows: normalizedRows } as ParsedDataset;
            });
        })();

    const headers = parsed.headers;
    const rows = parsed.rows;
    const detectedTarget = detectTargetColumn(headers);
    setDatasetPreview(parsed);
    setTargetColumn(detectedTarget);
    setForm((prev) => ({
      ...prev,
      datasetName: prev.datasetName || file.name.replace(/\.[^.]+$/, ""),
      samples: rows.length || prev.samples,
    }));

    const predictions = simulateRandomForest(parsed, detectedTarget);
    setIcfesScores(predictions);
    setUploadMessage({
      text: `Archivo listo (${rows.length} filas${
        rows.length === MAX_PREVIEW_ROWS ? " · vista recortada para archivos pesados" : ""
      }). Columna objetivo: ${detectedTarget ?? "no detectada"}.`,
      tone: "success",
    });
  };

  const startTraining = () => {
    if (trainingStatus.running) return;

    if (!uploadedFile || !datasetPreview) {
      setUploadMessage({ text: "Adjunta un Excel o CSV antes de entrenar.", tone: "error" });
      return;
    }

    if (!targetColumn) {
      setUploadMessage({ text: "No se detectó una columna objetivo en el archivo.", tone: "error" });
      return;
    }

    const newRun: TrainingRun = {
      id: Date.now(),
      model: "Random Forest supervisado",
      dataset: form.datasetName,
      accuracy: 0,
      loss: 0,
      status: "En progreso",
      lastUpdate: "Iniciado",
    };

    setRuns((prev) => [newRun, ...prev]);
    setTrainingStatus({ running: true, progress: 0, message: "Entrenando modelo Random Forest..." });
  };

  const resetTraining = () => {
    setTrainingStatus({ running: false, progress: 0, message: "Listo para entrenar" });
    setRuns(baseRuns);
    setUploadedFile(null);
    setUploadMessage({ text: "Arrastra tu Excel o selecciónalo para adjuntarlo", tone: "info" });
    setDatasetPreview(null);
    setTargetColumn(null);
    setIcfesScores([]);
  };

  const handleFileSelection = async (file?: File) => {
    if (!file) return;

    const isExcel = /(\.xlsx|\.xls|\.csv)$/i.test(file.name);
    if (!isExcel) {
      setUploadMessage({ text: "Formato no soportado. Usa Excel o CSV.", tone: "error" });
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    try {
      await readDatasetFile(file);
    } catch (error) {
      console.error(error);
      setUploadMessage({
        text:
          error instanceof Error
            ? `No se pudo leer el archivo: ${error.message}`
            : "No se pudo leer el archivo. Verifica el formato o el contenido.",
        tone: "error",
      });
      setDatasetPreview(null);
      setTargetColumn(null);
      setIcfesScores([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Panel de entrenamiento</p>
            <h1 className="text-2xl font-semibold text-slate-50">Laboratorio de modelos</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-cyan-100">
              <Activity className="h-4 w-4 text-cyan-300" />
              {trainingStatus.running ? "GPU ocupada" : "GPU libre"}
            </div>
            <button
              onClick={resetTraining}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Reiniciar tablero
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Dataset activo</p>
                <p className="text-lg font-semibold">{form.datasetName}</p>
              </div>
              <Database className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Muestras: {form.samples.toLocaleString("es-ES")}</p>
              <p>Optimizer: {form.optimizer}</p>
              <p>Aumentación: {form.augmentation ? "Sí" : "No"}</p>
              <p>Columna objetivo: {targetColumn ?? "-"}</p>
              <p>Filas cargadas: {datasetPreview?.rows.length ?? 0}</p>
              <p className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-cyan-300" />
                {uploadedFile ? `${uploadedFile.name} · ${formatFileSize(uploadedFile.size)}` : "Sin archivo adjunto"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Calidad del dataset</p>
                <p className="text-lg font-semibold">Score {datasetQuality.score}/100</p>
              </div>
              <Layers className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <p className="text-slate-400">Completitud</p>
                <p className="text-base font-semibold text-cyan-200">{Math.round(datasetQuality.completeness * 100)}%</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <p className="text-slate-400">Balance</p>
                <p className="text-base font-semibold text-cyan-200">{Math.round(datasetQuality.classBalance * 100)}%</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <p className="text-slate-400">Metadata</p>
                <p className="text-base font-semibold text-cyan-200">{Math.round(datasetQuality.metadata * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Estatus</p>
                <p className="text-lg font-semibold">{trainingStatus.message}</p>
              </div>
              {trainingStatus.running ? (
                <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                style={{ width: `${trainingStatus.progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {trainingStatus.running
                ? "Entrenamiento en curso. Se actualizarán métricas automáticamente."
                : "Configura los parámetros y lanza un nuevo entrenamiento."}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Configuración</p>
                <h2 className="text-xl font-semibold text-slate-50">Hiperparámetros del entrenamiento</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-cyan-300" />
            </div>

            <div
              className={`mt-4 rounded-xl border-2 border-dashed p-4 transition ${
                uploadMessage.tone === "success"
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : uploadMessage.tone === "error"
                    ? "border-rose-500/60 bg-rose-500/5"
                    : "border-slate-700 bg-slate-950/60"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelection(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Carga de dataset</p>
                  <p className="text-sm text-slate-200">Adjunta tu Excel o CSV para lanzar el entrenamiento.</p>
                  <p
                    className={`text-xs ${
                      uploadMessage.tone === "success"
                        ? "text-emerald-300"
                        : uploadMessage.tone === "error"
                          ? "text-rose-300"
                          : "text-slate-400"
                    }`}
                  >
                    {uploadMessage.text}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {uploadedFile && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
                      <p className="font-semibold">{uploadedFile.name}</p>
                      <p className="text-slate-400">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500/90 px-3 py-2 text-sm font-medium text-slate-950 shadow-lg transition hover:brightness-110">
                    <Upload className="h-4 w-4" />
                    Seleccionar archivo
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => handleFileSelection(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            </div>

            {datasetPreview && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Columna objetivo detectada</p>
                    <p className="text-base font-semibold text-emerald-200">{targetColumn ?? "No identificada"}</p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {datasetPreview.rows.length} filas · {datasetPreview.headers.length} columnas
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead>
                      <tr className="text-left text-slate-400">
                        {datasetPreview.headers.slice(0, 6).map((header) => (
                          <th key={header} className="py-2 pr-4 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {datasetPreview.rows.slice(0, 4).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {datasetPreview.headers.slice(0, 6).map((header) => (
                            <td key={header} className="py-2 pr-4">
                              {String(row[header] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-200">
                <span>Nombre del dataset</span>
                <input
                  value={form.datasetName}
                  onChange={(e) => setForm((prev) => ({ ...prev, datasetName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span>Número de muestras</span>
                <input
                  type="number"
                  value={form.samples}
                  onChange={(e) => setForm((prev) => ({ ...prev, samples: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span>Learning rate</span>
                <input
                  type="number"
                  step="0.0001"
                  value={form.learningRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, learningRate: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span>Épocas</span>
                <input
                  type="number"
                  value={form.epochs}
                  onChange={(e) => setForm((prev) => ({ ...prev, epochs: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span>Modelo</span>
                <input
                  value={form.optimizer}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-400"
                />
                <p className="text-xs text-slate-500">El flujo está fijado a Random Forest para garantizar consistencia.</p>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.augmentation}
                  onChange={(e) => setForm((prev) => ({ ...prev, augmentation: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-500"
                />
                Aumentación de datos activada
              </label>
            </div>

            <label className="mt-4 block space-y-1 text-sm text-slate-200">
              <span>Notas para el experimento</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-[100px] w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={startTraining}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={trainingStatus.running}
              >
                <Play className="h-4 w-4" /> Lanzar entrenamiento
              </button>
              <p className="text-xs text-slate-400">
                Ajusta los parámetros y lanza. El tablero simula métricas y registra el historial.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Salud del pipeline</p>
                  <h3 className="text-lg font-semibold">Checklist rápido</h3>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                {checklist.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Alertas</p>
                  <h3 className="text-lg font-semibold">Señales a revisar</h3>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>🔎 Revisa ejemplos clase minoritaria (balance 82%).</li>
                <li>📦 Evalúa reducción de tamaño de lote para ahorrar VRAM.</li>
                <li>🧪 Programa experimento ablation con LR 0.0008.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Resultados</p>
                  <h3 className="text-lg font-semibold">Predicción de puntajes ICFES</h3>
                </div>
                <BarChart3 className="h-5 w-5 text-cyan-300" />
              </div>
              {icfesScores.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                  Adjunta tu Excel con la columna objetivo para ver pronósticos por estudiante.
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-xs text-slate-200">
                  {icfesScores.slice(0, 6).map((score) => (
                    <div
                      key={score.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-slate-300">{score.estudiante}</span>
                        {score.real !== null && score.real !== undefined && (
                          <span className="text-[11px] text-emerald-300">
                            Objetivo real: {score.real}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Puntaje estimado</p>
                        <p className="text-base font-semibold text-cyan-200">{score.prediccion} / 500</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Historial</p>
                <h2 className="text-xl font-semibold">Ejecuciones recientes</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Completado
                </div>
                <div className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> En progreso
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 hover:border-cyan-500/40"
                >
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <div>
                      <p className="font-semibold">{run.model}</p>
                      <p className="text-xs text-slate-400">{run.dataset}</p>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                        run.status === "Completado"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : run.status === "En progreso"
                            ? "bg-cyan-500/20 text-cyan-100"
                            : "bg-slate-700/60 text-slate-200"
                      }`}
                    >
                      {run.status}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-300">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-400">Accuracy</p>
                      <p className="text-lg font-semibold text-emerald-200">
                        {run.accuracy ? `${(run.accuracy * 100).toFixed(1)}%` : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-400">Loss</p>
                      <p className="text-lg font-semibold text-amber-200">
                        {run.loss ? run.loss.toFixed(2) : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-400">Actualizado</p>
                      <p className="text-lg font-semibold text-cyan-200">{run.lastUpdate}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Registros</p>
                <h2 className="text-xl font-semibold">Resumen del experimento</h2>
              </div>
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
              <p>• Épocas planificadas: {form.epochs}</p>
              <p>• LR inicial: {form.learningRate}</p>
              <p>• Último estado: {trainingStatus.message}</p>
              <p>• Notas: {form.notes || "Sin notas"}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-slate-400">Checkpoint seguro</p>
                <p className="text-emerald-200">Auto-save cada 3 épocas</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-slate-400">Early stopping</p>
                <p className="text-amber-200">Activado por paciencia de 4</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-slate-400">Batch size</p>
                <p className="text-cyan-200">32 (ajustable)</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-slate-400">Validación</p>
                <p className="text-emerald-200">20% holdout</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
