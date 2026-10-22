/**
 * SMS via MSG91 (India). Without MSG91_AUTH_KEY, logs only (demo mode).
 * Docs: https://docs.msg91.com/
 */
async function sendSms(phone, message) {
  const authKey = process.env.MSG91_AUTH_KEY || '';
  const sender = (process.env.MSG91_SENDER_ID || 'VELVCL').slice(0, 6);
  const mobile = String(phone || '').replace(/\D/g, '').slice(-10);

  if (!/^\d{10}$/.test(mobile)) {
    return { ok: false, error: 'Invalid phone for SMS' };
  }

  if (!authKey) {
    console.log(`[SMS demo] → 91${mobile}: ${message}`);
    return { ok: true, simulated: true, message: 'SMS simulated (set MSG91_AUTH_KEY on server)' };
  }

  try {
    const params = new URLSearchParams({
      authkey: authKey,
      mobiles: `91${mobile}`,
      message,
      sender,
      route: '4',
      country: '91',
    });
    const res = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);
    const text = await res.text();
    const ok = res.ok && !/^ERROR/i.test(text);
    if (!ok) {
      console.error('[SMS] MSG91 error:', text);
      return { ok: false, error: text || 'SMS provider error' };
    }
    return { ok: true, provider: 'msg91', response: text.trim() };
  } catch (err) {
    console.error('[SMS]', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendSms };
