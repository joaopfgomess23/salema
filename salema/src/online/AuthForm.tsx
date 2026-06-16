import { useState } from 'react';
import { UseAuth } from './useAuth';

export function AuthForm({
  auth,
  onBack,
  reason,
}: {
  auth: UseAuth;
  onBack: () => void;
  reason?: string;
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = username.trim().length >= 3 && password.length >= 6 && !auth.busy;

  const submit = () => {
    if (!canSubmit) return;
    if (tab === 'login') auth.login(username.trim(), password);
    else auth.register(username.trim(), password);
  };

  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Modo Ranked · conta necessária</p>
        <h1 className="setup__title">{tab === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        {reason && <p className="setup__lead">{reason}</p>}

        <div className="auth__tabs">
          <button
            className={`auth__tab ${tab === 'login' ? 'auth__tab--on' : ''}`}
            onClick={() => setTab('login')}
          >
            Entrar
          </button>
          <button
            className={`auth__tab ${tab === 'register' ? 'auth__tab--on' : ''}`}
            onClick={() => setTab('register')}
          >
            Criar conta
          </button>
        </div>

        <label className="setup__label" htmlFor="auser">Nome de utilizador</label>
        <input
          id="auser"
          className="setup__input"
          value={username}
          maxLength={16}
          placeholder="3 a 16 caracteres"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
        />
        <label className="setup__label" htmlFor="apass">Palavra-passe</label>
        <input
          id="apass"
          className="setup__input"
          type="password"
          value={password}
          placeholder="pelo menos 6 caracteres"
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />

        {auth.error && <p className="setup__error">{auth.error}</p>}

        <button className="btn btn--big" disabled={!canSubmit} onClick={submit}>
          {auth.busy ? 'A processar…' : tab === 'login' ? 'Entrar' : 'Criar conta e entrar'}
        </button>
        <button className="btn-link" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}
