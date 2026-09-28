import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Lock, Mail, X, Sparkles } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onClose();
            }
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full sm:max-w-md ios-card rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 animate-slide-up sm:animate-scale-in">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--ios-separator)]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                            <Sparkles size={16} />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-[var(--ios-label-primary)]">
                            {mode === 'signin' ? 'Sign in to Apptify' : 'Create Account'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)] tap-scale"
                    >
                        <X size={16} />
                    </button>
                </div>

                <p className="text-xs text-[var(--ios-label-secondary)] leading-relaxed">
                    {mode === 'signin' 
                        ? 'Sign in to sync your wealth, tasks, and investment notes securely across devices.' 
                        : 'Sign up to enable real-time cloud data synchronization and automatic backups.'}
                </p>

                {message && (
                    <div className={`p-3 rounded-xl text-xs font-semibold ${
                        message.type === 'error' ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
                    }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-3">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[var(--ios-label-tertiary)]">
                                <Mail size={16} />
                            </div>
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="ios-input pl-10"
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[var(--ios-label-tertiary)]">
                                <Lock size={16} />
                            </div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="ios-input pl-10"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full ios-button-primary py-3.5 text-sm font-semibold tap-scale flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div className="pt-2 text-center border-t border-[var(--ios-separator)]">
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === 'signin' ? 'signup' : 'signin');
                            setMessage(null);
                        }}
                        className="text-[var(--ios-label-secondary)] hover:text-blue-500 font-medium text-xs transition-colors"
                    >
                        {mode === 'signin' ? "Don't have an account? Create one" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
