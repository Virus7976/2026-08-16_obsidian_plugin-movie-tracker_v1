import React, { useRef, useState } from 'react';

export default function Dropzone({ onFiles, busy }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <section
      className={`dropzone${over ? ' over' : ''}${busy ? ' busy' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      <button type="button" className="primary" onClick={() => input.current?.click()}>
        Choose a PDF
      </button>
      <p className="hint">or drop files here — several at once is fine</p>
    </section>
  );
}
