# Seed photos

Photos for the agency's demo listings, served as static files (the demo needs no Cloudinary).

- One folder per listing reference: `CB-0001/`, `CB-0002/`, … `CB-0010/`.
- JPG (Kyero's feed reads only JPG, PNG or GIF), about 1600 px on the long side, quality ~80.
- Sorted by file name; the first one is the cover: `01.jpg`, `02.jpg`, …

`npm run db:seed` adds them to a listing that has no photos yet.
