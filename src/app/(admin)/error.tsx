"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-cabeza"><h2>Algo salió mal en esta pantalla</h2></div>
      <div className="panel-cuerpo">
        <p>No pudimos mostrar la información. Intenta de nuevo; si persiste, revisa la conexión con la base de datos.</p>
        <div className="fila-botones"><button className="boton" onClick={reset}>Reintentar</button></div>
      </div>
    </div>
  );
}
