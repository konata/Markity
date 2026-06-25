const root = new URL("./", import.meta.url).pathname;
const port = Number(Bun.argv[2] ?? 8000);

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const path = root + (pathname === "/" ? "index.html" : pathname.slice(1));
    const file = Bun.file(path);
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  }
});

console.log(`Markity preview → http://localhost:${port}`);
