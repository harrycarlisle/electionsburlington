# Food passport receipt verifier

The food passport now has the UX shell:

- user can mark a place tried
- user can attach a receipt image
- the file is inspected only in the browser
- if it looks like an image of reasonable size, the place is marked visited
- the file is discarded
- a local star rating can be saved
- no account and no text review are required

What is **not** implemented: reliable merchant/amount OCR, server-side verification, or any claim that a receipt proves the visit. A client-side model or a short-lived verifier service would be required before completion logic can be treated as verified.

Until then, treat receipt confirmation as a local preference, not proof.
