package com.tanmaysinghx.qubit.mail;

/** Plain, table-based HTML that renders consistently in Gmail / Outlook. */
final class MailTemplates {

    private MailTemplates() {}

    static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    static String layout(String heading, String greeting, String paragraphHtml, String ctaLabel, String ctaUrl, String footnote) {
        return """
                <!doctype html>
                <html><body style="margin:0;padding:0;background:#f4f3ef;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:40px 16px;">
                <tr><td align="center">
                  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%%;background:#ffffff;border:1px solid #e4e2dc;border-radius:14px;">
                    <tr><td style="padding:28px 36px 0 36px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:50%%;background:#5b2bf0;vertical-align:middle;"></span>
                      <span style="font-weight:700;font-size:17px;color:#111014;vertical-align:middle;margin-left:6px;letter-spacing:-0.2px;">Qubit</span>
                    </td></tr>
                    <tr><td style="padding:28px 36px 8px 36px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
                      <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.25;color:#111014;font-weight:650;letter-spacing:-0.4px;">%s</h1>
                      <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#2b2a30;">%s</p>
                      <p style="margin:0 0 26px 0;font-size:15px;line-height:1.6;color:#2b2a30;">%s</p>
                      <a href="%s" style="display:inline-block;background:#111014;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">%s &rarr;</a>
                      <p style="margin:26px 0 0 0;font-size:12px;line-height:1.6;color:#8a8892;word-break:break-all;">Button not working? Paste this link into your browser:<br>%s</p>
                    </td></tr>
                    <tr><td style="padding:24px 36px 30px 36px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
                      <div style="border-top:1px solid #eeece6;padding-top:18px;font-size:13px;line-height:1.6;color:#6d6b74;">%s</div>
                    </td></tr>
                  </table>
                  <p style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;color:#9b99a2;margin:18px 0 0 0;">Qubit · Timed, proctored assessments for JEE, NEET and more</p>
                </td></tr>
                </table>
                </body></html>
                """.formatted(esc(heading), greeting, paragraphHtml, esc(ctaUrl), esc(ctaLabel), esc(ctaUrl), esc(footnote));
    }
}
