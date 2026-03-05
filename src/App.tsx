import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { type ReactNode, useRef, useState, useCallback } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import type { CleanedResult } from './types';
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
  'HEIC images are re-encoded as JPEG at 100% quality.',
  <NotesWithLinks key="notes-links" />,
];

/** Wraps mime types (e.g. image/jpeg) and filenames (after " on ") in <pre> for fixed-width styling. */
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

function ResultAccordionItem({ result, index }: { result: CleanedResult; index: number }) {
  const hasImageData = (result.origImage?.imageData ?? '') !== '' || (result.cleanedImage?.imageData ?? '') !== '';
  return (
    <Accordion.Item eventKey={index.toString()} className={resultStatusClass(result)}>
      <Accordion.Header>{result.origImage.filename}</Accordion.Header>
      <Accordion.Body>
        <div>
          {makeCard('Error(s)', result.errors.map(styleMessage), 'text-danger')}
          {makeCard('Warning(s)', result.warnings.map(styleMessage), 'text-warning')}
          {makeCard('Info', result.info.map(styleMessage), 'text-info')}
          <div className="grid-container">
            <div className="grid-item"><h6 className="my-0">Original</h6></div>
            <div className="grid-item"><h6 className="my-0">Cleaned</h6></div>
            {hasImageData && (
              <>
                <div className="grid-item">{result.origImage.imageData ? <img src={`data:${result.origImage.mimeType};base64,${result.origImage.imageData}`} alt="Original" /> : null}</div>
                <div className="grid-item">{result.cleanedImage.imageData ? <img src={`data:${result.cleanedImage.mimeType};base64,${result.cleanedImage.imageData}`} alt="Cleaned" /> : null}</div>
              </>
            )}
            <div className="grid-item"><pre>{result.origImage.tags}</pre></div>
            <div className="grid-item"><pre>{result.cleanedImage.tags}</pre></div>
          </div>
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
    setProgress({ current: 0, total: files.length });
    const loadImageData = loadMediaRef.current?.checked ?? true;
    const cleanedResults = await processFiles(files, loadImageData, (current, total) => setProgress({ current, total }));
    setProgress({ current: 0, total: 0 });

    console.log(cleanedResults);
    setCleanedResults(cleanedResults);
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

      <div className="d-flex align-items-center gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={onChooseFiles}>
          Choose files to clean...
        </button>
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
              <ResultAccordionItem key={index.toString()} result={result} index={index} />
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default App;
