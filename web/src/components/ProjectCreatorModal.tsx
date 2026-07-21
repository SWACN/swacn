import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquareTerminal, XCircle, Globe, Lock } from 'lucide-react';
import { getAuthToken, fetchCasts, fetchCastDetails, fetchMe } from '../lib/api';
import { TarBuilder } from '../lib/TarBuilder';
import { TarReader } from '../lib/TarReader';
import { clearAssetCache } from '../lib/V86VM';

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
  const [recordings, setRecordings] = useState<{ id?: number, file: File | null, title: string, deleted?: boolean, existingUrl?: string, uid: number }[]>([{ file: null, title: '', uid: Date.now() }]);
  const [createWelcomeMessage, setCreateWelcomeMessage] = useState('');
  const [showWelcomeEditor, setShowWelcomeEditor] = useState(false);
  const [createInitScript, setCreateInitScript] = useState('');
  const [showInitEditor, setShowInitEditor] = useState(false);
  const [deleteWelcome, setDeleteWelcome] = useState(false);
  const [deleteInit, setDeleteInit] = useState(false);
  const [deleteBaseline, setDeleteBaseline] = useState(false);
  const [existingBaseline, setExistingBaseline] = useState<string | null>(null);
  const [isProUser, setIsProUser] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isOpen) {
      fetchMe().then(me => {
        setIsProUser(me.is_pro || me.is_super_admin);
      }).catch(() => { });
    }
  }, [isOpen]);

  React.useEffect(() => {
    const token = getAuthToken();
    if (isOpen && editCastId) {
      fetchCastDetails(editCastId)
        .then(details => {
          setCreateProjectName(prev => prev || details.name || '');
          if (details.casts && details.casts.length > 0) {
            const existing = details.casts.map((c: any, i: number) => ({
              id: c.id,
              file: null,
              title: c.title || '',
              existingUrl: c.recording_url,
              uid: Date.now() + i
            }));

            // Auto-add an empty slot for Pro users if they are editing
            if (isProUser) {
              existing.push({ file: null, title: '', uid: Date.now() + details.casts.length });
            }
            setRecordings(existing);
          }
          if (details.is_public !== undefined) setIsPublic(details.is_public);
        })
        .catch(err => console.error("Failed to fetch cast details for edit", err));

      const manifestUrl = `/uploads/${editCastId}/manifest.json?${token ? `token=${token}&` : ''}t=${Date.now()}`;
      fetch(manifestUrl)
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
          if (data.is_public !== undefined) setIsPublic(data.is_public);
        })
        .catch(err => console.error("Failed to fetch manifest for edit", err));
    } else if (isOpen) {
      setCreateProjectName('');
      setCreateEnvVars('');
      setCreateTools('');
      setCreateFiles(null);
      setRecordings([{ file: null, title: '', uid: Date.now() }]);
      setExistingBaseline(null);
      setIsPublic(true);
      setUploadError(null);
      setCreateWelcomeMessage('');
      setShowWelcomeEditor(false);
      setCreateInitScript('');
      setShowInitEditor(false);
      setDeleteWelcome(false);
      setDeleteInit(false);
      setDeleteBaseline(false);
      setCreateFiles(null);
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
      if (!token) throw new Error("Not authenticated. Please sign in to create a project.");

      if (!editCastId) {
        const casts = await fetchCasts();
        const maxProjects = isProUser ? 50 : 15;
        if (casts.length >= maxProjects) {
          throw new Error(`Project limit reached. You have ${casts.length} active projects.`);
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

      if ((createFiles && createFiles.length > 0) || createWelcomeMessage.trim() || createInitScript.trim() || (editCastId && (showWelcomeEditor || showInitEditor || deleteWelcome || deleteInit || deleteBaseline))) {
        manifest.baseline = "baseline.tar.gz";
        const builder = new TarBuilder();
        const filesToBundle: Record<string, Uint8Array> = {};

        // Case 1: Fetch existing files if editing
        if (editCastId) {
          const token = getAuthToken();
          const res = await fetch(`/uploads/${editCastId}/baseline.tar.gz?t=${Date.now()}${token ? `&token=${token}` : ''}`, {
            cache: 'no-store',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
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

      let recordingIndex = 0;
      for (const rec of recordings) {
        if (rec.id && rec.deleted) {
          formData.append(`delete_cast_${rec.id}`, 'true');
        } else if (rec.file && !rec.deleted) {
          if (rec.id) {
            formData.append(`delete_cast_${rec.id}`, 'true');
          }
          totalSize += rec.file.size;
          formData.append(`recording_${recordingIndex}`, rec.file, `recording_${recordingIndex}.cast`);
          formData.append(`title_${recordingIndex}`, rec.title.trim());
          recordingIndex++;
        } else if (rec.id && !rec.deleted) {
          formData.append(`update_title_${rec.id}`, rec.title.trim());
        }
      }

      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      totalSize += manifestBlob.size;

      if (totalSize > (isProUser ? 50 * 1024 * 1024 : 2 * 1024 * 1024)) {
        throw new Error(`Project size exceeds the allocated capacity for your account tier.`);
      }

      formData.append('manifest', manifestBlob, 'manifest.json');
      formData.append('is_public', isPublic.toString());

      let castId = editCastId;
      if (editCastId) {
        const { updateCastUpload } = await import('../lib/api');
        await updateCastUpload(editCastId, formData);

        clearAssetCache(editCastId);
        try {
          if ('caches' in window) {
            const cache = await caches.open('swacn-assets-v1');
            const keys = await cache.keys();
            for (const key of keys) {
              const url = key.url;
              if (url.includes(`/${editCastId}/`)) {
                await cache.delete(key);
              }
            }
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
      setRecordings([{ file: null, title: '', uid: Date.now() }]);
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
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Project Name</label>
                <input
                  type="text"
                  value={createProjectName}
                  onChange={(e) => setCreateProjectName(e.target.value)}
                  className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors"
                  placeholder="my-awesome-project"
                />
              </div>
              {isProUser && (
                <div className="w-40 sm:w-48">
                  <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Visibility</label>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-full border-2 p-3 font-mono text-sm font-bold transition-colors flex items-center justify-center gap-2 h-[46px] ${isPublic ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-container-high text-on-surface/50 border-dashed border-on-surface/50 hover:bg-white hover:text-on-surface'}`}
                  >
                    {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                    <span className="hidden sm:inline">{isPublic ? 'PUBLIC' : 'PRIVATE'}</span>
                    <span className="sm:hidden">{isPublic ? 'PUB' : 'PRIV'}</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Environment Variables (KEY=value)</label>
              <textarea
                value={createEnvVars}
                onChange={(e) => setCreateEnvVars(e.target.value)}
                className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                placeholder="NODE_ENV=production&#10;DEBUG=true"
              />
            </div>

            <div>
              <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Tool Binaries (name=url, one per line)</label>
              <textarea
                value={createTools}
                onChange={(e) => setCreateTools(e.target.value)}
                className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                placeholder="yq=https://github.com/mikefarah/yq/releases/download/v4.40.5/yq_linux_386"
              />
            </div>

            <div>
              <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Welcome Message (printed on boot)</label>
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
                    className={`px-3 py-3 border-2 font-mono text-sm font-bold transition-colors whitespace-nowrap ${deleteWelcome ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-on-surface/10 hover:text-on-surface'}`}
                  >
                    {deleteWelcome ? 'UNDO' : 'DEL'}
                  </button>
                </div>
              ) : (
                <textarea
                  value={createWelcomeMessage}
                  onChange={(e) => {
                    setCreateWelcomeMessage(e.target.value);
                    if (e.target.value.trim()) setDeleteWelcome(false);
                  }}
                  className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                  placeholder="Welcome to the SWACN sandbox! Type 'help' to begin."
                />
              )}
            </div>
            <div>
              <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Initialization Script (init.sh)</label>
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
                    className={`px-3 py-3 border-2 font-mono text-sm font-bold transition-colors whitespace-nowrap ${deleteInit ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-on-surface/10 hover:text-on-surface'}`}
                  >
                    {deleteInit ? 'UNDO' : 'DEL'}
                  </button>
                </div>
              ) : (
                <textarea
                  value={createInitScript}
                  onChange={(e) => {
                    setCreateInitScript(e.target.value);
                    if (e.target.value.trim()) setDeleteInit(false);
                  }}
                  className="w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors min-h-[80px]"
                  placeholder="#!/bin/sh&#10;echo 'Setting up environment...'&#10;npm install"
                />
              )}
            </div>

            <div>
              <label className="font-mono text-xs font-bold uppercase text-primary block mb-2">Filesystem Upload</label>
              <div className={`flex flex-col md:flex-row gap-2 border-2 p-4 transition-colors items-stretch ${deleteBaseline ? 'border-dashed border-on-surface/30 bg-surface-container-low' : 'border-on-surface bg-surface-container-high'}`}>
                <div className={`${(createFiles && createFiles.length > 0 || editCastId) ? 'flex-1' : 'w-full flex justify-center'}`}>
                  <label className={`block ${(createFiles && createFiles.length > 0 || editCastId) ? 'w-full' : 'w-full max-w-xs'} border-2 ${(!createFiles || createFiles.length === 0) ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-3 cursor-pointer hover:bg-white transition-colors group ${deleteBaseline ? 'opacity-50 pointer-events-none' : ''}`}>
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
                    <div className="flex flex-col items-center justify-center gap-1">
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
                </div>
                {(editCastId || (createFiles && createFiles.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (createFiles && createFiles.length > 0) {
                        setCreateFiles(null);
                      } else if (editCastId) {
                        setDeleteBaseline(!deleteBaseline);
                      }
                    }}
                    className={`px-3 py-3 border-2 font-mono text-sm font-bold transition-colors whitespace-nowrap ${(editCastId && deleteBaseline && (!createFiles || createFiles.length === 0)) ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-on-surface/10 hover:text-on-surface'}`}
                  >
                    {(editCastId && deleteBaseline && (!createFiles || createFiles.length === 0)) ? 'UNDO' : 'DEL'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-mono text-xs font-bold uppercase text-primary">Terminal Recordings (.cast files)</label>
              </div>
              <div className="space-y-4">
                {recordings.map((rec, idx) => (
                  <div key={rec.uid} className={`flex flex-col md:flex-row gap-2 border-2 p-4 transition-colors items-stretch ${rec.deleted ? 'border-dashed border-on-surface/30 bg-surface-container-low' : 'border-on-surface bg-surface-container-high'}`}>
                    <div className={`${(rec.file || rec.id) ? 'flex-1' : 'w-full flex justify-center'}`}>
                      <label className={`flex flex-col items-center justify-center ${(rec.file || rec.id) ? 'w-full h-full' : 'w-full max-w-xs'} border-2 ${!rec.file && !rec.id ? 'border-dashed border-on-surface/50' : 'border-on-surface'} p-3 cursor-pointer hover:bg-white transition-colors group ${rec.deleted ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                          type="file"
                          accept=".cast"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            const newRecs = [...recordings];
                            newRecs[idx].file = file;
                            newRecs[idx].deleted = false;

                            // If this was the last slot and we are Pro, add a new empty slot
                            if (isProUser && idx === recordings.length - 1 && file) {
                              newRecs.push({ file: null, title: '', uid: Date.now() });
                            }

                            setRecordings(newRecs);
                          }}
                          className="hidden"
                          disabled={rec.deleted}
                        />
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-mono text-sm font-bold uppercase text-on-surface/70 group-hover:scale-105 transition-transform text-center">
                            {rec.file ? "New File Selected" : (rec.id ? "Existing Cast" : "Select Recording")}
                          </span>
                          {rec.file && (
                            <span className="text-xs opacity-70 font-mono text-primary font-bold">
                              {rec.file.name}
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                    {(rec.file || rec.id) && (
                      <div className={`${isProUser ? 'flex-[2]' : ''} flex gap-2 items-stretch`}>
                        {isProUser && (
                          <input
                            type="text"
                            value={rec.title}
                            onChange={(e) => {
                              const newRecs = [...recordings];
                              newRecs[idx].title = e.target.value;
                              setRecordings(newRecs);
                            }}
                            disabled={rec.deleted}
                            className={`w-full bg-surface-container-high border-2 border-on-surface p-3 font-mono text-sm outline-none focus:border-primary transition-colors ${rec.deleted ? 'opacity-50 pointer-events-none' : ''}`}
                            placeholder="Optional Cast Title"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (rec.id) {
                              const newRecs = [...recordings];
                              newRecs[idx].deleted = !rec.deleted;
                              setRecordings(newRecs);
                            } else {
                              const newRecs = recordings.filter((_, i) => i !== idx);
                              if (newRecs.length === 0) newRecs.push({ file: null, title: '', uid: Date.now() });
                              setRecordings(newRecs);
                            }
                          }}
                          className={`px-3 py-3 border-2 font-mono text-sm font-bold transition-colors whitespace-nowrap ${rec.deleted ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-container-high border-on-surface/20 text-on-surface/50 hover:bg-on-surface/10 hover:text-on-surface'}`}
                        >
                          {rec.deleted ? 'UNDO' : 'DEL'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
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
