import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquareTerminal, XCircle } from 'lucide-react';
import { getAuthToken, fetchCasts, fetchCastDetails } from '../lib/api';
import { TarBuilder } from '../lib/TarBuilder';
import { TarReader } from '../lib/TarReader';

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
  const [createWelcomeMessage, setCreateWelcomeMessage] = useState('');
  const [showWelcomeEditor, setShowWelcomeEditor] = useState(false);
  const [createInitScript, setCreateInitScript] = useState('');
  const [showInitEditor, setShowInitEditor] = useState(false);
  const [deleteWelcome, setDeleteWelcome] = useState(false);
  const [deleteInit, setDeleteInit] = useState(false);
  const [deleteBaseline, setDeleteBaseline] = useState(false);
  const [deleteRecording, setDeleteRecording] = useState(false);
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
      setCreateWelcomeMessage('');
      setShowWelcomeEditor(false);
      setCreateInitScript('');
      setShowInitEditor(false);
      setDeleteWelcome(false);
      setDeleteInit(false);
      setDeleteBaseline(false);
      setDeleteRecording(false);
      setCreateFiles(null);
      setDeleteInit(false);
      setDeleteBaseline(false);
      setDeleteRecording(false);
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

      if ((createFiles && createFiles.length > 0) || (editCastId && (showWelcomeEditor || showInitEditor || deleteWelcome || deleteInit || deleteBaseline))) {
        manifest.baseline = "baseline.tar.gz";
        const builder = new TarBuilder();
        const filesToBundle: Record<string, Uint8Array> = {};

        // Case 1: Fetch existing files if editing
        if (editCastId) {
          const res = await fetch(`/uploads/${editCastId}/baseline.tar.gz`);
          if (res.ok) {
            // @ts-ignore
            const stream = res.body!.pipeThrough(new DecompressionStream('gzip'));
            const decompressed = await new Response(stream).arrayBuffer();
            const existingFiles = TarReader.extractFiles(new Uint8Array(decompressed));
            
            if (!createFiles || createFiles.length === 0) {
              // Not uploading new files
              if (!deleteBaseline) {
                // Keep everything if baseline not deleted
                existingFiles.forEach(f => filesToBundle[f.name] = f.data);
              } else {
                // Baseline deleted, but retain scripts if not explicitly deleted
                const oldWelcome = existingFiles.find(f => f.name === 'welcome.txt')?.data;
                const oldInit = existingFiles.find(f => f.name === 'init.sh')?.data;
                if (oldWelcome && !deleteWelcome) filesToBundle['welcome.txt'] = oldWelcome;
                if (oldInit && !deleteInit) filesToBundle['init.sh'] = oldInit;
              }
            } else {
              // Uploading new files: only pre-seed special files for retention
              const oldWelcome = existingFiles.find(f => f.name === 'welcome.txt')?.data;
              const oldInit = existingFiles.find(f => f.name === 'init.sh')?.data;
              if (oldWelcome && !deleteWelcome) filesToBundle['welcome.txt'] = oldWelcome;
              if (oldInit && !deleteInit) filesToBundle['init.sh'] = oldInit;
            }
          }
        }

        // Case 2: New folder uploaded (if baseline not deleted)
        if (createFiles && createFiles.length > 0 && !deleteBaseline) {
          for (let i = 0; i < createFiles.length; i++) {
            const file = createFiles[i];
            const relativePath = file.webkitRelativePath || file.name;
            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) pathParts.shift();
            const finalPath = pathParts.join('/') || relativePath;

            const buffer = await file.arrayBuffer();
            filesToBundle[finalPath] = new Uint8Array(buffer);
          }
        }

        // Case 3: Apply modal welcome message (highest priority)
        if ((showWelcomeEditor || !editCastId) && createWelcomeMessage.trim() && !deleteWelcome) {
          filesToBundle['welcome.txt'] = new TextEncoder().encode(createWelcomeMessage);
        } else if (deleteWelcome) {
          delete filesToBundle['welcome.txt'];
        }

        // Case 4: Apply modal init script (highest priority)
        if ((showInitEditor || !editCastId) && createInitScript.trim() && !deleteInit) {
          filesToBundle['init.sh'] = new TextEncoder().encode(createInitScript);
        } else if (deleteInit) {
          delete filesToBundle['init.sh'];
        }

        if (Object.keys(filesToBundle).length > 0) {
          Object.entries(filesToBundle).forEach(([path, data]) => {
            builder.addFile(path, data);
          });

          const tarBlob = builder.build();
          
          if (typeof CompressionStream !== 'undefined') {
            const compressedStream = tarBlob.stream().pipeThrough(new CompressionStream('gzip'));
            const gzipBlob = await new Response(compressedStream).blob();
            totalSize += gzipBlob.size;
            formData.append('baseline', gzipBlob, 'baseline.tar.gz');
            manifest.baseline = "baseline.tar.gz";
          } else {
            throw new Error("Browser does not support CompressionStream");
          }
        } else {
          // Everything deleted from baseline
          manifest.baseline = null;
          formData.append('delete_baseline', 'true');
        }
      } else if (deleteBaseline) {
        manifest.baseline = null;
        formData.append('delete_baseline', 'true');
      }

      if (deleteRecording) {
        manifest.recording = null;
        formData.append('delete_recording', 'true');
      } else if (createRecordingFile) {
        totalSize += createRecordingFile.size;
        formData.append('recording', createRecordingFile, 'recording.cast');
        manifest.recording = "recording.cast";
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
      setCreateWelcomeMessage('');
      setShowWelcomeEditor(false);
      setCreateInitScript('');
      setShowInitEditor(false);
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
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Welcome Message (printed on boot)</label>
              {!showWelcomeEditor && editCastId ? (
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowWelcomeEditor(true)}
                    className="flex-1 bg-surface-container-high border-2 border-dashed border-on-surface/50 p-4 font-mono text-sm font-bold text-on-surface/70 hover:bg-white transition-colors"
                  >
                    CHANGE WELCOME MESSAGE
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setDeleteWelcome(!deleteWelcome); if (!deleteWelcome) setCreateWelcomeMessage(''); }}
                    className={`px-4 border-2 font-mono text-xs font-bold transition-colors ${deleteWelcome ? 'bg-red-500 text-white border-red-500' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-red-50'}`}
                  >
                    {deleteWelcome ? 'WILL DELETE' : 'DELETE'}
                  </button>
                </div>
              ) : (
                <textarea 
                  value={createWelcomeMessage}
                  onChange={(e) => setCreateWelcomeMessage(e.target.value)}
                  className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                  placeholder="Welcome to the SWACN sandbox! Type 'help' to begin."
                />
              )}
            </div>
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Initialization Script (init.sh)</label>
              {!showInitEditor && editCastId ? (
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowInitEditor(true)}
                    className="flex-1 bg-surface-container-high border-2 border-dashed border-on-surface/50 p-4 font-mono text-sm font-bold text-on-surface/70 hover:bg-white transition-colors"
                  >
                    CHANGE INIT SCRIPT
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setDeleteInit(!deleteInit); if (!deleteInit) setCreateInitScript(''); }}
                    className={`px-4 border-2 font-mono text-xs font-bold transition-colors ${deleteInit ? 'bg-red-500 text-white border-red-500' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-red-50'}`}
                  >
                    {deleteInit ? 'WILL DELETE' : 'DELETE'}
                  </button>
                </div>
              ) : (
                <textarea 
                  value={createInitScript}
                  onChange={(e) => setCreateInitScript(e.target.value)}
                  className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                  placeholder="#!/bin/sh&#10;echo 'Setting up environment...'&#10;npm install"
                />
              )}
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Filesystem Upload</label>
              <div className="flex gap-2 mb-2">
                <label className={`flex-1 block bg-surface-container-high border-2 ${editCastId && (!createFiles || createFiles.length === 0) ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-4 cursor-pointer hover:bg-white transition-colors group`}>
                  <input 
                    type="file" 
                    // @ts-ignore
                    webkitdirectory="true" 
                    directory=""
                    onChange={(e) => {
                      setCreateFiles(e.target.files);
                      if (e.target.files && e.target.files.length > 0) {
                        setDeleteBaseline(false);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="font-mono text-sm font-bold uppercase text-on-surface/70 group-hover:scale-105 transition-transform text-center">
                      {createFiles && createFiles.length > 0 ? "New Folder Selected" : (editCastId ? "Replace Folder" : "Select Folder")}
                    </span>
                    
                    {createFiles && createFiles.length > 0 && (
                      <span className="text-xs opacity-70 font-mono text-primary font-bold">
                        {createFiles[0].webkitRelativePath ? createFiles[0].webkitRelativePath.split('/')[0] : 'Project'} ({createFiles.length} files)
                      </span>
                    )}
                  </div>
                </label>
                {editCastId && (
                  <button 
                    type="button"
                    onClick={() => {
                      const newState = !deleteBaseline;
                      setDeleteBaseline(newState);
                      if (newState) setCreateFiles(null);
                    }}
                    className={`px-4 border-2 font-mono text-xs font-bold transition-colors ${deleteBaseline ? 'bg-red-500 text-white border-red-500' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-red-50'}`}
                  >
                    {deleteBaseline ? 'WILL DELETE' : 'DELETE'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Terminal Recording (.cast file)</label>
              <div className="flex gap-2 mb-2">
                <label className={`flex-1 block w-full bg-surface-container-high border-2 ${editCastId && !createRecordingFile ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-4 cursor-pointer hover:bg-white transition-colors group`}>
                  <input 
                    type="file" 
                    accept=".cast"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCreateRecordingFile(file);
                      if (file) {
                        setDeleteRecording(false);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="font-mono text-sm font-bold uppercase text-on-surface/70 group-hover:scale-105 transition-transform text-center">
                      {createRecordingFile ? "New Recording Selected" : (editCastId ? "Replace Recording" : "Select Recording")}
                    </span>
                    
                    {createRecordingFile && (
                      <span className="text-xs opacity-70 font-mono text-primary font-bold">
                        {createRecordingFile.name}
                      </span>
                    )}
                  </div>
                </label>
                {editCastId && (
                  <button 
                    type="button"
                    onClick={() => {
                      const newState = !deleteRecording;
                      setDeleteRecording(newState);
                      if (newState) setCreateRecordingFile(null);
                    }}
                    className={`px-4 border-2 font-mono text-xs font-bold transition-colors ${deleteRecording ? 'bg-red-500 text-white border-red-500' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-red-50'}`}
                  >
                    {deleteRecording ? 'WILL DELETE' : 'DELETE'}
                  </button>
                )}
              </div>
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
