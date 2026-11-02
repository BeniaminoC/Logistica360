import { NextResponse, type NextRequest } from "next/server";

/**
 * Protección opcional por contraseña (HTTP Basic). Se activa solo si existe APP_PASSWORD.
 * Siempre públicos: el seguimiento del cliente y los archivos estáticos.
 * La ingesta GPS acepta además la cabecera x-api-key (GPS_API_KEY) para dispositivos sin sesión.
 */
export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const publico = pathname.startsWith("/seguimiento") || pathname.startsWith("/api/seguimiento");
  if (publico) return NextResponse.next();

  const clave = process.env.GPS_API_KEY;
  if (pathname === "/api/gps" && clave && req.headers.get("x-api-key") === clave) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(auth.slice(6)).split(":");
      if (user === "admin" && rest.join(":") === password) return NextResponse.next();
    } catch {
      /* credenciales mal formadas: cae al 401 */
    }
  }
  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Logistica360", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
