import React, { useEffect, useMemo, useState } from 'react';

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function JobCard({ job, onRead }) {
  const [showChapters, setShowChapters] = useState(false);
  const coverUrl = useMemo(
    () => (job.result?.cover ? URL.createObjectURL(job.result.cover) : null),
    [job.result],
  );
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);

  const report = job.result?.report;

  return (
    <article className={`job ${job.status}`}>
      <div className="job-head">
        <div className="job-name">
          <strong>{report?.title || job.name}</strong>
          <span>{report?.author ? `${report.author} · ` : ''}{kb(job.size)} PDF</span>
        </div>
        {job.status === 'done' && (
          <a className="primary small" href={job.url} download={job.result.filename}>Download</a>
        )}
      </div>

      {(job.status === 'running' || job.status === 'queued') && (
        <div className="progress">
          <div className="bar"><i style={{ width: `${job.percent}%` }} /></div>
          <p>{job.note}</p>
        </div>
      )}

      {job.status === 'error' && <p className="error">Could not convert: {job.note}</p>}

      {job.status === 'done' && report && (
        <div className="result">
          {coverUrl && <img className="cover" src={coverUrl} alt="Cover" />}
          <div className="facts">
            <dl>
              <div><dt>Pages read</dt><dd>{report.pages}</dd></div>
              <div><dt>Chapters</dt><dd>{report.chapters.length}</dd></div>
              <div><dt>Words</dt><dd>{report.counts.words.toLocaleString()}</dd></div>
              <div><dt>Pictures</dt><dd>{report.images}</dd></div>
              <div><dt>EPUB size</dt><dd>{kb(report.size)}</dd></div>
              <div><dt>Cover</dt><dd>{report.coverType}</dd></div>
            </dl>

            <p className="how">
              Chapters came from {report.usedOutline ? "the PDF's own bookmarks" : 'headings found in the layout'}
              {report.counts.figures > 0 && `, ${report.counts.figures} figure${report.counts.figures === 1 ? '' : 's'} placed in the text`}
              {report.counts.notes > 0 && `, ${report.counts.notes} footnote${report.counts.notes === 1 ? '' : 's'} collected`}.
            </p>

            <div className="row">
              <button type="button" className="ghost small" onClick={onRead}>Preview the book</button>
              <button type="button" className="ghost small" onClick={() => setShowChapters((s) => !s)}>
                {showChapters ? 'Hide contents' : 'Show contents'}
              </button>
            </div>

            {showChapters && (
              <ol className="toc">
                {report.chapters.map((c, i) => (
                  <li key={i}><span>{c.title}</span><em>{c.nodes} blocks</em></li>
                ))}
              </ol>
            )}

            {report.warnings.map((w, i) => <p className="warn" key={i}>{w}</p>)}
          </div>
        </div>
      )}
    </article>
  );
}
