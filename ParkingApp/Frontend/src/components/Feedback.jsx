export function ErrorMsg({ error }) {
  if (!error) return null;
  return <div className="alert alert-error">{String(error)}</div>;
}

export function SuccessMsg({ msg }) {
  if (!msg) return null;
  return <div className="alert alert-success">{msg}</div>;
}

export function EstadoBadge({ estado }) {
  const cls =
    {
      DISPONIBLE: 'badge badge-green',
      OCUPADO: 'badge badge-red',
      RESERVADO: 'badge badge-yellow',
    }[estado] || 'badge';
  return <span className={cls}>{estado}</span>;
}
