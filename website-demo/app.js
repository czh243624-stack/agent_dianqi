const form = document.getElementById("inquiry-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

const defaultNote = "Submissions go to the Yifa export desk as website inquiries.";

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `form-note${kind ? ` ${kind}` : ""}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  submitBtn.disabled = true;
  setStatus("Sending inquiry…");

  try {
    const res = await fetch("/api/webhooks/website-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-actor": "website-demo",
      },
      body: JSON.stringify({
        company: String(data.company || "").trim(),
        name: String(data.name || "").trim(),
        email: String(data.email || "").trim(),
        country: String(data.country || "").trim(),
        product: String(data.product || "").trim(),
        message: String(data.message || "").trim(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Request failed (${res.status})`);
    }

    const payload = await res.json();
    const created = payload.created?.[0];
    setStatus(
      created?.id
        ? "Inquiry received. Open the export desk to review it."
        : "Inquiry received by the export desk.",
      "ok",
    );
    form.reset();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not send inquiry. Check that the API is running.", "err");
  } finally {
    submitBtn.disabled = false;
  }
});

form.addEventListener("input", () => {
  if (statusEl.classList.contains("ok") || statusEl.classList.contains("err")) {
    setStatus(defaultNote);
  }
});
