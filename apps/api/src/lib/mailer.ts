export interface InquiryNotification {
  to: string;
  name: string;
  email: string;
  phone?: string;
  projectType?: string;
  budgetRange?: string;
  message: string;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inquiryHTML(n: InquiryNotification): string {
  const row = (label: string, value?: string) =>
    value ? `<p><strong>${label}:</strong> ${escapeHTML(value)}</p>` : "";

  return (
    `<div style="font-family:system-ui,sans-serif;line-height:1.6">` +
    `<h2>Inquiry baru dari website</h2>` +
    row("Nama", n.name) +
    row("Email", n.email) +
    row("Telepon", n.phone) +
    row("Jenis proyek", n.projectType) +
    row("Rentang budget", n.budgetRange) +
    `<hr><p style="white-space:pre-wrap">${escapeHTML(n.message)}</p>` +
    `</div>`
  );
}

/** Mengirim notifikasi lewat Resend. Isi form tidak pernah dipercaya sebagai HTML mentah. */
export async function sendInquiryNotification(
  apiKey: string | undefined,
  from: string,
  n: InquiryNotification,
): Promise<void> {
  if (!apiKey) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [n.to],
      reply_to: n.email,
      subject: `Inquiry baru dari ${n.name}`,
      html: inquiryHTML(n),
    }),
  });

  if (!res.ok) {
    throw new Error(`resend menolak email: status ${res.status}`);
  }
}
