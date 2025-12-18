import React, { useState, useRef, useEffect } from 'react';
import { 
    Cloud, 
    Loader2, 
    Download,
    Upload,
    RefreshCw,
    Smartphone,
    Settings,
    HardDrive,
    HelpCircle,
    XCircle,
    FileJson,
    Share2,
    CheckCircle2,
    ArrowRight,
    Moon,
    Sun
} from 'lucide-react';
import { DriveConfig, isTokenValid, saveToDrive, loadFromDrive, getBackupMetadata } from '../services/driveService';

interface ProfileProps {
  allData: any;
  onImport: (data: any) => void;
  driveConfig?: DriveConfig;
  setDriveConfig?: (config: DriveConfig) => void;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

const Profile: React.FC<ProfileProps> = ({ allData, onImport, driveConfig, setDriveConfig, theme, setTheme }) => {
  // Drive State
  const [showDriveSettings, setShowDriveSettings] = useState(false);
  const [driveClientId, setDriveClientId] = useState(driveConfig?.clientId || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // File Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local state if prop changes
  useEffect(() => {
      if (driveConfig?.clientId) {
          setDriveClientId(driveConfig.clientId);
      }
  }, [driveConfig]);

  // --- Drive Logic ---
  const handleConnectDrive = () => {
      setSyncError(null);
      if (!(window as any).google) {
          alert("Google Scripts not loaded. Please refresh.");
          return;
      }
      if (!driveClientId) {
          alert("Please enter a Client ID first.");
          setShowDriveSettings(true);
          return;
      }

      try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: driveClientId,
              scope: 'https://www.googleapis.com/auth/drive.file',
              callback: async (response: any) => {
                  if (response.error) {
                      console.error("OAuth Error:", response);
                      setSyncError(`Connection Failed: ${response.error}`);
                      return;
                  }

                  if (response.access_token && setDriveConfig) {
                      const expiry = Date.now() + (Number(response.expires_in) * 1000);
                      
                      // Save config
                      setDriveConfig({
                          clientId: driveClientId,
                          accessToken: response.access_token,
                          tokenExpiry: expiry,
                          autoSync: true // Default to auto-sync on connect
                      });
                      setSyncStatus("Connected");

                      // AUTO CHECK FOR BACKUP
                      checkRemoteBackup(response.access_token);
                  }
              },
          });
          client.requestAccessToken();
      } catch (err: any) {
          setSyncError("Initialization Error: " + err.message);
      }
  };

  const checkRemoteBackup = async (token: string) => {
      setSyncStatus("Checking for existing data...");
      setSyncError(null);
      try {
          const file = await getBackupMetadata(token);
          if (file) {
              const fileDate = new Date(file.modifiedTime);
              if (window.confirm(`Found a backup in your Drive from ${fileDate.toLocaleString()}.\n\nDo you want to LOAD it now?`)) {
                  handleDriveImport(token);
              } else {
                  setSyncStatus("Connected (Backup Available)");
              }
          } else {
              setSyncStatus("Connected (No backup found)");
          }
      } catch (e: any) {
          console.error(e);
          setSyncStatus("Connection Issue");
          setSyncError(e.message);
      }
  };

  const handleManualDriveSync = async () => {
      if (!driveConfig?.accessToken || !isTokenValid(driveConfig.tokenExpiry)) {
          handleConnectDrive(); // Re-auth if expired
          return;
      }

      setIsSyncing(true);
      setSyncStatus("Uploading...");
      setSyncError(null);
      try {
          // Prepare export data structure
          const data = {
            ...allData,
            // Include Client ID in backup so secondary devices can pick it up on restore
            settings: { driveClientId: driveConfig.clientId },
            meta: { 
                version: '2.0', 
                exportedAt: new Date().toISOString(),
                ownerEmail: 'default_user'
            }
          };

          await saveToDrive(driveConfig.accessToken, data);
          setSyncStatus("Synced Just Now");
      } catch (err: any) {
          console.error(err);
          setSyncStatus("Sync Failed");
          setSyncError(err.message);
      } finally {
          setIsSyncing(false);
      }
  };
  
  const handleDriveImport = async (tokenOverride?: string) => {
       const token = tokenOverride || driveConfig?.accessToken;
       if (!token) {
          handleConnectDrive();
          return;
      }
      
      setIsSyncing(true);
      setSyncStatus("Downloading...");
      setSyncError(null);
      try {
          const data = await loadFromDrive(token);
          processImportData(data);
          setSyncStatus("Download Complete");
          alert("Sync complete! Data updated from Cloud.");
      } catch (err: any) {
          console.error(err);
          setSyncStatus("Download Failed");
          setSyncError(err.message);
      } finally {
           setIsSyncing(false);
      }
  };

  const handleDisconnectDrive = () => {
      if (setDriveConfig) {
          // Clear everything
          setDriveConfig({
              clientId: '',
              accessToken: null,
              tokenExpiry: null,
              autoSync: false
          });
          setDriveClientId('');
          setSyncStatus('');
          setSyncError(null);
          setShowDriveSettings(true);
      }
  };

  // --- Enhanced Export Logic (Local) ---
  const handleExport = () => {
    const data = {
        ...allData,
        // Export Client ID too!
        settings: { driveClientId: driveClientId || driveConfig?.clientId }, 
        meta: { 
            version: '2.0', 
            exportedAt: new Date().toISOString(),
            ownerEmail: 'default_user'
        }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyWealth_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Enhanced Import Logic (Local) ---
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);
            processImportData(data);
            alert("Data restored successfully!");
        } catch (error) {
            console.error(error);
            alert("Invalid or corrupt sync file.");
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Unified Import Processor ---
  const processImportData = (data: any) => {
    // 1. Restore Client ID (if missing on this device)
    if (data.settings?.driveClientId && !driveClientId && setDriveConfig) {
        setDriveClientId(data.settings.driveClientId);
    }

    // 2. Restore Financial Data
    const { authUsers, meta, settings, ...financialData } = data;
    
    // Save to generic storage key
    localStorage.setItem('mw_data_main', JSON.stringify(financialData));
    
    // Update State
    onImport(financialData);
  };

  return (
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-10">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-2 p-2">
              <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-text-main text-surface rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings size={28} />
                  </div>
                  <div>
                      <h2 className="text-3xl font-bold text-text-main tracking-tight">App Settings</h2>
                      <p className="text-text-muted">Preferences & Backup</p>
                  </div>
              </div>
          </div>

          {/* APPEARANCE SETTINGS */}
          <div className="bg-surface rounded-[32px] p-6 shadow-apple border border-border">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-orange-100 text-orange-500'}`}>
                          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-text-main">Appearance</h3>
                          <p className="text-sm text-text-muted">Toggle dark mode theme</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => setTheme && setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm flex items-center justify-center ${theme === 'dark' ? 'translate-x-7' : 'translate-x-1'}`}>
                          {theme === 'dark' ? <Moon size={12} className="text-primary"/> : <Sun size={12} className="text-orange-400"/>}
                      </div>
                  </button>
              </div>
          </div>

          {/* BACKUP & SYNC GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* OPTION 1: File Transfer (Simple) */}
              <div className="bg-surface rounded-[32px] p-6 shadow-apple border border-border flex flex-col h-full relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-16 bg-blue-50/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform"></div>
                  
                  <div className="relative z-10 flex-1">
                      <div className="w-10 h-10 bg-blue-100/20 text-blue-600 rounded-full flex items-center justify-center mb-4">
                          <Share2 size={20} />
                      </div>
                      <h3 className="text-xl font-bold text-text-main mb-2">Manual Backup</h3>
                      <p className="text-sm text-text-muted mb-6 leading-relaxed">
                          Save a file and send it to your new device via WhatsApp, Email, or AirDrop.
                      </p>

                      <div className="space-y-3">
                          <button 
                            onClick={handleExport}
                            className="w-full py-4 bg-input-bg hover:bg-background border border-border hover:border-primary rounded-2xl flex items-center justify-between px-6 transition-all group/btn"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="bg-surface p-2 rounded-lg shadow-sm text-primary">
                                      <Upload size={18} />
                                  </div>
                                  <div className="text-left">
                                      <span className="block text-xs font-bold text-text-muted uppercase">Export</span>
                                      <span className="block font-bold text-text-main group-hover/btn:text-primary">Save to File</span>
                                  </div>
                              </div>
                              <ArrowRight size={18} className="text-text-muted group-hover/btn:text-primary" />
                          </button>

                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 bg-input-bg hover:bg-background border border-border hover:border-green-500 rounded-2xl flex items-center justify-between px-6 transition-all group/btn"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="bg-surface p-2 rounded-lg shadow-sm text-green-600">
                                      <Download size={18} />
                                  </div>
                                  <div className="text-left">
                                      <span className="block text-xs font-bold text-text-muted uppercase">Import</span>
                                      <span className="block font-bold text-text-main group-hover/btn:text-green-600">Load from File</span>
                                  </div>
                              </div>
                              <ArrowRight size={18} className="text-text-muted group-hover/btn:text-green-600" />
                          </button>
                      </div>
                  </div>
              </div>

              {/* OPTION 2: Google Drive (Advanced) */}
              <div className="bg-surface rounded-[32px] p-6 shadow-apple border border-border flex flex-col h-full relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 bg-yellow-50/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform"></div>
                   
                   <div className="relative z-10 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-yellow-100/20 text-yellow-600 rounded-full flex items-center justify-center">
                                <Cloud size={20} />
                            </div>
                            {driveConfig?.accessToken && isTokenValid(driveConfig.tokenExpiry) && (
                                <span className="px-3 py-1 bg-green-100/20 text-green-700 rounded-full text-[10px] font-bold flex items-center gap-1 border border-green-200/20">
                                    <CheckCircle2 size={12} /> Connected
                                </span>
                            )}
                        </div>
                        
                        <h3 className="text-xl font-bold text-text-main mb-2">Cloud Sync</h3>
                        <p className="text-sm text-text-muted mb-6 leading-relaxed">
                            Automatically sync data across all your devices using Google Drive.
                        </p>

                        <div className="mt-auto space-y-3">
                            {/* Connection Status / Actions */}
                            {!driveConfig?.accessToken || !isTokenValid(driveConfig.tokenExpiry) ? (
                                <div className="space-y-3">
                                    <button 
                                        onClick={handleConnectDrive}
                                        className="w-full py-3 bg-text-main text-surface rounded-xl font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <HardDrive size={16} /> 
                                        Connect Google Drive
                                    </button>
                                    <button 
                                        onClick={() => setShowDriveSettings(!showDriveSettings)}
                                        className="w-full py-2 text-xs font-bold text-text-muted hover:text-text-main flex items-center justify-center gap-1"
                                    >
                                        <Settings size={12} />
                                        {driveClientId ? 'Change Client ID' : 'Configure Client ID'}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-input-bg rounded-xl p-4 border border-border space-y-3">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleManualDriveSync}
                                            disabled={isSyncing}
                                            className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {isSyncing ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14} />}
                                            Push
                                        </button>
                                        <button 
                                            onClick={() => handleDriveImport()}
                                            disabled={isSyncing}
                                            className="flex-1 py-2 bg-surface border border-border text-text-main rounded-lg text-xs font-bold hover:bg-background flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            <Download size={14} /> Pull
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-border">
                                        <span className="text-[10px] font-bold text-text-muted">Auto-Sync Enabled</span>
                                        <button onClick={handleDisconnectDrive} className="text-[10px] font-bold text-red-500 hover:underline">Disconnect</button>
                                    </div>
                                    {syncStatus && <p className="text-[10px] text-center text-text-muted">{syncStatus}</p>}
                                </div>
                            )}

                            {/* Configuration Form (Collapsible) */}
                            {(showDriveSettings || (!driveClientId && !driveConfig?.accessToken)) && (
                                <div className="mt-4 p-4 bg-yellow-50/10 border border-yellow-200/20 rounded-xl animate-fade-in">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] font-bold text-yellow-600 uppercase">Google Client ID</label>
                                        <button 
                                            onClick={() => setShowSetupGuide(!showSetupGuide)}
                                            className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline"
                                        >
                                            <HelpCircle size={10}/> Help
                                        </button>
                                    </div>
                                    
                                    {showSetupGuide && (
                                        <div className="bg-surface p-3 rounded-lg mb-3 text-[10px] text-text-muted space-y-1 border border-border">
                                            <p>To enable sync, you must create a free project in Google Cloud:</p>
                                            <ol className="list-decimal pl-4 space-y-1">
                                                <li>Go to <b>Google Cloud Console</b>.</li>
                                                <li>Enable <b>"Google Drive API"</b>.</li>
                                                <li>Create <b>OAuth Client ID</b> (Web App).</li>
                                                <li>Add this URL to <b>Authorized Origins</b>.</li>
                                                <li>Paste the Client ID below.</li>
                                            </ol>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            className="flex-1 p-2 text-xs border border-border rounded-lg font-mono bg-surface text-text-main"
                                            placeholder="apps.googleusercontent.com"
                                            value={driveClientId}
                                            onChange={(e) => setDriveClientId(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                   </div>
              </div>
          </div>
          
          {/* Error Message Toast */}
          {syncError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 flex items-center gap-3 animate-slide-in">
                <XCircle size={20} />
                <div>
                    <span className="font-bold block">Sync Error</span>
                    <span className="text-xs">{syncError}</span>
                </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />

      </div>
  );
};

export default Profile;