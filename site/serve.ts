const root = new URL("./", import.meta.url).pathname;
const port = Number(Bun.argv[2] ?? 8000);

Bun.serve({
  port,
  async fetch({ url }) {
    const { pathname } = new URL(url);
    const file = Bun.file(root + (pathname === "/" ? "index.html" : pathname.slice(1)));
    return await file.exists() ? new Response(file) : new Response("Not found", { status: 404 });
  }
});

console.log(`Markity preview → http://localhost:${port}`);
