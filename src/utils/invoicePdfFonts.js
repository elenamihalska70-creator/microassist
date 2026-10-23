import { InvoicePdfError } from "./invoicePdfErrors.js";

const regularUrl = new URL("../assets/fonts/noto-sans/NotoSans-Regular.ttf", import.meta.url).href;
const boldUrl = new URL("../assets/fonts/noto-sans/NotoSans-Bold.ttf", import.meta.url).href;
let pending;

async function readFont(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Font response failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) {
    throw new Error("Invalid TrueType font");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}

// One request per face on first use, shared by all invoice PDF callers.
// Failed batches are evicted only once both requests settle, so retry is safe.
export function loadInvoicePdfFonts() {
  if (!pending) {
    pending = Promise.allSettled([readFont(regularUrl), readFont(boldUrl)])
      .then(results => {
        if (results.some(result => result.status === "rejected")) throw new InvoicePdfError("font-load");
        return results.map(result => result.value);
      })
      .catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
