import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import Accordion from 'react-bootstrap/Accordion';

import { processFiles } from './clean';
import { ResultAccordionItem } from './ResultAccordionItem';
import type { CleanedResult, SaveMode } from './types';

function matchesSearch(result: CleanedResult, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const searchable = [
    result.origImage.filename,
    result.cleanedImage.filename,
    result.origImage.tags ?? '',
    result.cleanedImage.tags ?? '',
    ...result.errors,
    ...result.warnings,
    ...result.info,
  ].join(' ');
  return searchable.toLowerCase().includes(q);
}

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const REPO_URL = 'https://github.com/theotternews/media-metadata-cleaner';

type AccordionKey = string | string[] | undefined;
const toAccordionKey = (k: string | string[] | null | undefined): AccordionKey =>
  k === null || k === undefined ? undefined : k;

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function NotesWithLinks() {
  const openInBrowser = (url: string) => () => { openUrl(url); };
  return (
    <>
      <button type="button" className="btn btn-link p-0 text-primary text-decoration-underline" onClick={openInBrowser(`${REPO_URL}/issues`)}>Report a problem</button>
      , or view the{' '}
      <button type="button" className="btn btn-link p-0 text-primary text-decoration-underline" onClick={openInBrowser(REPO_URL)}>source code</button>.
    </>
  );
}

const NOTES: ReactNode[] = [
  'All processing is done locally, no data is uploaded.',
  'This tool will do weird things if the image filename has the wrong extension (e.g., a JPEG named as \'.png\').',
  <NotesWithLinks key="notes-links" />,
];

function makeCardPara(para: ReactNode, index: number) {
  return <p key={index} className="card-text">{para}</p>;
}

// ---------------------------------------------------------------------------
// OptionsCard
// ---------------------------------------------------------------------------

interface OptionsCardProps {
  skipCleaning: boolean;
  onSkipCleaningChange: (value: boolean) => void;
  saveMode: SaveMode;
  onSaveModeChange: (value: SaveMode) => void;
  saveDirectory: string;
  onSaveDirectoryChange: (value: string) => void;
  chosenDirectory: string | null;
  loadMediaRef: React.RefObject<HTMLInputElement | null>;
}

function OptionsCard({
  skipCleaning, onSkipCleaningChange,
  saveMode, onSaveModeChange,
  saveDirectory, onSaveDirectoryChange,
  chosenDirectory,
  loadMediaRef,
}: OptionsCardProps) {
  const handleDirectoryChange = async (value: string) => {
    if (value === 'choose-directory') {
      const dir = await open({ directory: true, multiple: false });
      onSaveDirectoryChange(dir != null ? dir : 'same-directory');
    } else {
      onSaveDirectoryChange(value);
    }
  };

  return (
    <div className="card mb-4">
      <div className="accordion-style-header">Options</div>
      <div className="card-body">
        <div className="form-check">
          <input ref={loadMediaRef} className="form-check-input" type="checkbox" id="showMedia" defaultChecked />
          <label className="form-check-label" htmlFor="showMedia">
            Show media (uncheck when processing many media files at once)
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="skipCleaning"
            checked={skipCleaning}
            onChange={(e) => onSkipCleaningChange(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="skipCleaning">
            View metadata only (don&apos;t clean)
          </label>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap mb-0">
          <label htmlFor="saveMode" className="form-label mb-0">Save cleaned file </label>
          <select
            id="saveMode"
            className="form-select form-select-sm w-auto"
            value={saveMode}
            onChange={(e) => onSaveModeChange(e.target.value as SaveMode)}
            disabled={skipCleaning}
          >
            <option value="cleaned-suffix">as new file, adding &apos;-cleaned&apos;</option>
            <option value="original-filename">as original filename (may overwrite original)</option>
            <option value="random-filename">as file with new, random filename</option>
          </select>
          <span className="mb-0">in the</span>
          <select
            id="saveDirectory"
            className="form-select form-select-sm w-auto"
            value={saveDirectory}
            onChange={(e) => handleDirectoryChange(e.target.value)}
            disabled={skipCleaning}
          >
            <option value="same-directory">same</option>
            {chosenDirectory != null && (
              <option value={chosenDirectory}>{chosenDirectory.split(/[/\\]/).filter(Boolean).pop() ?? chosenDirectory}</option>
            )}
            <option value="choose-directory">choose...</option>
          </select>
          <span className="mb-0">folder.</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionBar
// ---------------------------------------------------------------------------

interface ActionBarProps {
  onChooseFiles: () => void;
  onCancel: () => void;
  onProcess: () => void;
  isProcessing: boolean;
  processingCount: number;
  selectedCount: number;
  hasResults: boolean;
}

function ActionBar({ onChooseFiles, onCancel, onProcess, isProcessing, processingCount, selectedCount, hasResults }: ActionBarProps) {
  const canClear = !isProcessing && (selectedCount > 0 || hasResults);
  const processButtonText = isProcessing
    ? `Processing ${processingCount} file${processingCount === 1 ? '' : 's'}...`
    : selectedCount > 0
      ? `Process ${selectedCount} file${selectedCount === 1 ? '' : 's'}`
      : 'Process';
  return (
    <div className="mb-4 d-flex align-items-center gap-2">
      <button type="button" className="btn btn-primary" onClick={onChooseFiles} disabled={isProcessing}>
        Choose media files...
      </button>
      <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={!isProcessing && !canClear}>
        {isProcessing ? 'Cancel' : canClear ? 'Clear' : 'Cancel'}
      </button>
      <button
        type="button"
        className={`btn ${selectedCount > 0 ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={onProcess}
        disabled={selectedCount === 0 || isProcessing}
      >
        {processButtonText}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [cleanedResults, setCleanedResults] = useState<CleanedResult[]>([]);
  const [notesActiveKey, setNotesActiveKey] = useState<AccordionKey>('0');
  const [resultsActiveKey, setResultsActiveKey] = useState<AccordionKey>(undefined);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [lastRunSkipCleaning, setLastRunSkipCleaning] = useState(false);
  const [lastRunOutputDir, setLastRunOutputDir] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>('cleaned-suffix');
  const [saveDirectory, setSaveDirectory] = useState('same-directory');
  const [chosenDirectory, setChosenDirectory] = useState<string | null>(null);
  const [skipCleaning, setSkipCleaning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const loadMediaRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isProcessing = progress.total > 0;
  const selectedCount = selectedFiles?.length ?? 0;

  const onChooseFiles = useCallback(async () => {
    const files = await open({ multiple: true, directory: false });
    if (files != null) {
      setSelectedFiles(Array.isArray(files) ? files : [files]);
    }
  }, []);

  const onProcess = useCallback(async () => {
    if (!selectedFiles?.length) return;
    setNotesActiveKey(undefined);
    setResultsActiveKey(undefined);
    setResultsSearchQuery('');
    setCleanedResults([]);
    setProgress({ current: 0, total: selectedFiles.length });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const loadImageData = loadMediaRef.current?.checked ?? true;
    setLastRunSkipCleaning(skipCleaning);
    const outputDir = saveDirectory === 'same-directory' ? null : (saveDirectory === 'choose-directory' ? chosenDirectory : saveDirectory);
    setLastRunOutputDir(outputDir);
    try {
      const results = await processFiles(
        selectedFiles,
        { loadImageData, saveMode, skipCleaning, outputDir },
        (current, total) => setProgress({ current, total }),
        controller.signal,
      );
      setCleanedResults(results);
      setSelectedFiles(null);
    } finally {
      abortControllerRef.current = null;
      setProgress({ current: 0, total: 0 });
    }
  }, [selectedFiles, skipCleaning, saveMode, saveDirectory, chosenDirectory]);

  const onCancel = useCallback(() => {
    if (isProcessing) {
      abortControllerRef.current?.abort();
    } else {
      setSelectedFiles(null);
      setCleanedResults([]);
      setResultsSearchQuery('');
      setProgress({ current: 0, total: 0 });
    }
  }, [isProcessing]);

  const handleSaveDirectoryChange = useCallback((value: string) => {
    if (value === 'same-directory') {
      setSaveDirectory('same-directory');
      setChosenDirectory(null);
    } else {
      setChosenDirectory(value);
      setSaveDirectory(value);
    }
  }, []);

  return (
    <div>
      <h1 className="my-4">Media Metadata Cleaner</h1>

      <Accordion className="mb-4" id="notesAccordion" activeKey={notesActiveKey} onSelect={(k) => setNotesActiveKey(toAccordionKey(k))}>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Notes</Accordion.Header>
          <Accordion.Body>
            {NOTES.map((para, i) => makeCardPara(para, i))}
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <OptionsCard
        skipCleaning={skipCleaning}
        onSkipCleaningChange={setSkipCleaning}
        saveMode={saveMode}
        onSaveModeChange={setSaveMode}
        saveDirectory={saveDirectory}
        onSaveDirectoryChange={handleSaveDirectoryChange}
        chosenDirectory={chosenDirectory}
        loadMediaRef={loadMediaRef}
      />

      <ActionBar
        onChooseFiles={onChooseFiles}
        onCancel={onCancel}
        onProcess={onProcess}
        isProcessing={isProcessing}
        processingCount={progress.total}
        selectedCount={selectedCount}
        hasResults={cleanedResults.length > 0}
      />

      {isProcessing && (
        <div className="mt-3">
          <div className="progress" role="progressbar" aria-valuenow={progress.current} aria-valuemin={0} aria-valuemax={progress.total}>
            <div
              className="progress-bar"
              style={{ width: `${progress.total ? (100 * progress.current) / progress.total : 0}%` }}
            />
          </div>
          <div className="text-center mt-1">{progress.current} / {progress.total}</div>
        </div>
      )}

      {cleanedResults.length > 0 && (
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap my-4">
            <h5 className="mb-0">Results</h5>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search results..."
              value={resultsSearchQuery}
              onChange={(e) => setResultsSearchQuery(e.target.value)}
              style={{ maxWidth: '16rem' }}
              aria-label="Search results"
            />
            {resultsSearchQuery.trim() && (
              <span className="text-muted small">
                {cleanedResults.filter((r) => matchesSearch(r, resultsSearchQuery)).length} of {cleanedResults.length}
              </span>
            )}
          </div>
          <Accordion id="resultsAccordion" activeKey={resultsActiveKey} onSelect={(k) => setResultsActiveKey(toAccordionKey(k))}>
            {cleanedResults
              .map((result, index) => ({ result, index }))
              .filter(({ result }) => matchesSearch(result, resultsSearchQuery))
              .map(({ result, index }) => (
                <ResultAccordionItem key={index} result={result} index={index} skipCleaning={lastRunSkipCleaning} outputDir={lastRunOutputDir} searchQuery={resultsSearchQuery} />
              ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default App;
