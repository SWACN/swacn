import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquareTerminal, XCircle } from 'lucide-react';
import { getAuthToken, fetchCasts, fetchCastDetails } from '../lib/api';
import { TarBuilder } from '../lib/TarBuilder';

interface Props {
  isOpen: boolean;
  editCastId?: string | null;
  onClose: () => void;
}

export function ProjectCreatorModal({ isOpen, editCastId, onClose }: Props) {
  const [createProjectName, setCreateProjectName] = useState('');
  const [createEnvVars, setCreateEnvVars] = useState('');
  const [createTools, setCreateTools] = useState('');
  const [createFiles, setCreateFiles] = useState<FileList | null>(null);
  const [createRecordingFile, setCreateRecordingFile] = useState<File | null>(null);
  const [existingBaseline, setExistingBaseline] = useState<string | null>(null);
  const [existingRecording, setExistingRecording] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isOpen && editCastId) {
      fetchCastDetails(editCastId)
        .then(details => {
          setCreateProjectName(prev => prev || details.name || '');
        })
        .catch(err => console.error("Failed to fetch cast details for edit", err));

      fetch(`/uploads/${editCastId}/manifest.json`)
        .then(res => res.json())
        .then(data => {
          setCreateProjectName(prev => prev || data.project || data.environment?.project || '');
          const env = data.env || data.environment?.env || {};
          setCreateEnvVars(Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'));
          const binaries = data.binaries?.x86_32 || data.environment?.binaries?.x86_32 || 
                           data.binaries?.i386 || data.environment?.binaries?.i386 || 
                           data.binaries?.x86_64 || data.environment?.binaries?.x86_64 || [];
          setCreateTools(binaries.map((b: any) => `${b.name}=${b.url}`).join('\n'));
          setExistingBaseline(data.baseline || null);
          setExistingRecording(data.recording || null);
        })
        .catch(err => console.error("Failed to fetch manifest for edit", err));
    } else if (isOpen) {
      setCreateProjectName('');
      setCreateEnvVars('');
      setCreateTools('');
      setCreateFiles(null);
      setCreateRecordingFile(null);
      setExistingBaseline(null);
      setExistingRecording(null);
      setUploadError(null);
    }
  }, [isOpen, editCastId]);

  if (!isOpen) return null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProjectName.trim()) {
      setUploadError("Project Name is required.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Not authenticated. Please authenticate your CLI or sign in.");

      if (!editCastId) {
        const casts = await fetchCasts();
        if (casts.length >= 15) {
          throw new Error("Project limit reached. You have 15 active projects.");
        }
      }

      const manifest: any = {
        version: "0.1.0",
        timestamp: Math.floor(Date.now() / 1000),
        environment: {
          project: createProjectName,
          env: {},
          binaries: { x86_32: [] }
        }
      };

      if (editCastId) {
        if (existingBaseline) manifest.baseline = existingBaseline;
        if (existingRecording) manifest.recording = existingRecording;
      }

      if (createEnvVars.trim()) {
        createEnvVars.split('\n').forEach(line => {
          const [k, ...v] = line.split('=');
          if (k && v.length) manifest.environment.env[k.trim()] = v.join('=').trim();
        });
      }

      if (createTools.trim()) {
        createTools.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            let name, url;
            const eqIndex = trimmedLine.indexOf('=');
            if (eqIndex > 0) {
              name = trimmedLine.substring(0, eqIndex).trim();
              url = trimmedLine.substring(eqIndex + 1).trim();
            } else {
              url = trimmedLine;
              name = url.split('/').pop() || 'tool';
            }
            manifest.environment.binaries.x86_32.push({
              name,
              url
            });
          }
        });
      }

      const formData = new FormData();
      let totalSize = 0;

      if (createFiles && createFiles.length > 0) {
        manifest.baseline = "baseline.tar.gz";
        const builder = new TarBuilder();
        
        for (let i = 0; i < createFiles.length; i++) {
          const file = createFiles[i];
          const relativePath = file.webkitRelativePath || file.name;
          const pathParts = relativePath.split('/');
          if (pathParts.length > 1) pathParts.shift();
          const finalPath = pathParts.join('/') || relativePath;

          const buffer = await file.arrayBuffer();
          builder.addFile(finalPath, new Uint8Array(buffer));
        }

        const tarBlob = builder.build();
        
        if (typeof CompressionStream !== 'undefined') {
          const compressedStream = tarBlob.stream().pipeThrough(new CompressionStream('gzip'));
          const gzipBlob = await new Response(compressedStream).blob();
          totalSize += gzipBlob.size;
          formData.append('baseline', gzipBlob, 'baseline.tar.gz');
        } else {
          throw new Error("Browser does not support CompressionStream");
        }
      }

      if (createRecordingFile) {
        totalSize += createRecordingFile.size;
        formData.append('recording', createRecordingFile, 'recording.cast');
      }

      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      totalSize += manifestBlob.size;

      if (totalSize > 2 * 1024 * 1024) {
        throw new Error("Project size exceeds the 2 MB limit.");
      }

      formData.append('manifest', manifestBlob, 'manifest.json');

      let castId = editCastId;
      if (editCastId) {
        const { updateCastUpload } = await import('../lib/api');
        await updateCastUpload(editCastId, formData);
        
        try {
          if ('caches' in window) {
            const cache = await caches.open('swacn-assets-v1');
            await cache.delete(`/uploads/${editCastId}/baseline.tar.gz`);
            await cache.delete(`/uploads/${editCastId}/manifest.json`);
            await cache.delete(`/uploads/${editCastId}/recording.cast`);
            await cache.delete(`/dev-proxy?url=${encodeURIComponent(`/uploads/${editCastId}/baseline.tar.gz`)}`);
          }
        } catch (e) {
          console.error("Cache clear failed", e);
        }
      } else {
        const res = await fetch('/api/v1/casts/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        castId = data.cast_id;
      }

      setCreateProjectName('');
      setCreateEnvVars('');
      setCreateTools('');
      setCreateFiles(null);
      setCreateRecordingFile(null);
      onClose();
      window.dispatchEvent(new CustomEvent('project-created'));
      if (castId) {
        if (editCastId) {
          window.location.reload();
        } else {
          navigate(`/lab/${castId}`);
        }
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
      <div className="bg-background border-4 border-on-surface w-full max-w-2xl hard-shadow overflow-hidden flex flex-col max-h-full">
        <div className="bg-on-surface p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-background font-mono text-sm font-bold">
            <SquareTerminal size={18} />
            <span>{editCastId ? "EDIT_SWACN_PROJECT" : "NEW_SWACN_PROJECT"}</span>
          </div>
          <button onClick={onClose} className="text-background hover:text-primary">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          <h2 className="font-headline text-3xl font-black uppercase mb-4 tracking-tighter">{editCastId ? "Edit Project" : "Create Project"}</h2>
          
          {uploadError && (
            <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 mb-6 font-mono text-sm font-bold">
              {uploadError}
            </div>
          )}

          <form onSubmit={handleCreateProject} className="space-y-6">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Project Name</label>
              <input 
                type="text" 
                value={createProjectName}
                onChange={(e) => setCreateProjectName(e.target.value)}
                className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors"
                placeholder="my-awesome-project"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Environment Variables (KEY=value)</label>
              <textarea 
                value={createEnvVars}
                onChange={(e) => setCreateEnvVars(e.target.value)}
                className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                placeholder="NODE_ENV=production&#10;DEBUG=true"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Tool Binaries (name=url, one per line)</label>
              <textarea 
                value={createTools}
                onChange={(e) => setCreateTools(e.target.value)}
                className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                placeholder="yq=https://github.com/mikefarah/yq/releases/download/v4.40.5/yq_linux_386"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Filesystem Upload</label>
              <label className={`block w-full bg-surface-container-high border-2 ${editCastId && (!createFiles || createFiles.length === 0) ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-4 cursor-pointer hover:bg-white transition-colors group`}>
                <input 
                  type="file" 
                  // @ts-ignore
                  webkitdirectory="true" 
                  directory=""
                  onChange={(e) => setCreateFiles(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="font-mono font-bold uppercase tracking-widest text-on-surface group-hover:scale-105 transition-transform text-center">
                    {createFiles && createFiles.length > 0 ? "New Folder Selected" : (editCastId ? "Replace Folder" : "Select Folder")}
                  </span>
                  
                  {createFiles && createFiles.length > 0 ? (
                    <span className="text-xs opacity-70 font-mono text-primary font-bold">
                      {createFiles[0].webkitRelativePath ? createFiles[0].webkitRelativePath.split('/')[0] : 'Project'} ({createFiles.length} files)
                    </span>
                  ) : (editCastId && (
                    <span className="text-xs opacity-50 font-mono">
                      Leave empty to keep existing
                    </span>
                  ))}
                </div>
              </label>
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Terminal Recording (.cast file)</label>
              <label className={`block w-full bg-surface-container-high border-2 ${editCastId && !createRecordingFile ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-4 cursor-pointer hover:bg-white transition-colors group`}>
                <input 
                  type="file" 
                  accept=".cast"
                  onChange={(e) => setCreateRecordingFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="font-mono font-bold uppercase tracking-widest text-on-surface group-hover:scale-105 transition-transform text-center">
                    {createRecordingFile ? "New Recording Selected" : (editCastId ? "Replace Recording" : "Select Recording")}
                  </span>
                  
                  {createRecordingFile ? (
                    <span className="text-xs opacity-70 font-mono text-primary font-bold">
                      {createRecordingFile.name}
                    </span>
                  ) : (editCastId && (
                    <span className="text-xs opacity-50 font-mono">
                      Leave empty to keep existing
                    </span>
                  ))}
                </div>
              </label>
            </div>

            <div className="pt-6">
              <button 
                type="submit"
                disabled={isUploading}
                className={`w-full border-4 border-on-surface px-8 py-4 text-xl font-bold transition-none hard-shadow flex items-center justify-center gap-4 ${isUploading ? 'bg-surface-container-high text-on-surface/50 cursor-not-allowed' : 'bg-primary text-white hover:translate-x-[4px] hover:translate-y-[4px]'}`}
              >
                {isUploading ? 'Building Sandbox...' : (editCastId ? 'Update Project' : 'Create Project')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
