# Google Play — Data Safety form answers

Fill these into **Play Console → App content → Data safety**. They reflect the app's
actual behavior: everything is stored locally, nothing is transmitted off the device,
there are no accounts, analytics, ads, or crash reporting, and no network calls exist
in the code.

## Section 1 — Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (no data is transmitted). If the form forces a choice, select **Yes**. |
| Do you provide a way for users to request that their data is deleted? | **Yes** — data is on-device; users delete records in-app or by uninstalling. |

> Because the app does not transmit data off the device, Google Play treats it as
> **"No data collected"** and **"No data shared."** "Collection" in Play's definition
> means transmission off the device — accessing the camera or files locally without
> sending anything does **not** count as collection.

## Section 2 — Data types
Select **nothing**. Do not tick any category (Location, Personal info, Photos, Files,
etc.), because none of it is sent off the device or to a third party.

## Section 3 — If Play still asks about specific access
If a reviewer questions the camera/photos/notifications permissions, the justification is:

- **Camera** — user photographs their own documents; images stored locally only.
- **Photos/media/files** — user attaches existing files as documents; local only.
- **Notifications (POST_NOTIFICATIONS)** — local reminders for document expiry; no server.
- **Biometric** — local app lock via the OS; app never receives biometric data.

## Privacy policy URL
A privacy policy URL is **required** on the Data safety + main store listing pages.
Host `store/privacy-policy.html` (e.g. GitHub Pages) and paste the public URL.
The policy already lists the publisher (Hamid Moghaddam) and contact (a-l-mahdi@live.com).
