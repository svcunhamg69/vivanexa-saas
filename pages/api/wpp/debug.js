export default function handler(req, res) {
  console.log("🔥 CHEGOU NO DEBUG");
  console.log("📩 MÉTODO:", req.method);
  console.log("📦 BODY:", JSON.stringify(req.body));

  return res.status(200).json({ ok: true });
}
