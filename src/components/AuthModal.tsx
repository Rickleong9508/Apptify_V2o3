
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader, Lock, Mail, X } from 'lucide-react';

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
                onClose(); // Close modal on successful sign in
            }
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div
                className="w-full max-w-md p-8 rounded-[35px] bg-[#E0E5EC] relative animate-scale-in"
                style={{
                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full text-gray-500 hover:bg-black/5 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-[#444] mb-2">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="text-xs text-gray-500">
                        {mode === 'signin' ? 'Sign in to sync your wealth data' : 'Sign up to enable cloud sync'}
                    </p>
                </div>

                {message && (
                    <div className={`mb-6 p-3 rounded-xl text-xs font-medium ${message.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#E0E5EC] border-none text-gray-700 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                                style={{
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#E0E5EC] border-none text-gray-700 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                                style={{
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-[24px] bg-[#E0E5EC] text-blue-600 font-bold text-sm hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2"
                        style={{
                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                        }}
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setMode(mode === 'signin' ? 'signup' : 'signin');
                            setMessage(null);
                        }}
                        className="text-gray-500 hover:text-blue-600 font-medium text-xs transition-colors"
                    >
                        {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
