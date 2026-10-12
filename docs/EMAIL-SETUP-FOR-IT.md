# Learning Hub booking emails: set-up for IT

The Learning Hub (https://eduhub27.netlify.app) sends booking confirmations with a QR ticket through Microsoft 365, using the Microsoft Graph `sendMail` API. Bookings work without this. Until it is set up, no emails are sent.

This takes about 15 minutes and needs someone with Entra ID and Exchange Online admin rights.

## 1. The sending mailbox

Emails will be sent from the existing **communications@lwlat.org.uk** mailbox. Any replies from staff will arrive there. No new mailbox is needed.

## 2. Register an app in Entra ID

1. Open https://entra.microsoft.com and go to **Applications → App registrations → New registration**.
2. Name: `LwLAT Learning Hub email`. Supported account types: **this organisation only**. No redirect URI.
3. On the app's **Overview** page, note the **Application (client) ID** and the **Directory (tenant) ID**.
4. Go to **API permissions → Add a permission → Microsoft Graph → Application permissions**, tick **Mail.Send**, and add it.
5. Click **Grant admin consent for Learning Without Limits Academy Trust**.
6. Go to **Certificates & secrets → New client secret**. Choose 24 months. Copy the **Value** straight away, because it is only shown once.

## 3. Restrict the app to the one mailbox (important)

By default, Mail.Send lets an app send as **any** mailbox in the Trust. Limit it to the sending mailbox. In Exchange Online PowerShell:

```powershell
Connect-ExchangeOnline
New-ApplicationAccessPolicy -AppId "<Application (client) ID>" `
  -PolicyScopeGroupId "communications@lwlat.org.uk" -AccessRight RestrictAccess `
  -Description "Learning Hub may only send as the communications mailbox"
Test-ApplicationAccessPolicy -Identity "communications@lwlat.org.uk" -AppId "<Application (client) ID>"
```

The test should say `AccessCheckResult : Granted`. Testing against any other mailbox should say `Denied`. (Microsoft's newer "RBAC for Applications" in Exchange achieves the same and can be used instead.)

## 4. Add four settings in Netlify

In https://app.netlify.com/projects/eduhub27, go to **Project configuration → Environment variables** and add these four. Tick **Contain secret values** for the secret, put each value in the **Production** box, and make sure the **Functions** scope is included.

| Key | Value |
| --- | --- |
| `MS_TENANT_ID` | Directory (tenant) ID |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | The client secret **Value** |
| `MAIL_FROM` | `communications@lwlat.org.uk` |

Then go to **Deploys → Trigger deploy → Deploy site**.

## 5. Test

Sign in at https://eduhub27.netlify.app/admin/. The **Overview** page should say confirmation emails are **switched on**. Use **Send a test email** to send one to yourself.

## Good to know

- Emails are not saved to the mailbox's Sent Items (`saveToSentItems: false`). Each booking in admin records whether its email was sent.
- **Put a reminder in the calendar for when the client secret expires.** After that, emails stop until a new secret is added in Netlify.
- Do not change `SESSION_SECRET` in Netlify once bookings have opened. It also signs the QR tickets, so changing it would make every ticket already sent stop working.
