# Capacity Exchange License v1.0

## Parameters

- **Licensor:** Sundae Labs, Inc.
- **Licensed Work:** Capacity Exchange (the "Software")
- **Change Date:** Four years from the date of each release of the Licensed Work
- **Change License:** Apache License, Version 2.0

---

## Terms

### 1. Grant of Rights

The Licensor hereby grants you a non-exclusive, worldwide, royalty-free license to use, copy, modify, create derivative works of, and redistribute the Licensed Work, subject to the Additional Use Restriction below.

### 2. Additional Use Restriction

You may not use or distribute a modified version of the Licensed Work, or a derivative work incorporating any portions of the Licensed Work, if such modification or derivative work:

(a) implements or invokes the fee-abstraction transaction flow (referred to herein as the "Paid Sponsorship Transaction Flow"), meaning any mechanism by which a user's transaction fees on the underlying blockchain network are paid by a third-party server in exchange for payment in an alternative token; **and**

(b) does any of the following:

   (i) removes, bypasses, or fails to consult the default set of Capacity Exchange servers included in the Licensed Work's configuration at the time of release;

   (ii) bypasses, circumvents, or fails to consult the on-chain Capacity Exchange server registry, once such a registry has been designated by the Licensor and referenced in the Licensed Work's configuration; or

   (iii) hard-codes, overrides, or otherwise restricts the set of available Capacity Exchange servers to exclude servers that would otherwise be discoverable through the mechanisms described in (i) or (ii).

For the avoidance of doubt:

- You **may** add additional servers to the configuration alongside the defaults.
- You **may** use, modify, and redistribute any component of the Licensed Work that does not invoke the Paid Sponsored Transaction Flow, without restriction.
- You **may** build applications that integrate with the Paid Sponsored Transaction Flow as a client, provided the server-discovery mechanisms described above remain intact.
- You **may** operate your own Capacity Exchange server and register it through the standard mechanisms.

### 3. Transition to Open Source

Effective on the Change Date, or if the Licensor publicly announces a Change Date acceleration, the Additional Use Restriction in Section 2 shall terminate and the Licensed Work (including all prior releases) shall be made available under the Change License.

### 4. Notice

Each copy of the Licensed Work or a derivative work must include a copy of this license.

### 5. Disclaimer

THE LICENSED WORK IS PROVIDED "AS IS". THE LICENSOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE USE OF THE LICENSED WORK.

---

## Frequently Asked Questions (non-binding guidance)

**Can I fork this and run my own server?**
Yes. Register your server through the standard config or on-chain registry and you're good.

**Can I build a dApp that uses Capacity Exchange?**
Yes. Just don't rip out the server discovery mechanism.

**What exactly is prohibited?**
Shipping a modified client that uses the dust fee-abstraction flow while preventing users from discovering or selecting other Capacity Exchange servers. The restriction targets rent-seeking forks that capture users by eliminating server competition.

**When does this become fully open source?**
Four years after each release, that release converts to Apache 2.0.