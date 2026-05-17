interface PendingApprovalTemplateParams {
  adminName: string;
  newUserName: string;
  newUserEmail: string;
  reviewUrl: string;
}

export function pendingApprovalNotificationTemplate(params: PendingApprovalTemplateParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New user awaiting approval</title>
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
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px">
          Action required: new user awaiting approval
        </h2>
        <p style="margin:0 0 20px;color:#374151;line-height:1.6">
          Hi ${params.adminName}, a new teacher has signed up via the invitation flow
          and is waiting for your approval before they can access the platform.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;margin-bottom:28px">
          <tr>
            <td style="padding:20px 24px">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Name</p>
              <p style="margin:0;color:#111827;font-size:16px;font-weight:500">${params.newUserName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Email</p>
              <p style="margin:0;color:#111827;font-size:16px;font-weight:500">${params.newUserEmail}</p>
            </td>
          </tr>
        </table>
        <a href="${params.reviewUrl}"
           style="display:inline-block;padding:13px 28px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Review Pending Users
        </a>
        <hr style="margin:36px 0;border:none;border-top:1px solid #e5e7eb" />
        <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
          You are receiving this because you are a Super Admin on the Abrilingo platform.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
