export type EstadoPedido = "pendiente" | "asignado" | "en_ruta" | "entregado" | "cancelado";

/** Situación operativa de un vehículo en este momento (lo que el gerente necesita ver de un vistazo). */
export type Situacion =
  | "en_ruta"
  | "retrasado"
  | "sin_senal"
  | "asignado"
  | "disponible"
  | "mantenimiento"
  | "inactivo";

export type VehiculoMapa = {
  id: number;
  placa: string;
  tipo: string;
  lat: number;
  lng: number;
  velocidad_kmh: number;
  ultima_senal: string | null;
  conductor: string | null;
  pedido: string | null;
  destino: string | null;
  situacion: Situacion;
};

export type Alerta = {
  id: string;
  nivel: "alta" | "media";
  tipo: "retraso" | "senal" | "mantenimiento" | "incidente" | "pedido";
  titulo: string;
  detalle: string;
  href?: string;
  cuando?: string | null;
};

export type Dashboard = {
  generadoEn: string;
  flota: {
    total: number;
    en_ruta: number;
    asignados: number;
    disponibles: number;
    mantenimiento: number;
    inactivos: number;
    sin_senal: number;
  };
  pedidos: {
    pendiente: number;
    asignado: number;
    en_ruta: number;
    entregados_24h: number;
    retrasados: number;
  };
  entregas7d: { total: number; a_tiempo: number; pct_a_tiempo: number | null };
  combustible: {
    galones_7d: number;
    costo_7d: number;
    porDia: { dia: string; galones: number; costo: number }[];
    topVehiculos: { placa: string; galones: number; costo: number }[];
  };
  costos: { total_7d: number; por_km: number | null; por_entrega: number | null };
  incidentes: { total_7d: number; ultimos: { tipo: string; placa: string; descripcion: string | null; creado_en: string }[] };
  mantenimiento: {
    abiertas: { id: number; placa: string; tipo: string; descripcion: string | null; creada_en: string }[];
    preventivasVencidas: { id: number; placa: string; km_excedidos: number }[];
  };
  conductores: {
    mejores: { nombre: string; entregas: number; pct: number }[];
    porMejorar: { nombre: string; entregas: number; pct: number }[];
  };
  alertas: Alerta[];
  totalAlertas: number;
  mapa: VehiculoMapa[];
};
