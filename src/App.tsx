import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { type ReactNode, useRef, useState, useCallback } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import type { CleanedResult, SaveMode } from './types';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./App.css";
import { processFiles } from './clean';

const REPO_URL = 'https://github.com/theotternews/media-metadata-cleaner';

const INLINE_PRE_CLASS = 'd-inline mb-0 p-0 font-monospace border-0 bg-transparent';

type AccordionKey = string | string[] | undefined;
const toAccordionKey = (k: string | string[] | null | undefined): AccordionKey =>
  k === null || k === undefined ? undefined : k;

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
  'This tool will do weird things if the image filename has the wrong extension (e.g., a JPEG named as \'.png\').',
  <NotesWithLinks key="notes-links" />,
];

function styleMessage(text: string): ReactNode {
  const re = /([\w+-]+\/[\w+-.]+)| on ([\s\S]+?)(?=\.\s|,\s|$)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<pre key={key++} className={INLINE_PRE_CLASS}>{match[1]}</pre>);
    } else if (match[2]) {
      parts.push(<> on <pre key={key++} className={INLINE_PRE_CLASS}>{match[2].trim()}</pre></>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function makeCardPara(para: ReactNode, index: number) {
  return <p key={index} className="card-text">{para}</p>;
}

function makeCard(title: string, paras: (string | ReactNode)[], extraTitleClassNames = ''): ReactNode {
  if (paras.length === 0) return null;
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className={`card-title ${extraTitleClassNames}`}>{title}</h5>
        {paras.map((para, i) => makeCardPara(para, i))}
      </div>
    </div>
  );
}

function resultStatusClass(result: CleanedResult): string {
  if (result.errors.length > 0) return 'accordion-item-has-error';
  if (result.warnings.length > 0) return 'accordion-item-has-warning';
  return 'accordion-item-has-success';
}

function ResultAccordionItem({ result, index, skipCleaning, saveMode }: { result: CleanedResult; index: number; skipCleaning: boolean; saveMode: SaveMode }) {
  const hasOrigImage = (result.origImage?.imageData ?? '') !== '';
  const hasCleanedImage = (result.cleanedImage?.imageData ?? '') !== '';
  const hasOrigTags = (result.origImage?.tags ?? '').trim() !== '';
  const hasCleanedTags = (result.cleanedImage?.tags ?? '').trim() !== '';
  const hasOriginalData = hasOrigImage || hasOrigTags;
  const hasCleanedData = hasCleanedImage || hasCleanedTags;
  const hasImageData = hasOrigImage || hasCleanedImage;
  const showOriginalColumn = hasOriginalData;
  const showCleanedColumn = !skipCleaning && hasCleanedData;
  const showWrittenFilename = !skipCleaning && (saveMode === 'cleaned-suffix' || saveMode === 'random-filename') && result.cleanedImage.filename;
  const headerTitle = showWrittenFilename ? `${result.origImage.filename} → ${result.cleanedImage.filename}` : result.origImage.filename;
  const singleColumn = !showCleanedColumn;
  return (
    <Accordion.Item eventKey={index.toString()} className={resultStatusClass(result)}>
      <Accordion.Header>{headerTitle}</Accordion.Header>
      <Accordion.Body>
        <div>
          {makeCard('Error(s)', result.errors.map(styleMessage), 'text-danger')}
          {makeCard('Warning(s)', result.warnings.map(styleMessage), 'text-warning')}
          {makeCard('Info', result.info.map(styleMessage), 'text-info')}
          {(showOriginalColumn || showCleanedColumn) && (
            <div className={singleColumn ? 'grid-container grid-container--single' : 'grid-container'}>
              {showOriginalColumn && <div className="grid-item grid-item--header"><h6 className="my-0">Original</h6></div>}
              {showCleanedColumn && <div className="grid-item grid-item--header"><h6 className="my-0">Cleaned</h6></div>}
              {hasImageData && (
                <>
                  {showOriginalColumn && <div className="grid-item">{hasOrigImage ? <img src={`data:${result.origImage.mimeType};base64,${result.origImage.imageData}`} alt="Original" /> : null}</div>}
                  {showCleanedColumn && <div className="grid-item">{hasCleanedImage ? <img src={`data:${result.cleanedImage.mimeType};base64,${result.cleanedImage.imageData}`} alt="Cleaned" /> : null}</div>}
                </>
              )}
              {showOriginalColumn && <div className="grid-item"><pre>{result.origImage.tags}</pre></div>}
              {showCleanedColumn && <div className="grid-item"><pre>{result.cleanedImage.tags}</pre></div>}
            </div>
          )}
        </div>
      </Accordion.Body>
    </Accordion.Item>
  );
}

function App() {
  const [cleanedResults, setCleanedResults] = useState<CleanedResult[]>([]);
  const [notesActiveKey, setNotesActiveKey] = useState<AccordionKey>('0');
  const [resultsActiveKey, setResultsActiveKey] = useState<AccordionKey>(undefined);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [lastRunSkipCleaning, setLastRunSkipCleaning] = useState(false);
  const [lastRunSaveMode, setLastRunSaveMode] = useState<SaveMode>('cleaned-suffix');
  const [saveMode, setSaveMode] = useState<SaveMode>('cleaned-suffix');
  const [skipCleaning, setSkipCleaning] = useState(false);
  const loadMediaRef = useRef<HTMLInputElement>(null);

  const onChooseFiles = useCallback(async () => {
    setNotesActiveKey(undefined);
    setResultsActiveKey(undefined);

    const files = await open({
      multiple: true,
      directory: false,
    });
    console.log(files);

    if (files == null) {
        return;
    }
    setCleanedResults([]);
    setProgress({ current: 0, total: files.length });
    const loadImageData = loadMediaRef.current?.checked ?? true;
    setLastRunSkipCleaning(skipCleaning);
    setLastRunSaveMode(saveMode);
    const cleanedResults = await processFiles(
      files,
      { loadImageData, saveMode, skipCleaning },
      (current, total) => setProgress({ current, total })
    );
    setProgress({ current: 0, total: 0 });

    console.log(cleanedResults);
    setCleanedResults(cleanedResults);
  }, [skipCleaning, saveMode]);

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

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Options</h5>
          <div className="form-check">
            <input
              ref={loadMediaRef}
              className="form-check-input"
              type="checkbox"
              id="showMedia"
              defaultChecked
            />
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
              onChange={(e) => setSkipCleaning(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="skipCleaning">
              View metadata only (don&apos;t clean)
            </label>
          </div>
          <div className="d-flex align-items-center gap-2 mb-0">
            <label htmlFor="saveMode" className="form-label mb-0">Save cleaned file:</label>
            <select
              id="saveMode"
              className="form-select form-select-sm w-auto"
              value={saveMode}
              onChange={(e) => setSaveMode(e.target.value as SaveMode)}
              disabled={skipCleaning}
            >
              <option value="cleaned-suffix">as new file, adding '-cleaned'</option>
              <option value="overwrite">overwriting original</option>
              <option value="random-filename">as file with new, random filename</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <button type="button" className="btn btn-primary" onClick={onChooseFiles}>
          Choose media files...
        </button>
      </div>

      {progress.total > 0 && (
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
          <h5 className="my-4">Results</h5>
          <Accordion id="resultsAccordion" activeKey={resultsActiveKey} onSelect={(k) => setResultsActiveKey(toAccordionKey(k))}>
            {cleanedResults.map((result, index) => (
              <ResultAccordionItem key={index.toString()} result={result} index={index} skipCleaning={lastRunSkipCleaning} saveMode={lastRunSaveMode} />
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default App;
