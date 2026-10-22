// Diálogos del editor agrupados por tema, cada uno cargado bajo demanda (lazy): el lienzo
// (GrafcetCanvas) solo dice cuál está abierto y qué hacer con el resultado.
import { Suspense, lazy } from 'react'
import { normalizeProject } from '../lib/projectFile'
import { fileName } from '../lib/fileNames'
import { t } from '../lib/i18n'

const ProjectsDialog = lazy(() => import('./ProjectsDialog'))
const ProjectChooser = lazy(() => import('./ProjectChooser'))
const ClassDialog = lazy(() => import('./ClassDialog'))
const NewProjectDialog = lazy(() => import('./NewProjectDialog'))
const PneumaticDialog = lazy(() => import('./PneumaticDialog'))
const ExportDialog = lazy(() => import('./ExportDialog'))
const MoreExportsDialog = lazy(() => import('./MoreExportsDialog'))
const DossierDialog = lazy(() => import('./DossierDialog'))
const ShareDialog = lazy(() => import('./ShareDialog'))
const GuideDialog = lazy(() => import('./GuideDialog'))
const NotebookDialog = lazy(() => import('./NotebookDialog'))
const ExerciseDialog = lazy(() => import('./ExerciseDialog'))
const PcSimuDialog = lazy(() => import('./PcSimuDialog'))

// Los que abren o crean un proyecto (todo lo que había queda en «Trabajos anteriores»):
// - projects: 'examples' | 'recent' | … (Abrir: ejemplos, ejercicios, trabajos anteriores)
// - choosing: { fileName, items } (un PDF con varios proyectos: cuál abrir)
// - classOpen (corregir entregas), newOpen (proyecto nuevo), pneumaticOpen (secuencia neumática)
export function ProjectDialogs({
  projects,
  onProjectsClose,
  onOpenExample,
  onOpenExercise,
  onRestore,
  education,
  choosing,
  onChoosingClose,
  classOpen,
  onClassClose,
  newOpen,
  onNewClose,
  pneumaticOpen,
  onPneumaticClose,
  getProject,
  openLoaded,
  replaceProject,
}) {
  return (
    <>
      {projects && (
        <Suspense fallback={null}>
          <ProjectsDialog
            initialTab={projects}
            onOpenExample={onOpenExample}
            onOpenExercise={onOpenExercise}
            onOpenSolution={(project, title) => {
              replaceProject({ ...normalizeProject(project), name: title }, t('Antes de abrir «{archivo}»', { archivo: title }))
              onProjectsClose()
            }}
            onRestore={onRestore}
            education={education}
            onClose={onProjectsClose}
          />
        </Suspense>
      )}
      {classOpen && (
        <Suspense fallback={null}>
          <ClassDialog getProject={getProject} onOpen={(project, name) => openLoaded(project, `${name}.json`)} onClose={onClassClose} />
        </Suspense>
      )}
      {choosing && (
        <Suspense fallback={null}>
          <ProjectChooser fileName={choosing.fileName} items={choosing.items} onPick={(item) => openLoaded(item.project, choosing.fileName)} onClose={onChoosingClose} />
        </Suspense>
      )}
      {newOpen && (
        <Suspense fallback={null}>
          <NewProjectDialog
            onCreate={(project) => {
              onNewClose()
              replaceProject(normalizeProject(project), t('Antes de crear un proyecto nuevo'))
            }}
            onClose={onNewClose}
          />
        </Suspense>
      )}
      {pneumaticOpen && (
        <Suspense fallback={null}>
          <PneumaticDialog
            onCreate={(project) => {
              onPneumaticClose()
              replaceProject({ ...normalizeProject(project), name: project.name }, t('Antes de generar una secuencia neumática'))
            }}
            onClose={onPneumaticClose}
          />
        </Suspense>
      )}
    </>
  )
}

// Los de Exportar, según format: 'dossier', 'notebook', 'share', 'guide', 'exercise', 'pcsimu',
// 'more' (el diálogo con el resto de formatos, que elige uno con onPick) o un formato de imagen
// o PDF ('svg', 'png', 'pdf'…, con su vista previa).
export function ExportDialogs({
  format,
  onClose,
  nodes,
  edges,
  plc,
  setPlc,
  issues,
  projectName,
  source,
  shareProject,
  onDownload,
  getProject,
  onGenerateGuide,
  onSaveExercise,
  onExportStudent,
  onExportSheet,
  titleBlockProps,
  education,
  onPick,
}) {
  if (!format) return null
  return (
    <Suspense fallback={null}>
      {format === 'dossier' ? (
        <DossierDialog
          nodes={nodes}
          edges={edges}
          plc={plc}
          issues={issues}
          projectName={projectName}
          source={source}
          onChange={(dossier) => setPlc((p) => ({ ...p, dossier }))}
          onClose={onClose}
        />
      ) : format === 'notebook' ? (
        <NotebookDialog getProject={getProject} onClose={onClose} />
      ) : format === 'share' ? (
        <ShareDialog project={shareProject} onDownload={onDownload} onClose={onClose} />
      ) : format === 'pcsimu' ? (
        <PcSimuDialog nodes={nodes} edges={edges} plc={plc} onClose={onClose} />
      ) : format === 'guide' ? (
        <GuideDialog plc={plc} onChange={(guide) => setPlc((p) => ({ ...p, guide }))} onGenerate={onGenerateGuide} onClose={onClose} />
      ) : format === 'exercise' ? (
        <ExerciseDialog plc={plc} getProject={getProject} onSave={onSaveExercise} onExportStudent={onExportStudent} onExportSheet={onExportSheet} onClose={onClose} />
      ) : format === 'more' ? (
        <MoreExportsDialog education={education} onPick={onPick} onClose={onClose} />
      ) : (
        <ExportDialog source={source} initialFormat={format} fileName={(ext) => fileName(ext)} {...titleBlockProps} onClose={onClose} />
      )}
    </Suspense>
  )
}
