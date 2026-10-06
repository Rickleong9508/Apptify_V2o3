import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Loader2, X, Cloud, ShieldCheck, Laptop, Smartphone, KeyRound, ChevronDown, ChevronUp, ExternalLink, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { isConnected, user, connectGoogleDrive, googleClientId, updateClientId, isSyncing } = useAuth();
    const [loading, setLoading] = useState(false);
    const [customClientId, setCustomClientId] = useState(googleClientId || '');
    const [showConfig, setShowConfig] = useState(!googleClientId);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConnect = async () => {
        setLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        try {
            // Save Client ID if entered
            if (customClientId.trim()) {
                updateClientId(customClientId.trim());
            }

            const profile = await connectGoogleDrive(customClientId.trim() || undefined);
            setSuccessMsg(`连接成功！已同步至 ${profile.email} 的 Google 云端硬盘`);
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err: any) {
            console.error(err);
            if (err.message === 'MISSING_CLIENT_ID') {
                setErrorMsg('请先填写您的 Google Client ID，或在后台配置 VITE_GOOGLE_CLIENT_ID。');
                setShowConfig(true);
            } else if (err.message?.includes('popup_closed') || err.message?.includes('closed')) {
                setErrorMsg('授权窗口已关闭，未完成连接。');
            } else {
                setErrorMsg(err.message || '连接 Google Drive 失败，请重试。');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-md animate-fade-in">
            <div className="w-full sm:max-w-lg ios-card rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 animate-slide-up sm:animate-scale-in border border-white/20 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--ios-separator)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                            <Cloud size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-[var(--ios-label-primary)]">
                                连接 Google Drive 云同步
                            </h2>
                            <p className="text-xs text-[var(--ios-label-secondary)] font-medium">
                                数据归你所有 · 跨设备自由漫游
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)] tap-scale transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Privacy & Highlights */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                            <ShieldCheck size={15} />
                            <span>100% 绝对隐私</span>
                        </div>
                        <p className="text-[var(--ios-label-secondary)] text-[11px] leading-relaxed">
                            账本与笔记直接存入您的私有网盘，无任何中心数据库中转或收集。
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <div className="flex items-center gap-1">
                                <Laptop size={14} />
                                <Smartphone size={14} />
                            </div>
                            <span>全端实时同步</span>
                        </div>
                        <p className="text-[var(--ios-label-secondary)] text-[11px] leading-relaxed">
                            在手机、Mac、平板或 Windows 登录同一个 Google 账号即可自动拉取更新。
                        </p>
                    </div>
                </div>

                {/* Notifications */}
                {errorMsg && (
                    <div className="p-3.5 rounded-2xl text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-fade-in">
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div className="p-3.5 rounded-2xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-2 animate-fade-in">
                        <CheckCircle2 size={16} />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* Main Action: One-Click Google Login Button */}
                <div className="space-y-3">
                    <button
                        onClick={handleConnect}
                        disabled={loading || isSyncing}
                        className="w-full py-3.5 px-4 rounded-2xl bg-white dark:bg-[#1f2024] text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-white/10 shadow-md hover:shadow-lg active:scale-98 transition-all font-semibold text-sm flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin text-blue-500" size={20} />
                        ) : (
                            <>
                                {/* Google G Logo */}
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span>{isConnected ? '重新授权 / 切换 Google 账号' : '使用 Google 账号一键授权'}</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Advanced: Client ID Settings Collapsible */}
                <div className="pt-2 border-t border-[var(--ios-separator)]">
                    <button
                        type="button"
                        onClick={() => setShowConfig(!showConfig)}
                        className="w-full flex items-center justify-between text-xs text-[var(--ios-label-secondary)] hover:text-blue-500 font-medium transition-colors py-1"
                    >
                        <div className="flex items-center gap-1.5">
                            <KeyRound size={13} />
                            <span>高级设置：配置 Google Cloud Client ID</span>
                        </div>
                        {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showConfig && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-[var(--ios-fill-tertiary)] space-y-3 animate-fade-in text-xs">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-[var(--ios-label-secondary)]">
                                    OAuth 2.0 Web Client ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="例如: 123456789-abc.apps.googleusercontent.com"
                                    value={customClientId}
                                    onChange={(e) => setCustomClientId(e.target.value)}
                                    className="ios-input text-xs w-full py-2"
                                />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--ios-label-secondary)]">
                                <span>无需 Secret，纯前端安全授权</span>
                                <a
                                    href="https://console.cloud.google.com/apis/credentials"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-500 hover:underline flex items-center gap-1"
                                >
                                    <span>获取 Client ID</span>
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer status notice */}
                <div className="text-center text-[11px] text-[var(--ios-label-tertiary)] leading-tight">
                    首次连接时会自动在您的网盘中创建名为 <code className="text-blue-500 font-mono">Apptify_Cloud_Data.json</code> 的备份文件。
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
