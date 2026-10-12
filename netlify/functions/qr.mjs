// QR code image for a ticket. Only works with a valid signed ticket link.
import { validTicket, ticketUrl, siteOrigin, qrPng } from "./_tickets.mjs";
export default async request => {
 const url = new URL(request.url);
 const id = url.searchParams.get("b") || "", sig = url.searchParams.get("s") || "";
 if(!validTicket(id, sig)) return new Response("Not found", { status: 404 });
 const png = await qrPng(ticketUrl(siteOrigin(request), id));
 return new Response(png, { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
};
