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
  const [form, setForm] = useState({
    datasetName: "Dataset de cámaras",
    samples: 12500,
    learningRate: 0.001,
    epochs: 15,
    optimizer: "AdamW",
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
              updated[0] = {
                ...updated[0],
                status: "Completado",
                accuracy: 0.9 + Math.random() * 0.05,
                loss: 0.15 + Math.random() * 0.08,
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
              ? "Entrenamiento completado"
              : "Procesando épocas y métricas...",
        };
      });
    }, 800);

    return () => clearInterval(timer);
  }, [trainingStatus.running]);

  const datasetQuality = useMemo(() => {
    const completeness = 0.94;
    const classBalance = 0.82;
    const metadata = 0.89;
    const score = Math.round((completeness + classBalance + metadata) / 3 * 100);
    return { completeness, classBalance, metadata, score };
  }, []);

  const startTraining = () => {
    if (trainingStatus.running) return;

    const newRun: TrainingRun = {
      id: Date.now(),
      model: "Entrenamiento supervisado",
      dataset: form.datasetName,
      accuracy: 0,
      loss: 0,
      status: "En progreso",
      lastUpdate: "Iniciado",
    };

    setRuns((prev) => [newRun, ...prev]);
    setTrainingStatus({ running: true, progress: 0, message: "Inicializando GPU..." });
  };

  const resetTraining = () => {
    setTrainingStatus({ running: false, progress: 0, message: "Listo para entrenar" });
    setRuns(baseRuns);
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
                <span>Optimizador</span>
                <select
                  value={form.optimizer}
                  onChange={(e) => setForm((prev) => ({ ...prev, optimizer: e.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option>AdamW</option>
                  <option>SGD con momentum</option>
                  <option>RMSProp</option>
                </select>
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
