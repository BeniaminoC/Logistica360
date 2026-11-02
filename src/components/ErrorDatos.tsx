/** Mensaje claro cuando la base de datos no responde o aún no tiene tablas. */
export function ErrorDatos({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  const sinUrl = /DATABASE_URL/.test(msg);
  const sinTablas = /relation .* does not exist/.test(msg);
  console.error("[datos]", error);
  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <div className="panel-cabeza"><h2>No se pudo cargar la información</h2></div>
      <div className="panel-cuerpo">
        {sinUrl && (
          <p>Falta configurar la base de datos. Define la variable <code>DATABASE_URL</code> con la cadena de conexión de Aiven (en local en <code>.env.local</code>, en Vercel en Settings → Environment Variables).</p>
        )}
        {sinTablas && (
          <p>La base está conectada pero vacía. Ejecuta <code>npm run db:setup</code> para crear las tablas y los datos de demostración.</p>
        )}
        {!sinUrl && !sinTablas && <p>La conexión con la base de datos falló. Revisa que el servicio de Aiven esté encendido y que la cadena de conexión sea correcta.</p>}
      </div>
    </div>
  );
}
