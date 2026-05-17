interface WelcomeTemplateParams {
  firstName: string;
  loginUrl: string;
}

export function welcomeEmailTemplate(params: WelcomeTemplateParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Abrilingo</title>
</head>
<body style="margin:0;padding:40px 0;background:#f3f4f6;font-family:ui-sans-serif,system-ui,sans-serif">
  <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <tr>
      <td style="background:#4f46e5;padding:32px 40px">
        <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px">Abrilingo</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px">Welcome, ${params.firstName}!</h2>
        <p style="margin:0 0 12px;color:#374151;line-height:1.6">
          Great news — your Abrilingo account has been <strong>approved</strong>.
          You can now sign in and access the teacher platform.
        </p>
        <p style="margin:0 0 28px;color:#374151;line-height:1.6">
          We're excited to have you on board.
        </p>
        <a href="${params.loginUrl}"
           style="display:inline-block;padding:13px 28px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Go to Dashboard
        </a>
        <hr style="margin:36px 0;border:none;border-top:1px solid #e5e7eb" />
        <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
          If you have any questions, contact your administrator.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
