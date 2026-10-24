# readwise-opds-xteink

Your [Readwise Reader](https://readwise.io/read) library as an OPDS catalog,
for reading on an Xteink e-reader running
[CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader).

**Start with the idea:** [PROMPTS.md](PROMPTS.md) (what was asked) and
[PLAN.md](PLAN.md) (options, design, firmware constraints, verification).
The code is one way to realise it.

Browse Shortlist, Later and Archive from the reader's OPDS browser and download
any article as an EPUB built on the fly: cleaned XHTML, images as grayscale
baseline JPEGs sized for the X3's 528×792 panel, the preview image as cover.
Runs as two serverless functions on Vercel; stores nothing.

- `/opds` – menu: Shortlist, Later, Archive (HTTP Basic auth throughout)
- `/opds/shortlist`, `/opds/later`, `/opds/archive` – 50 per page, newest saved
  first (Reader's order)
- `/opds/books/<id>.epub` – one article as EPUB

PDFs, videos and highlights are left out – CrossPoint can't open them.

## Deploy

Needs a [Readwise access token](https://readwise.io/access_token) and a Vercel
account.

```sh
git clone https://github.com/chuyeow/readwise-opds-xteink.git
cd readwise-opds-xteink
npx vercel link                      # create a project
npx vercel env add READWISE_TOKEN production
npx vercel env add OPDS_USERNAME production
npx vercel env add OPDS_PASSWORD production
npx vercel deploy --prod
```

`OPDS_USERNAME`/`OPDS_PASSWORD` are what the reader sends; pick a long random
password. Optional `BASE_URL` overrides the origin used in feed links.

## Reader

CrossPoint: Settings → Connectivity → OPDS Servers → Add Server, URL
`https://<your-project>.vercel.app/opds` plus the username and password. Easier
from a computer: put the reader in File Transfer mode, open
`http://crosspoint.local/settings`, and use the OPDS Servers card. Then Home →
OPDS Browser.

**"Failed to fetch feed"** (1.6.x shows this for every failure): check
`npx vercel logs requests` for a `CrossPoint-ESP32-*` user agent. None means
the reader never reached Vercel – re-check the URL.

## Develop

```sh
npm install
npm test                                           # core + handlers, network faked
node --env-file=.env.local scripts/dev-server.js   # http://localhost:8787/opds
```

`.env.local` holds `READWISE_TOKEN`, `OPDS_USERNAME`, `OPDS_PASSWORD`.

## Verify against CrossPoint

```sh
set -a; . ./.env.local; set +a
npm run verify:crosspoint -- https://<your-project>.vercel.app 1
```

Compiles CrossPoint's own `OpdsParser` – from the 1.6.5 release and a pinned
develop revision – plus `ContentOpfParser` (needs `clang++` and expat), then
walks the live menu, every shelf and its next page, and a book per shelf
through them, with expat well-formedness and JPEG checks.

## License

[MIT](LICENSE)
