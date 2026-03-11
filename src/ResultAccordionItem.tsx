import React, { type CSSProperties, type ReactNode } from 'react';
import Accordion from 'react-bootstrap/Accordion';

import type { CleanedResult } from './types';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): ReactNode {
  if (!query.trim()) return text;
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<mark key={key++} className="search-highlight">{match[1]}</mark>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function highlightInNode(node: ReactNode, query: string): ReactNode {
  if (!query.trim()) return node;
  if (typeof node === 'string' || typeof node === 'number') {
    return highlightText(String(node), query);
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => <React.Fragment key={i}>{highlightInNode(child, query)}</React.Fragment>);
  }
  if (React.isValidElement(node) && node.props.children != null) {
    return React.cloneElement(node, {}, highlightInNode(node.props.children, query));
  }
  return node;
}

const INLINE_PRE_CLASS = 'd-inline mb-0 p-0 font-monospace border-0 bg-transparent';

const METADATA_LINE_STYLE: CSSProperties = {
  fontWeight: 400,
  fontFamily: '"Consolas", "Monaco", "Liberation Mono", "Courier New", monospace',
  margin: 0,
  whiteSpace: 'nowrap',
  fontSynthesis: 'none',
  textRendering: 'geometricPrecision',
};

function MetadataBlock({ text, highlightQuery }: { text: string; highlightQuery?: string }) {
  const lines = (text ?? '').split('\n');
  return (
    <div className="metadata-tags" data-metadata-block style={METADATA_LINE_STYLE}>
      {lines.map((line, i) => (
        <div key={i} style={METADATA_LINE_STYLE}>
          {highlightQuery ? highlightText(line || '\u00A0', highlightQuery) : (line || '\u00A0')}
        </div>
      ))}
    </div>
  );
}

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

function makeCard(title: string, paras: (string | ReactNode)[], extraTitleClassNames = '', highlightQuery?: string): ReactNode {
  if (paras.length === 0) return null;
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className={`card-title ${extraTitleClassNames}`}>{title}</h5>
        {paras.map((para, i) => (
          <p key={i} className="card-text">
            {highlightQuery ? highlightInNode(para, highlightQuery) : para}
          </p>
        ))}
      </div>
    </div>
  );
}

function resultStatusClass(result: CleanedResult): string {
  if (result.errors.length > 0) return 'accordion-item-has-error';
  if (result.warnings.length > 0) return 'accordion-item-has-warning';
  return 'accordion-item-has-success';
}

export interface ResultAccordionItemProps {
  result: CleanedResult;
  index: number;
  skipCleaning: boolean;
  outputDir: string | null;
  searchQuery?: string;
}

export function ResultAccordionItem({ result, index, skipCleaning, outputDir, searchQuery = '' }: ResultAccordionItemProps) {
  const hasOrigImage = (result.origImage?.imageData ?? '') !== '';
  const hasCleanedImage = (result.cleanedImage?.imageData ?? '') !== '';
  const hasOrigTags = (result.origImage?.tags ?? '').trim() !== '';
  const hasCleanedTags = (result.cleanedImage?.tags ?? '').trim() !== '';
  const hasOriginalData = hasOrigImage || hasOrigTags;
  const hasCleanedData = hasCleanedImage || hasCleanedTags;
  const hasImageData = hasOrigImage || hasCleanedImage;
  const showOriginalColumn = hasOriginalData;
  const showCleanedColumn = !skipCleaning && hasCleanedData;
  const showWrittenFilename = !skipCleaning && result.cleanedImage.filename;
  const outputDirFolderName = outputDir ? (outputDir.split(/[/\\]/).filter(Boolean).pop() ?? outputDir) : null;
  const writtenPath = outputDirFolderName ? `${outputDirFolderName}/${result.cleanedImage.filename}` : result.cleanedImage.filename;
  const headerTitle = showWrittenFilename ? `${result.origImage.filename} → ${writtenPath}` : result.origImage.filename;
  const singleColumn = !showCleanedColumn;
  const q = searchQuery.trim();

  return (
    <Accordion.Item eventKey={index.toString()} className={resultStatusClass(result)}>
      <Accordion.Header>{q ? highlightText(headerTitle, searchQuery) : headerTitle}</Accordion.Header>
      <Accordion.Body>
        <div>
          {makeCard('Error(s)', result.errors.map(styleMessage), 'text-danger', searchQuery)}
          {makeCard('Warning(s)', result.warnings.map(styleMessage), 'text-warning', searchQuery)}
          {makeCard('Info', result.info.map(styleMessage), 'text-info', searchQuery)}
          {(showOriginalColumn || showCleanedColumn) && (
            <div className={`metadata-tags-wrap ${singleColumn ? 'grid-container grid-container--single' : 'grid-container'}`}>
              {showOriginalColumn && <div className="grid-item grid-item--header"><h6 className="my-0">Original</h6></div>}
              {showCleanedColumn && <div className="grid-item grid-item--header"><h6 className="my-0">Cleaned</h6></div>}
              {hasImageData && (
                <>
                  {showOriginalColumn && <div className="grid-item">{hasOrigImage ? <img src={`data:${result.origImage.mimeType};base64,${result.origImage.imageData}`} alt="Original" /> : null}</div>}
                  {showCleanedColumn && <div className="grid-item">{hasCleanedImage ? <img src={`data:${result.cleanedImage.mimeType};base64,${result.cleanedImage.imageData}`} alt="Cleaned" /> : null}</div>}
                </>
              )}
              {showOriginalColumn && <div className="grid-item"><MetadataBlock text={result.origImage.tags ?? ''} highlightQuery={q || undefined} /></div>}
              {showCleanedColumn && <div className="grid-item"><MetadataBlock text={result.cleanedImage.tags ?? ''} highlightQuery={q || undefined} /></div>}
            </div>
          )}
        </div>
      </Accordion.Body>
    </Accordion.Item>
  );
}
