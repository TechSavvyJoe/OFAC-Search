# Privacy & Permissions Justifications

Copy and paste these exact responses into the Chrome Web Store forms.

## 1. Single Purpose Description

> **Field:** `Single purpose description`

**Copy this:**
To provide instant search capability against the U.S. Treasury's OFAC Specially Designated Nationals (SDN) list and generate equivalent compliance certificates for documentation.

---

## 2. Permissions Justifications

> **Field:** `storage justification`

**Copy this:**
Used to locally save the user's search history (for their own record-keeping reference) and to cache the downloaded SDN list data to improve performance and reduce network requests. No data is sent to external servers; all storage is local.

> **Field:** `alarms justification`

**Copy this:**
Used to schedule a daily background check (every 24 hours) to verify if a newer version of the OFAC SDN list is available from the official source, ensuring the user always screens against the most current data.

> **Field:** `Host permission justification`

**Copy this:**
Required to fetch the official OFAC SDN list data files directly from `treasury.gov` and the `data.opensanctions.org` mirror. This allows the extension to download the sanctions list for local screening without needing a third-party intermediary server.

---

## 3. Remote Code

> **Field:** `Are you using remote code?`

**Select:** 🔘 **No, I am not using remote code**

**Reason:** Your extension fetches _data_ (CSV files), but it does not execute external JavaScript. Selecting "Yes" triggers a much longer and harder review process.
