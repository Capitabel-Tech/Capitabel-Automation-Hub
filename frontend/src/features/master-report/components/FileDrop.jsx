import { useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet } from 'lucide-react'

export default function FileDrop({ file, onSelect, accept = '.xlsx,.xlsm', label }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  function handleFiles(fileList) {
    const picked = fileList?.[0]
    if (picked) onSelect(picked)
  }

  return (
    <div
      className={`dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      
      {!file && <UploadCloud size={48} className="dropzone-icon" strokeWidth={1.5} />}
      
      {file ? (
        <div className="dropzone-file">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <FileSpreadsheet size={24} color="var(--accent)" />
            <span className="file-chip">{file.name}</span>
          </div>
          <span className="dropzone-sub">Click or drop to replace</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="dropzone-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {label || 'Click to browse, or drop a file here'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <FileSpreadsheet size={16} color="var(--primary)" />
            <span className="dropzone-sub" style={{ margin: 0, fontWeight: 600 }}>Excel (.xlsx, .xlsm)</span>
          </div>
        </div>
      )}
    </div>
  )
}
