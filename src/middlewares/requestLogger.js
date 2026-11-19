// Une ligne par requête : date, méthode, URL complète, code de statut, durée.
// L'événement « finish » est émis une fois la réponse envoyée : le statut est alors connu.
export function requestLogger(req, res, next) {
  const debut = performance.now();

  res.on("finish", () => {
    const duree = (performance.now() - debut).toFixed(1);
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duree} ms`
    );
  });

  next();
}
